"""Serve the already-built site on loopback for browser tests."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    site = Path(__file__).resolve().parents[1] / '_site'
    if not (site / 'index.html').is_file():
        raise SystemExit('Build the site first: bundle exec jekyll build --strict_front_matter')
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(QuietHandler, directory=str(site)))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
