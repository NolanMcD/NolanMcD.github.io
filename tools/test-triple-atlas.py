"""Offline regression tests: python tools/test-triple-atlas.py"""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler

spec = importlib.util.spec_from_file_location('atlas', Path(__file__).with_name('triple-atlas.py'))
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)
CSV = '''game_pk,at_bat_number,pitch_number,batter,events,game_type,game_date,player_name,home_team,away_team,inning_topbot,des
123,2,3,10,triple,R,2026-04-01,Runner,NYM,ATL,Top,A triple
123,3,1,11,double,R,2026-04-01,Other,NYM,ATL,Top,A double
124,2,3,10,triple,S,2026-03-01,Runner,NYM,ATL,Top,Spring
125,2,3,10,triple,R,2025-04-01,Runner,NYM,ATL,Top,Old season
'''
FEED = {'gameData': {'venue': {'name': 'Test Park'}}, 'liveData': {'plays': {'allPlays': [
    {'about': {'atBatIndex': 1}, 'matchup': {'batter': {'id': 10, 'fullName': 'Runner Name'}},
     'result': {'eventType': 'triple'}, 'playEvents': [
         {'isPitch': False, 'pitchNumber': 3, 'playId': 'wrong-action', 'details': {'isInPlay': True}},
         {'isPitch': True, 'pitchNumber': 2, 'playId': 'wrong-pitch', 'details': {'isInPlay': False}},
         {'isPitch': True, 'pitchNumber': 3, 'playId': 'right-pitch', 'details': {'isInPlay': True}}]}
]}}}

def fixture_tags(db):
    with db:
        for tag in ('misplay', 'carom', 'speed'):
            db.execute('INSERT INTO tags VALUES(?,?,?,1)', (tag, tag.title(), ''))

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = atlas.connect(Path(self.tmp.name) / 'test.db')
        fixture_tags(self.db)
        self.play = atlas.parse_csv(CSV)[0]
        atlas.merge_plays(self.db, [self.play])

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_source_scope_and_header_validation(self):
        self.assertEqual([p['id'] for p in atlas.parse_csv(CSV)], ['123-2-3'])
        with self.assertRaises(ValueError):
            atlas.parse_csv('<html>Blocked</html>')

    def test_mapping_requires_batter_ab_pitch_and_in_play(self):
        matched = atlas.enrich(copy.deepcopy(self.play), FEED)
        self.assertEqual(matched['play_id'], 'right-pitch')
        for field in ['batter_id', 'at_bat_number', 'pitch_number']:
            altered = dict(self.play, **{field:999})
            self.assertFalse(atlas.enrich(altered, FEED)['video_url'])

    def test_reimport_keeps_annotations_and_deduplicates(self):
        annotation = dict(atlas.empty_annotation(), tags=['misplay','carom','speed'], note='My notes', rating=5,
                          video_url='https://baseballsavant.mlb.com/sporty-videos?playId=manual')
        atlas.save_annotation(self.db, self.play['id'], annotation, 0)
        atlas.merge_plays(self.db, [self.play, self.play])
        plays = atlas.snapshot(self.db)['plays']
        self.assertEqual(len(plays), 1)
        self.assertEqual(plays[0]['annotation']['note'], 'My notes')
        self.assertEqual(plays[0]['annotation']['tags'], ['misplay','carom','speed'])
        self.assertEqual(plays[0]['annotation']['video_url'], annotation['video_url'])

    def test_feed_outage_preserves_matched_metadata(self):
        atlas.merge_plays(self.db, [atlas.enrich(copy.deepcopy(self.play), FEED)])
        atlas.merge_plays(self.db, [copy.deepcopy(self.play)])
        self.assertEqual(atlas.snapshot(self.db)['plays'][0]['play_id'], 'right-pitch')

    def test_conflicting_tab_does_not_overwrite(self):
        atlas.save_annotation(self.db, self.play['id'], dict(atlas.empty_annotation(), note='first'), 0)
        with self.assertRaises(FileExistsError):
            atlas.save_annotation(self.db, self.play['id'], dict(atlas.empty_annotation(), note='stale'), 0)
        self.assertEqual(atlas.snapshot(self.db)['plays'][0]['annotation']['note'], 'first')

    def test_portable_round_trip_and_transactional_restore(self):
        atlas.save_annotation(self.db, self.play['id'], dict(atlas.empty_annotation(), status='review again', note='Keep'), 0)
        export = atlas.snapshot(self.db)
        atlas.restore(self.db, json.loads(json.dumps(export)))
        self.assertEqual(atlas.snapshot(self.db)['plays'][0]['annotation']['note'], 'Keep')
        invalid = copy.deepcopy(export)
        invalid['plays'][0]['annotation']['note'] = 'Must not save'
        invalid['plays'].append({'id':'missing', 'annotation':atlas.empty_annotation()})
        with self.assertRaises(ValueError):
            atlas.restore(self.db, invalid)
        self.assertEqual(atlas.snapshot(self.db)['plays'][0]['annotation']['note'], 'Keep')

    def test_validation_rejects_unsafe_urls_and_bad_tags(self):
        for url in ['javascript:alert(1)', 'https://evil.test/video', 'https://baseballsavant.mlb.com.evil.test/sporty-videos?playId=x']:
            with self.assertRaises(ValueError):
                atlas.validate_annotation(dict(atlas.empty_annotation(), video_url=url))
        for patch in [{'rating':True}, {'rating':6}, {'tags':['not-defined']}, {'status':'anything'}, {'note':[]}]:
            with self.assertRaises(ValueError):
                atlas.validate_annotation(dict(atlas.empty_annotation(), **patch))

    def test_disk_save_survives_reconnect(self):
        atlas.save_annotation(self.db, self.play['id'], dict(atlas.empty_annotation(), status='tagged', note='Durable'), 0)
        self.db.close()
        self.db = atlas.connect(Path(self.tmp.name) / 'test.db')
        self.assertEqual(atlas.snapshot(self.db)['plays'][0]['annotation']['note'], 'Durable')

    def test_metadata_fetch_rejects_video_endpoints_before_network(self):
        for url in ['https://baseballsavant.mlb.com/sporty-videos?playId=x', 'https://mlb.com/a.mp4']:
            with self.assertRaises(ValueError):
                atlas.fetch(url, 'json')


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        dbpath = Path(cls.tmp.name) / 'server.db'
        db = atlas.connect(dbpath)
        fixture_tags(db)
        atlas.merge_plays(db, atlas.parse_csv(CSV))
        db.close()
        cls.process = subprocess.Popen([sys.executable, str(Path(__file__).with_name('triple-atlas.py')),
                                        '--db', str(dbpath), 'serve', '--port', '18765'],
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        line = cls.process.stdout.readline()
        if '#owner=' not in line:
            raise RuntimeError('Test server failed to start: ' + line)
        cls.token = line.strip().split('#owner=')[1]
        cls.client = build_opener(ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.process.stdout.close()
        cls.process.stderr.close()
        cls.tmp.cleanup()

    def request(self, path, body=None, token=True, headers=None):
        h = {'Content-Type':'application/json'}
        if token:
            h['Authorization'] = 'Bearer ' + self.token
        h.update(headers or {})
        req = Request('http://127.0.0.1:18765' + path, headers=h,
                      data=None if body is None else json.dumps(body).encode())
        return self.client.open(req, timeout=5)

    def test_anonymous_and_cross_origin_cannot_edit(self):
        for kwargs in [dict(token=False), dict(headers={'Origin':'https://evil.test'}), dict(headers={'Host':'evil.test'})]:
            with self.assertRaises(HTTPError) as error:
                self.request('/api/save', {'id':'123-2-3','revision':0,'annotation':atlas.empty_annotation()}, **kwargs)
            self.assertEqual(error.exception.code, 401)
        with self.assertRaises(HTTPError) as error:
            self.request('/api/data', token=False)
        self.assertEqual(error.exception.code, 401)
        with self.assertRaises(HTTPError) as error:
            self.request('/api/tags', {'label':'Public tag'}, token=False)
        self.assertEqual(error.exception.code, 401)

    def test_custom_tag_api(self):
        with self.request('/api/tags', {'label':'My first tag', 'key':'z'}) as response:
            tag = json.load(response)
        with self.request('/api/tags', dict(tag, label='My renamed tag')) as response:
            renamed = json.load(response)
        self.assertEqual(renamed['id'], tag['id'])
        self.assertEqual(renamed['revision'], 2)
        with self.request('/api/data') as response:
            self.assertIn('My renamed tag', [t['label'] for t in json.load(response)['tag_definitions']])

    def test_second_owner_server_cannot_share_the_port(self):
        with self.assertRaises(OSError):
            server = atlas.OwnerServer(('127.0.0.1', 18765), atlas.BaseHTTPRequestHandler)
            server.server_close()

    def test_owner_workflow_and_unknown_play(self):
        body = dict(id='123-2-3', revision=0, annotation=dict(atlas.empty_annotation(), note='Watch again', tags=['speed'], status='tagged'))
        with self.request('/api/save', body) as response:
            self.assertEqual(json.load(response)['revision'], 1)
        with self.request('/api/data') as response:
            play = json.load(response)['plays'][0]
            self.assertEqual(play['annotation']['note'], 'Watch again')
            self.assertEqual(play['annotation']['status'], 'tagged')
        with self.assertRaises(HTTPError) as error:
            self.request('/api/save', body)
        self.assertEqual(error.exception.code, 409)

    def test_only_allowlisted_assets_are_served(self):
        for path in ['/local-data/triple-atlas/atlas.sqlite3','/../README.md','/.git/config','/assets/data/triple-atlas.json']:
            with self.assertRaises(HTTPError) as error:
                self.request(path, token=False)
            self.assertEqual(error.exception.code, 404)
        with self.request('/triple-atlas/', token=False) as response:
            html = response.read().decode()
            self.assertNotIn('{{', html)
            self.assertIn('id="triple-atlas"', html)
            self.assertIn("frame-ancestors 'none'",response.headers['Content-Security-Policy'])

class CustomTagTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'custom.db'
        self.db = atlas.connect(self.path)
        atlas.merge_plays(self.db, atlas.parse_csv(CSV))

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_new_collection_has_no_presets(self):
        self.assertEqual(atlas.tag_definitions(self.db), [])

    def test_create_apply_rename_and_restart(self):
        tag = atlas.save_tag(self.db, {'label':'My kind of triple', 'key':'Q'})
        atlas.save_annotation(self.db, '123-2-3', dict(atlas.empty_annotation(), tags=[tag['id']], note='Keep this'), 0)
        renamed = atlas.save_tag(self.db, dict(tag, label='My favorite triples', key='x'))
        self.assertEqual(tag['id'], renamed['id'])
        self.db.close()
        self.db = atlas.connect(self.path)
        export = atlas.snapshot(self.db)
        self.assertEqual(export['tag_definitions'][0]['label'], 'My favorite triples')
        self.assertEqual(export['plays'][0]['annotation']['tags'], [tag['id']])
        self.assertEqual(export['plays'][0]['annotation']['note'], 'Keep this')

    def test_duplicates_shortcuts_and_stale_rename(self):
        tag = atlas.save_tag(self.db, {'label':'My tag', 'key':'q'})
        for body in [{'label':' my TAG '}, {'label':'Another', 'key':'Q'}, {'label':''}, {'label':'x','key':'!!'}]:
            with self.assertRaises(ValueError):
                atlas.save_tag(self.db, body)
        atlas.save_tag(self.db, dict(tag, label='Renamed'))
        with self.assertRaises(FileExistsError):
            atlas.save_tag(self.db, dict(tag, label='Stale'))

    def test_export_restores_custom_definitions_into_fresh_database(self):
        tag = atlas.save_tag(self.db, {'label':'A tag I invented'})
        atlas.save_annotation(self.db, '123-2-3', dict(atlas.empty_annotation(), tags=[tag['id']]), 0)
        exported = atlas.snapshot(self.db)
        other = atlas.connect(Path(self.tmp.name) / 'other.db')
        try:
            atlas.merge_plays(other, atlas.parse_csv(CSV))
            atlas.restore(other, exported)
            self.assertEqual(atlas.tag_definitions(other)[0]['label'], 'A tag I invented')
            self.assertEqual(atlas.snapshot(other)['plays'][0]['annotation']['tags'], [tag['id']])
            invalid = copy.deepcopy(exported)
            invalid['tag_definitions'].append({'id':'new-tag', 'label':'Rollback tag'})
            invalid['plays'][0]['annotation']['rating'] = 99
            with self.assertRaises(ValueError):
                atlas.restore(other, invalid)
            self.assertEqual(len(atlas.tag_definitions(other)), 1)
        finally:
            other.close()

    def test_legacy_saved_tags_migrate_without_unused_presets(self):
        with self.db:
            self.db.execute('INSERT INTO annotations VALUES(?,?,1)', ('123-2-3',json.dumps(dict(atlas.empty_annotation(),tags=['speed']))))
            self.db.execute("DELETE FROM settings WHERE key='custom_tags_migrated'")
        self.db.close()
        self.db = atlas.connect(self.path)
        self.assertEqual([t['id'] for t in atlas.tag_definitions(self.db)], ['speed'])
        self.assertEqual(atlas.tag_definitions(self.db)[0]['label'], 'Runner speed')

if __name__ == '__main__':
    unittest.main(verbosity=2)
