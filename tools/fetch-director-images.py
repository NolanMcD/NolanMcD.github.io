"""Resolve hosted Wikipedia thumbnails and file-page credits. No image downloads."""
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def query(site='en.wikipedia.org', **params):
    url = 'https://' + site + '/w/api.php?' + urllib.parse.urlencode(dict(action='query', format='json', **params))
    request = urllib.request.Request(url, headers={'User-Agent': 'NolandBlog/1.0 (https://noland.blog)'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', value or '')).strip()


if __name__ == '__main__':
    data = json.loads((ROOT / '_data/director_rankings.json').read_text(encoding='utf-8'))
    titles = [t for d in data['directors'] for t in [d['name'], d['filmArticle']]]
    result = query(titles='|'.join(titles), prop='pageimages', piprop='thumbnail|name',
                   pithumbsize=500, pilicense='any', redirects=1)
    aliases = {r['from']: r['to'] for r in result['query'].get('normalized', []) + result['query'].get('redirects', [])}
    pages = {p['title']: p for p in result['query']['pages'].values()}
    files = ['File:' + p['pageimage'] for p in pages.values() if p.get('thumbnail')]
    info = query(titles='|'.join(files), prop='imageinfo', iiprop='url|extmetadata')
    credits = {p['title']: p.get('imageinfo', [{}])[0] for p in info['query']['pages'].values()}
    shared_files = ['File:' + p['pageimage'] for p in pages.values()
                    if '/commons/' in p.get('thumbnail', {}).get('source', '')]
    shared_info = query(site='commons.wikimedia.org', titles='|'.join(shared_files),
                        prop='imageinfo', iiprop='url|extmetadata')
    credits.update({p['title']: p.get('imageinfo', [{}])[0] for p in shared_info['query']['pages'].values()})
    images = {}
    for d in data['directors']:
        images[d['id']] = {}
        for kind, title in [('portrait', d['name']), ('poster', d['filmArticle'])]:
            title = aliases.get(title, title)
            page = pages.get(title, {})
            if not page.get('thumbnail'):
                print('Missing:', kind, title)
                continue
            file_name = 'File:' + page['pageimage']
            credit = credits.get(file_name.replace('_', ' '), {})
            metadata = credit.get('extmetadata', {})
            images[d['id']][kind] = dict(url=page['thumbnail']['source'].split('?')[0],
                file=page['pageimage'], source=credit.get('descriptionurl', 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(file_name)),
                artist=plain(metadata.get('Artist', {}).get('value', '')),
                license=plain(metadata.get('LicenseShortName', {}).get('value', 'See file page')),
                licenseUrl=metadata.get('LicenseUrl', {}).get('value', ''))
            print(d['name'], kind, page['pageimage'])
    (ROOT / '_data/director_images.json').write_text(json.dumps(images, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
