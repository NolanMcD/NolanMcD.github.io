"""Check local links and fragment targets in a built Jekyll site (stdlib only).

Usage: python tools/check-navigation.py _site
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a' and 'name' in attrs:
            self.ids.add(attrs['name'])
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])


def check(root):
    root = root.resolve()
    pages = {p: Page(p.read_text(encoding='utf-8')) for p in root.rglob('*.html')}
    if not pages:
        print('FAIL: no built HTML found; build Jekyll first.')
        return 1
    failures = []
    checked = 0
    # These hashes select archive filters rather than document sections.
    archive_filters = {
        '/blog/': {'all', 'code,data,math', 'weather,miami', 'movies', 'baseball,sports', 'career,interviews,internet,humor,meta'},
        '/projects/': {'all', 'adventure,audio,language', 'code,data,math', 'movies,writing', 'career,interviews'},
    }
    for source, page in pages.items():
        for href in page.links:
            url = urlsplit(href)
            if url.scheme and url.scheme not in ('http', 'https'):
                continue
            if url.netloc and url.netloc not in ('noland.blog', 'www.noland.blog'):
                continue
            pathname = unquote(url.path)
            target = (root / pathname.lstrip('/')) if pathname.startswith('/') else (source.parent / pathname if pathname else source)
            target = target.resolve()
            if root != target and root not in target.parents:
                failures.append((source, href, 'outside site'))
                continue
            if target.is_dir():
                target = target / 'index.html'
            elif not target.is_file() and not target.suffix:
                target = target.with_suffix('.html')
            checked += 1
            if not target.is_file():
                failures.append((source, href, 'missing destination'))
                continue
            if url.fragment and target in pages:
                fragment = unquote(url.fragment)
                route = '/' + target.relative_to(root).as_posix().removesuffix('index.html')
                if fragment not in pages[target].ids and fragment not in archive_filters.get(route, set()):
                    failures.append((source, href, 'missing fragment'))
    for source, href, reason in failures:
        print(f'FAIL {source.relative_to(root)}: {href} ({reason})')
    print(f'Checked {checked} local links across {len(pages)} HTML pages; {len(failures)} failures.')
    return int(bool(failures))


if __name__ == '__main__':
    sys.exit(check(Path(sys.argv[1] if len(sys.argv) > 1 else '_site')))
