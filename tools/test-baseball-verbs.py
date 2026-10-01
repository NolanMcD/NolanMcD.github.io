"""Exercise durable edits, conflicts, validation, and the owner HTTP boundary."""
import importlib.util
import json
from pathlib import Path
import socket
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('verbs', Path(__file__).with_name('baseball-verbs.py'))
verbs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verbs)


class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'verbs.sqlite3'
        self.db = verbs.connect(self.path)

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_save_reopen_edit_and_delete(self):
        entry = verbs.save(self.db, {'verb': ' lasered ', 'notes': 'Listen for the call.'})
        self.db.close()
        self.db = verbs.connect(self.path)
        self.assertIn(entry, verbs.snapshot(self.db)['entries'])
        changed = verbs.save(self.db, dict(entry, url='https://baseballsavant.mlb.com/sporty-videos?playId=example'))
        self.assertEqual(changed['revision'], 2)
        self.assertEqual(changed['notes'], entry['notes'])
        verbs.delete(self.db, changed)
        self.assertNotIn(changed, verbs.snapshot(self.db)['entries'])

    def test_duplicate_and_empty_word(self):
        for body in [{'verb': 'LINED'}, {'verb': '  '}, {'verb': 1}]:
            with self.assertRaises(ValueError):
                verbs.save(self.db, body)

    def test_url_validation(self):
        for url in ['javascript:alert(1)', 'https://baseballsavant.mlb.com.evil.test/',
                    'https://evil.test/', 'http://baseballsavant.mlb.com/',
                    'https://user@baseballsavant.mlb.com/', 'https://baseballsavant.mlb.com:444/']:
            with self.assertRaises(ValueError):
                verbs.save(self.db, {'verb': 'smoked', 'url': url})

    def test_conflicts_preserve_newer_edit(self):
        entry = verbs.save(self.db, {'verb': 'smoked'})
        newer = verbs.save(self.db, dict(entry, notes='New note'))
        with self.assertRaises(FileExistsError):
            verbs.save(self.db, dict(entry, notes='Stale note'))
        with self.assertRaises(FileExistsError):
            verbs.delete(self.db, entry)
        self.assertIn(newer, verbs.snapshot(self.db)['entries'])

    def test_empty_collection_stays_empty(self):
        for entry in verbs.snapshot(self.db)['entries']:
            verbs.delete(self.db, entry)
        self.db.close()
        self.db = verbs.connect(self.path)
        self.assertEqual(verbs.snapshot(self.db)['entries'], [])

    def test_snapshot_roundtrip(self):
        entry = verbs.save(self.db, {'verb': 'smoked', 'announcer': 'A broadcaster', 'notes': 'A call'})
        path = Path(self.temp.name) / 'export.json'
        verbs.write_json(path, verbs.snapshot(self.db))
        self.assertIn(entry, json.loads(path.read_text())['entries'])

    def test_http_owner_boundary(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        server, token = verbs.make_server(self.path, port)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f'http://127.0.0.1:{port}'
        def request(path, body=None, **headers):
            req = Request(origin + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
            try:
                with urlopen(req, timeout=3) as response:
                    return response.status, response.read()
            except HTTPError as exc:
                return exc.code, exc.read()
        try:
            auth = {'Authorization': 'Bearer ' + token, 'Origin': origin}
            self.assertEqual(request('/api/data')[0], 401)
            self.assertEqual(request('/api/save', {'verb': 'smoked'})[0], 401)
            self.assertEqual(request('/api/save', {'verb': 'smoked'}, **dict(auth, Origin='https://evil.test'))[0], 401)
            self.assertEqual(request('/api/data', **dict(auth, Host='evil.test'))[0], 401)
            self.assertEqual(request('/local-data/baseball-verbs/verbs.sqlite3')[0], 404)
            self.assertEqual(request('/assets/../tools/baseball-verbs.py')[0], 404)
            status, body = request('/api/save', {'verb': 'smoked'}, **auth)
            self.assertEqual(status, 200)
            saved = json.loads(body)
            self.assertIn(saved, json.loads(request('/api/data', **auth)[1])['entries'])
            self.assertEqual(request('/api/delete', saved, **auth)[0], 200)
            self.assertEqual(request('/api/save', [], **auth)[0], 400)
            status, body = request('/baseball-verbs/')
            self.assertEqual(status, 200)
            self.assertNotIn(b'{{', body)
            for asset in ['/assets/baseball-verbs.css', '/assets/js/baseball-verbs.js', '/assets/data/baseball-verbs.json']:
                self.assertEqual(request(asset)[0], 200)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
