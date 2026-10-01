#!/usr/bin/env python3
"""Baseball verbs: local owner editor and public snapshot, using only Python's standard library."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'assets/data/baseball-verbs.json'
DATABASE = ROOT / 'local-data/baseball-verbs/verbs.sqlite3'


def connect(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute('CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, verb TEXT NOT NULL, '
               'url TEXT NOT NULL, announcer TEXT NOT NULL, notes TEXT NOT NULL, revision INTEGER NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY)')
    with db:
        if not db.execute("SELECT 1 FROM settings WHERE key='initialized'").fetchone():
            for entry in json.loads(PUBLIC.read_text(encoding='utf-8'))['entries']:
                fields = validate(entry)
                db.execute('INSERT INTO entries VALUES(?,?,?,?,?,1)', (entry['id'], *fields))
            db.execute("INSERT INTO settings VALUES('initialized')")
    return db


def validate(body):
    if not isinstance(body, dict):
        raise ValueError('Expected a word record')
    values = []
    for key, limit in [('verb', 100), ('url', 2000), ('announcer', 150), ('notes', 3000)]:
        value = body.get(key, '')
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f'{key} must be text of at most {limit} characters')
        values.append(value.strip())
    if not values[0]:
        raise ValueError('Enter a verb or phrase')
    if values[1]:
        u = urlsplit(values[1])
        if (u.scheme != 'https' or u.netloc.lower() != 'baseballsavant.mlb.com'
                or any(c.isspace() for c in values[1])):
            raise ValueError('Use an HTTPS link on baseballsavant.mlb.com')
    return values


def snapshot(db):
    return dict(schema_version=1, entries=[dict(r) for r in db.execute('SELECT * FROM entries ORDER BY verb COLLATE NOCASE')])


def save(db, body):
    fields = validate(body)
    with db:
        db.execute('BEGIN IMMEDIATE')
        key = body.get('id')
        existing = db.execute('SELECT * FROM entries WHERE id=?', (key,)).fetchone() if key else None
        if key and (not existing or existing['revision'] != body.get('revision')):
            raise FileExistsError('This word changed in another tab. Copy your unsaved form text and reopen the owner URL before editing again.')
        if any(r['verb'].casefold() == fields[0].casefold() and r['id'] != key for r in db.execute('SELECT id,verb FROM entries')):
            raise ValueError('That word is already in the dictionary. Edit its existing entry.')
        key = key or secrets.token_hex(12)
        revision = existing['revision'] + 1 if existing else 1
        db.execute('INSERT OR REPLACE INTO entries VALUES(?,?,?,?,?,?)', (key, *fields, revision))
    return dict(id=key, **dict(zip(['verb', 'url', 'announcer', 'notes'], fields)), revision=revision)


def delete(db, body):
    with db:
        result = db.execute('DELETE FROM entries WHERE id=? AND revision=?', (body['id'], body['revision']))
        if result.rowcount != 1:
            raise FileExistsError('This word changed in another tab. Reopen the owner URL before deleting it.')
    return {'deleted': body['id']}


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


class OwnerServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def make_server(path, port):
    token = secrets.token_urlsafe(32)
    origin = f'http://127.0.0.1:{port}'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, status, body, mime='application/json'):
            content = (json.dumps(body) if mime == 'application/json' else body).encode('utf-8')
            self.send_response(status)
            for key, value in {'Content-Type': mime + '; charset=utf-8', 'Content-Length': str(len(content)),
                               'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                               'Referrer-Policy': 'no-referrer',
                               'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'"}.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(content)

        def authorized(self):
            return (self.headers.get('Host') == f'127.0.0.1:{port}' and
                    self.headers.get('Origin', origin) == origin and
                    secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token))

        def do_GET(self):
            route = urlsplit(self.path).path
            if route == '/api/data':
                if not self.authorized():
                    return self.respond(401, {'error': 'Owner connection expired or missing.'})
                with connect(path) as db:
                    return self.respond(200, snapshot(db))
            if route in ('/', '/baseball-verbs/'):
                content = (ROOT / 'pages/baseball-verbs.html').read_text(encoding='utf-8').split('---', 2)[2]
                content = re.sub(r"{{\s*'([^']+)'\s*\|\s*relative_url\s*}}", r'\1', content)
                return self.respond(200, '<!doctype html><html lang="en"><head><meta charset="utf-8">'
                                    '<meta name="viewport" content="width=device-width,initial-scale=1">'
                                    '<title>Baseball Verbs · Owner</title></head><body>' + content + '</body></html>', 'text/html')
            files = {'/assets/baseball-verbs.css': 'text/css', '/assets/js/baseball-verbs.js': 'text/javascript',
                     '/assets/data/baseball-verbs.json': 'application/json'}
            if route in files:
                content = (ROOT / route.lstrip('/')).read_text(encoding='utf-8')
                return self.respond(200, json.loads(content) if files[route] == 'application/json' else content, files[route])
            self.respond(404, {'error': 'Not found'})

        def do_POST(self):
            if not self.authorized():
                return self.respond(401, {'error': 'Owner connection expired. Reopen the terminal owner URL.'})
            try:
                size = int(self.headers.get('Content-Length', 0))
                if not 0 < size <= 25000:
                    raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError('Expected a word record')
                with connect(path) as db:
                    if self.path == '/api/save':
                        return self.respond(200, save(db, body))
                    if self.path == '/api/delete':
                        return self.respond(200, delete(db, body))
                self.respond(404, {'error': 'Not found'})
            except FileExistsError as exc:
                self.respond(409, {'error': str(exc)})
            except (ValueError, TypeError, KeyError, sqlite3.InterfaceError) as exc:
                self.respond(400, {'error': str(exc)})
            except Exception:
                self.respond(500, {'error': 'Save failed. Keep your draft open and check the owner server.'})

    server = OwnerServer(('127.0.0.1', port), Handler)
    return server, token


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=DATABASE)
    sub = parser.add_subparsers(dest='command', required=True)
    owner = sub.add_parser('serve')
    owner.add_argument('--port', type=int, default=8767)
    sub.add_parser('publish', help='Write all saved words, links and notes to the public snapshot')
    export = sub.add_parser('export')
    export.add_argument('file', type=Path)
    args = parser.parse_args()
    with connect(args.db) as db:
        if args.command != 'serve':
            target = PUBLIC if args.command == 'publish' else args.file
            write_json(target, snapshot(db))
            print('Wrote', target)
            return
    server, token = make_server(args.db, args.port)
    print(f'Owner console: http://127.0.0.1:{args.port}/baseball-verbs/#owner={token}', flush=True)
    print('Keep this URL private and this terminal open. Ctrl+C stops the console.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as exc:
        sys.exit(str(exc))
