"""Validate the built weather archive, latest pointer and archived image integrity."""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
built = Path(sys.argv[1] if len(sys.argv) > 1 else '_site')
latest_path = root / '_data/miami_weather_latest.json'
if not latest_path.exists():
    raise SystemExit('Weather latest metadata is missing')
latest = json.loads(latest_path.read_text(encoding='utf-8'))
assert (built / latest['url'].lstrip('/') / 'index.html').is_file(), 'Latest report was not built'
assert (built / 'miami-weather/index.html').is_file(), 'Weather archive was not built'
assert latest['report_date'] in (built / 'index.html').read_text(encoding='utf-8'), 'Homepage omits latest date'
count = 0
for path in root.glob('assets/weather/*/*/sources.json'):
    payload = json.loads(path.read_text(encoding='utf-8'))
    assert payload['sources']['forecast']['availability'] == 'available', 'Missing mandatory forecast'
    for source in payload['sources'].values():
        for item in source.get('images', []):
            image = path.parent / item['filename']
            assert image.parent == path.parent, 'Image path escapes asset directory'
            assert hashlib.sha256(image.read_bytes()).hexdigest() == item['sha256'], 'Archived image hash mismatch'
            with Image.open(image) as opened:
                opened.verify()
            assert (built / image.relative_to(root)).exists(), 'Image missing from built site'
            count += 1
print('Weather archive, homepage, metadata and {} archived images verified'.format(count))
