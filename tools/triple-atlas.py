#!/usr/bin/env python3
"""Triple Atlas: metadata-only import and loopback-only owner console (stdlib)."""
import argparse
import calendar
import csv
import io
import json
import os
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import sys
import time
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'local-data' / 'triple-atlas'
PUBLIC = ROOT / 'assets/data/triple-atlas.json'
TAGS = ROOT / 'assets/data/triple-atlas-tags.json'
SOURCE = 'https://baseballsavant.mlb.com/statcast_search?hfAB=triple%7C&hfGT=R%7C&hfSea=2026%7C&player_type=batter&group_by=name-event&min_pitches=0&min_results=0&min_pas=0'
VIDEO = re.compile(r'https://baseballsavant\.mlb\.com/sporty-videos\?playId=[a-zA-Z0-9-]+\Z')

class OwnerServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR allows multiple listeners with different owner tokens.
    # Reserve this port exclusively so the printed URL always reaches this server.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Metadata endpoint redirected; refusing to follow a possible media URL')

def now():
    return datetime.now(timezone.utc).isoformat()

def connect(path=None):
    path = path or DATA / 'atlas.sqlite3'
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(path), timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''CREATE TABLE IF NOT EXISTS plays(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS annotations(id TEXT PRIMARY KEY REFERENCES plays(id), body TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tags(id TEXT PRIMARY KEY, label TEXT NOT NULL, shortcut TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1);''')
    # Migrate only tags already used in saved annotations, never unused presets.
    if not db.execute("SELECT 1 FROM settings WHERE key='custom_tags_migrated'").fetchone():
        legacy = {t['id']: t for g in json.loads(TAGS.read_text(encoding='utf-8')) for t in g['tags']}
        used = {t for row in db.execute('SELECT body FROM annotations') for t in json.loads(row[0]).get('tags', [])}
        with db:
            for tag in sorted(used):
                definition = legacy.get(tag, {'label': tag.replace('-', ' ').title()})
                db.execute('INSERT OR IGNORE INTO tags VALUES(?,?,?,1)',
                           (tag, definition['label'], definition.get('key', '')))
            db.execute("INSERT INTO settings VALUES('custom_tags_migrated','1')")
    return db

def tag_definitions(db):
    return [dict(id=r['id'], label=r['label'], key=r['shortcut'], revision=r['revision'])
            for r in db.execute('SELECT * FROM tags ORDER BY label COLLATE NOCASE, id')]

def validate_tag(body):
    if not isinstance(body, dict) or not isinstance(body.get('label'), str):
        raise ValueError('Enter a tag name')
    label = body['label'].strip()
    key = body.get('key', '')
    if not label or len(label) > 80 or any(ord(c) < 32 for c in label):
        raise ValueError('Tag names must contain 1–80 characters without line breaks')
    if not isinstance(key, str) or (key and not re.fullmatch('[a-zA-Z0-9]', key)):
        raise ValueError('Shortcut must be one letter or number, or empty')
    return label, key.lower()

def save_tag(db, body):
    label, key = validate_tag(body)
    tag_id = body.get('id')
    with db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT * FROM tags WHERE id=?', (tag_id,)).fetchone() if tag_id else None
        if tag_id and not existing:
            raise ValueError('Unknown tag')
        if existing and body.get('revision') != existing['revision']:
            raise FileExistsError('This tag changed in another tab. Reload before renaming it.')
        for t in tag_definitions(db):
            if t['id'] != tag_id and t['label'].casefold() == label.casefold():
                raise ValueError('A tag with that name already exists')
            if key and t['id'] != tag_id and t['key'] == key:
                raise ValueError('That shortcut is already assigned to another tag')
        tag_id = tag_id or 'tag-' + secrets.token_hex(8)
        revision = existing['revision'] + 1 if existing else 1
        db.execute('INSERT OR REPLACE INTO tags VALUES(?,?,?,?)', (tag_id, label, key, revision))
    return dict(id=tag_id, label=label, key=key, revision=revision)

def empty_annotation():
    return dict(status='unwatched', tags=[], note='', rating=None, video_url=None)

def snapshot(db):
    annotations = {r['id']: dict(json.loads(r['body']), revision=r['revision'])
                   for r in db.execute('SELECT * FROM annotations')}
    plays = [dict(json.loads(r['metadata']), annotation=annotations.get(r['id'], dict(empty_annotation(), revision=0)))
             for r in db.execute('SELECT * FROM plays ORDER BY id')]
    return dict(schema_version=1, season=2026, source_url=SOURCE, exported_at=now(),
                import_info=dict(db.execute('SELECT key,value FROM settings')),
                tag_definitions=tag_definitions(db), plays=plays)

def validate_annotation(a, known=None):
    if not isinstance(a, dict):
        raise ValueError('Annotation must be an object')
    if a.get('status') not in ('unwatched', 'tagged', 'review again'):
        raise ValueError('Invalid status')
    tags = a.get('tags', [])
    known = known if known is not None else set()
    if not isinstance(tags, list) or any(not isinstance(t, str) or t not in known for t in tags):
        raise ValueError('Unknown tag. Restore its definition before importing.')
    if not isinstance(a.get('note', ''), str) or len(a.get('note', '')) > 20000:
        raise ValueError('Notes must be text, at most 20,000 characters')
    rating = a.get('rating')
    if rating is not None and (type(rating) is not int or rating not in range(1, 6)):
        raise ValueError('Rating must be 1–5 or empty')
    url = a.get('video_url')
    if url is not None and (not isinstance(url, str) or (url and not VIDEO.fullmatch(url))):
        raise ValueError('Use a direct https://baseballsavant.mlb.com/sporty-videos?playId=... URL')
    return dict(status=a['status'], tags=list(dict.fromkeys(tags)), note=a.get('note', ''),
                rating=rating, video_url=url, updated_at=now())

def save_annotation(db, play_id, body, revision):
    with db:
        db.execute('BEGIN IMMEDIATE')
        a = validate_annotation(body, {t['id'] for t in tag_definitions(db)})
        if not db.execute('SELECT 1 FROM plays WHERE id=?', (play_id,)).fetchone():
            raise ValueError('Unknown play')
        row = db.execute('SELECT revision FROM annotations WHERE id=?', (play_id,)).fetchone()
        current = row[0] if row else 0
        if revision != current:
            raise FileExistsError('This play changed in another tab. Export your draft or reload before editing.')
        db.execute('INSERT OR REPLACE INTO annotations VALUES(?,?,?)', (play_id, json.dumps(a), current + 1))
    return dict(a, revision=current + 1)

def fetch(url, kind):
    # Only textual metadata endpoints are allowed; never request media or video pages.
    parsed = urlparse(url)
    allowed = ((parsed.hostname == 'baseballsavant.mlb.com' and parsed.path == '/statcast_search/csv') or
               (parsed.hostname == 'statsapi.mlb.com' and re.fullmatch(r'/api/v1\.1/game/\d+/feed/live', parsed.path)))
    if parsed.scheme != 'https' or not allowed:
        raise ValueError('Not a metadata endpoint')
    for attempt in range(3):
        try:
            with build_opener(NoRedirect()).open(Request(url, headers={'User-Agent': 'Mozilla/5.0 (Triple Atlas metadata import)',
                                              'Accept': 'text/csv,application/json'}), timeout=60) as response:
                if response.headers.get_content_type().startswith(('video/', 'audio/')):
                    raise ValueError('Refusing media response')
                text = response.read(30_000_001)
                if len(text) > 30_000_000:
                    raise ValueError('Metadata response too large')
                text = text.decode('utf-8-sig')
                return json.loads(text) if kind == 'json' else text
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def parse_csv(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    required = {'game_pk', 'at_bat_number', 'pitch_number', 'batter', 'events', 'game_type', 'game_date'}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('Expected a Savant pitch-level CSV, not summary data or an HTML error page')
    result = []
    for r in reader:
        if r['events'] != 'triple' or r['game_type'] != 'R' or not r['game_date'].startswith('2026-'):
            continue
        game, ab, pitch, batter = [int(r[k]) for k in ('game_pk', 'at_bat_number', 'pitch_number', 'batter')]
        if min(game, ab, pitch, batter) < 1:
            raise ValueError('Invalid play identity')
        result.append(dict(id=f'{game}-{ab}-{pitch}', game_pk=game, at_bat_number=ab, pitch_number=pitch,
                           batter_id=batter, player=r.get('player_name') or f'Batter {batter}',
                           date=r['game_date'][:10], home_team=r.get('home_team', ''), away_team=r.get('away_team', ''),
                           team=r.get('away_team' if r.get('inning_topbot') == 'Top' else 'home_team', ''),
                           park='Unknown park', description=r.get('des', ''), video_url='', play_id=None,
                           video_match='unresolved', event='triple', game_type='R'))
    return result

def enrich(play, feed):
    gd = feed.get('gameData', {})
    play['park'] = gd.get('venue', {}).get('name', 'Unknown park')
    candidates = [p for p in feed.get('liveData', {}).get('plays', {}).get('allPlays', [])
                  if p.get('about', {}).get('atBatIndex') == play['at_bat_number'] - 1
                  and p.get('matchup', {}).get('batter', {}).get('id') == play['batter_id']
                  and p.get('result', {}).get('eventType') == 'triple']
    if len(candidates) != 1:
        return play
    ab = candidates[0]
    play['player'] = ab['matchup']['batter']['fullName']
    pitches = [p for p in ab.get('playEvents', []) if p.get('isPitch')
               and p.get('pitchNumber') == play['pitch_number'] and p.get('details', {}).get('isInPlay')]
    if len(pitches) == 1 and re.fullmatch(r'[a-zA-Z0-9-]+', pitches[0].get('playId', '')):
        play['play_id'] = pitches[0]['playId']
        play['video_url'] = 'https://baseballsavant.mlb.com/sporty-videos?playId=' + play['play_id']
        play['video_match'] = 'matched pitch; availability unverified'
    return play

def merge_plays(db, plays):
    with db:
        for p in plays:
            previous = db.execute('SELECT metadata FROM plays WHERE id=?', (p['id'],)).fetchone()
            if previous:
                old = json.loads(previous[0])
                # A temporary feed outage must not erase a previously matched link or park.
                if not p['video_url']:
                    for key in ('video_url', 'play_id', 'video_match'):
                        p[key] = old.get(key, p[key])
                if p['park'] == 'Unknown park':
                    p['park'] = old['park']
            db.execute('INSERT OR REPLACE INTO plays VALUES(?,?)', (p['id'], json.dumps(p)))

def run_import(db, args):
    rows = []
    if args.csv:
        rows = parse_csv(Path(args.csv).read_text(encoding='utf-8-sig'))
    else:
        end = min(date.today(), date(2026, 12, 31))
        for month in range(3, end.month + 1):
            start = date(2026, month, 1)
            stop = min(date(2026, month, calendar.monthrange(2026, month)[1]), end)
            query = urlencode(dict(all='true', type='details', hfAB='triple|', hfGT='R|', hfSea='2026|',
                                   player_type='batter', game_date_gt=start.isoformat(), game_date_lt=stop.isoformat()))
            print(f'Fetching Savant {start} through {stop}...', flush=True)
            rows.extend(parse_csv(fetch('https://baseballsavant.mlb.com/statcast_search/csv?' + query, 'csv')))
    rows = list({p['id']: p for p in rows}.values())
    failures = []
    groups = {}
    for p in rows:
        groups.setdefault(p['game_pk'], []).append(p)
    for index, (game, plays) in enumerate(groups.items()):
        try:
            feed = fetch(f'https://statsapi.mlb.com/api/v1.1/game/{game}/feed/live', 'json')
            for p in plays:
                enrich(p, feed)
        except Exception as exc:
            failures.append(f'{game}: {exc}')
        if index % 25 == 0:
            print(f'Matched game metadata {index + 1}/{len(groups)}', flush=True)
    merge_plays(db, rows)
    matched = sum(bool(p['video_url']) for p in rows)
    report = dict(imported_at=now(), source='downloaded CSV' if args.csv else 'Savant monthly CSV',
                  imported=len(rows), matched=matched, unresolved=len(rows)-matched, feed_failures=failures)
    with db:
        db.execute('INSERT OR REPLACE INTO settings VALUES(?,?)', ('last_import', json.dumps(report)))
    print(json.dumps(report, indent=2))

def restore(db, document):
    if not isinstance(document, dict) or document.get('schema_version') != 1 or not isinstance(document.get('plays'), list):
        raise ValueError('Expected a Triple Atlas JSON export (schema_version 1)')
    with db:
        db.execute('BEGIN IMMEDIATE')
        return restore_transaction(db, document)

def restore_transaction(db, document):
    incoming = document.get('tag_definitions', [])
    if not isinstance(incoming, list):
        raise ValueError('Tag definitions must be a list')
    definitions = {t['id']: t for t in tag_definitions(db)}
    seen_tags = set()
    # Old exports did not include definitions; recover only the IDs they use.
    if 'tag_definitions' not in document:
        legacy = {t['id']: t for g in json.loads(TAGS.read_text(encoding='utf-8')) for t in g['tags']}
        referenced = {t for p in document['plays'] if isinstance(p, dict)
                      for t in (p.get('annotation') or {}).get('tags', []) if isinstance(t, str)}
        incoming = [legacy[t] for t in referenced if t not in definitions and t in legacy]
    for t in incoming:
        label, key = validate_tag(t)
        tag_id = t.get('id')
        if not isinstance(tag_id, str) or not re.fullmatch('[a-zA-Z0-9-]{1,100}', tag_id) or tag_id in seen_tags:
            raise ValueError('Invalid or duplicate tag ID')
        seen_tags.add(tag_id)
        if tag_id in definitions:
            continue  # Keep the owner's current name and shortcut for an existing ID.
        if any(old['label'].casefold() == label.casefold() for old in definitions.values()):
            raise ValueError('Imported tag name collides with a different tag ID: ' + label)
        if key and any(old['key'] == key for old in definitions.values()):
            key = ''  # Preserve the local shortcut assignment.
        db.execute('INSERT INTO tags VALUES(?,?,?,1)', (tag_id, label, key))
        definitions[tag_id] = dict(id=tag_id, label=label, key=key)
    items = document['plays']
    seen = set()
    validated = []
    for p in items:
        if not isinstance(p, dict) or not isinstance(p.get('id'), str):
            raise ValueError('Each play must have a string ID')
        key = p.get('id')
        if key in seen or not db.execute('SELECT 1 FROM plays WHERE id=?', (key,)).fetchone():
            raise ValueError(f'Duplicate or unknown play {key}; import source metadata first')
        seen.add(key)
        validated.append((key, validate_annotation(p.get('annotation'), set(definitions))))
    for key, annotation in validated:
        db.execute('''INSERT INTO annotations VALUES(?,?,1) ON CONFLICT(id) DO UPDATE
                      SET body=excluded.body, revision=annotations.revision+1''', (key, json.dumps(annotation)))
    return len(validated)

def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)

def serve(args):
    token = secrets.token_urlsafe(32)
    origin = f'http://127.0.0.1:{args.port}'
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass

        def respond(self, status, body, mime='application/json'):
            data = (json.dumps(body) if mime == 'application/json' else body).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', mime + '; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(data)

        def authorized(self):
            return (self.headers.get('Host') == f'127.0.0.1:{args.port}' and
                    secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token) and
                    self.headers.get('Origin', origin) == origin)

        def do_GET(self):
            path = urlparse(self.path).path
            if path.startswith('/api/'):
                if not self.authorized():
                    return self.respond(401, {'error': 'Owner token required'})
                if path == '/api/data':
                    with connect(args.db) as db:
                        return self.respond(200, snapshot(db))
                return self.respond(404, {'error': 'Not found'})
            files = {'/assets/js/triple-atlas.js': ('assets/js/triple-atlas.js', 'text/javascript'),
                     '/assets/triple-atlas.css': ('assets/triple-atlas.css', 'text/css'),
                     '/assets/data/triple-atlas-tags.json': ('assets/data/triple-atlas-tags.json', 'application/json')}
            if path in ('/', '/triple-atlas/'):
                content = (ROOT / 'pages/triple-atlas.html').read_text(encoding='utf-8').split('---', 2)[2]
                content = re.sub(r"{{\s*'([^']+)'\s*\|\s*relative_url\s*}}", r'\1', content)
                return self.respond(200, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Triple Atlas · Owner</title></head><body>' + content + '</body></html>', 'text/html')
            if path in files:
                file, mime = files[path]
                body = (ROOT / file).read_text(encoding='utf-8')
                return self.respond(200, json.loads(body) if mime == 'application/json' else body, mime)
            return self.respond(404, {'error': 'Not found'})

        def do_POST(self):
            if not self.authorized():
                return self.respond(401, {'error': 'Owner token required'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 10_000_000:
                    raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(size))
                with connect(args.db) as db:
                    if self.path == '/api/tags':
                        return self.respond(200, save_tag(db, body))
                    if self.path == '/api/save':
                        return self.respond(200, save_annotation(db, body['id'], body['annotation'], body['revision']))
                    if self.path == '/api/restore':
                        backup = DATA / ('backup-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
                        atomic_json(backup, snapshot(db))
                        return self.respond(200, {'restored': restore(db, body)})
                return self.respond(404, {'error': 'Not found'})
            except FileExistsError as exc:
                return self.respond(409, {'error': str(exc)})
            except (ValueError, KeyError, TypeError) as exc:
                return self.respond(400, {'error': str(exc)})
            except Exception:
                return self.respond(500, {'error': 'Save failed. Your draft is retained; check the owner server.'})
    try:
        server = OwnerServer(('127.0.0.1', args.port), Handler)
    except OSError as exc:
        raise OSError(f'Cannot start the owner console on port {args.port}. Another console may already be running. '
                      f'Use its terminal URL, stop it with Ctrl+C, or choose serve --port {args.port + 1}.') from exc
    print(f'Owner console: {origin}/triple-atlas/#owner={token}', flush=True)
    print('Loopback only. Keep this URL private. Ctrl+C stops the console.', flush=True)
    server.serve_forever()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, help='Alternate database (testing/backup)')
    sub = parser.add_subparsers(dest='command', required=True)
    imp = sub.add_parser('import', help='Import Savant metadata; existing annotations are preserved')
    imp.add_argument('--csv', help='Fallback: pitch-level CSV downloaded from the Savant search')
    owner = sub.add_parser('serve', help='Start the local owner console')
    owner.add_argument('--port', type=int, default=8765)
    export = sub.add_parser('export', help='Export portable annotations and source metadata')
    export.add_argument('file', type=Path)
    load = sub.add_parser('restore', help='Restore annotations from JSON after importing source plays')
    load.add_argument('file', type=Path)
    publish = sub.add_parser('publish', help='Write a read-only snapshot for GitHub Pages')
    publish.add_argument('--annotations', action='store_true', help='Include notes, tags and ratings publicly')
    args = parser.parse_args()
    if args.command == 'serve':
        return serve(args)
    with connect(args.db) as db:
        if args.command == 'import':
            run_import(db, args)
        elif args.command == 'restore':
            atomic_json(DATA / ('backup-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json'), snapshot(db))
            print('Restored', restore(db, json.loads(args.file.read_text(encoding='utf-8-sig'))), 'annotations')
        else:
            data = snapshot(db)
            if args.command == 'publish':
                if not args.annotations:
                    data['tag_definitions'] = []
                    for p in data['plays']:
                        p['annotation'] = dict(empty_annotation(), revision=0)
                data['annotations_published'] = args.annotations
            atomic_json(PUBLIC if args.command == 'publish' else args.file, data)
            print('Wrote', PUBLIC if args.command == 'publish' else args.file)

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as exc:
        sys.exit(str(exc))
