"""Miami weather collection and factual rendering. Network text is data, never code.

No AI key is required. Requests use verified NWS/NOAA services. Pillow is used
only to validate downloads and compose faithfully labeled NOAA radar layers.
"""
import argparse
import concurrent.futures
from datetime import datetime, timedelta, timezone, time as clock_time
from email.utils import parsedate_to_datetime
import hashlib
import html
from io import BytesIO
import json
import logging
import math
import os
from pathlib import Path
import re
import shutil
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
LOG = logging.getLogger('miami-weather')
UA = 'MorningMiamiWeatherReport/1.0'
WMS = {'w': 'http://www.opengis.net/wms'}
MAX_BYTES = 15_000_000


class SourceError(Exception):
    pass


def stamp(value):
    return value.astimezone(UTC).isoformat()


def parse_time(value):
    if not value:
        raise SourceError('Source did not provide a timestamp')
    dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise SourceError('Source timestamp lacks a timezone')
    return dt.astimezone(UTC)


def fresh(value, now, hours):
    try:
        age = now - parse_time(value)
        return -timedelta(minutes=5) <= age <= timedelta(hours=hours)
    except (ValueError, TypeError, SourceError):
        return False


def eastern(value, config):
    return parse_time(value).astimezone(ZoneInfo(config['timezone'])).strftime('%b %d, %Y · %I:%M %p %Z').replace(' 0', ' ')


def config_for(root=ROOT):
    config = json.loads((root / '_data/miami_weather_settings.json').read_text(encoding='utf-8'))
    ZoneInfo(config['timezone'])
    for key in ['start', 'catch_up_until']:
        clock_time.fromisoformat(config[key])
    if not config['start'] < config['catch_up_until']:
        raise ValueError('Require start < catch_up_until on the same local day')
    if not 1 <= config['interval_minutes'] <= 60:
        raise ValueError('interval_minutes must be between 1 and 60')
    if not 5 <= config['timeout_seconds'] <= 60 or not 1 <= config['retries'] <= 3:
        raise ValueError('Request bounds are invalid')
    return config


def schedule_action(now, config, published_date=None, manual=False):
    local = now.astimezone(ZoneInfo(config['timezone']))
    if manual:
        return 'publish'
    if published_date == local.date().isoformat():
        return 'already-published'
    minute = local.hour * 60 + local.minute
    def minutes(key):
        value = clock_time.fromisoformat(config[key])
        return value.hour * 60 + value.minute
    if minute < minutes('start') or minute > minutes('catch_up_until'):
        return 'outside-window'
    return 'publish'


def source_record(name, url, now, status='available', issued=None, reason=''):
    return {'id': name, 'url': url, 'retrieved_at': stamp(now), 'issued_at': issued,
            'availability': status, 'reason': reason, 'data': None, 'images': []}


class Client:
    def __init__(self, config):
        self.config = config

    def get(self, url, headers=None):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.username or parsed.password:
            raise SourceError('Only unauthenticated HTTPS source URLs are permitted')
        last = None
        for attempt in range(self.config['retries']):
            try:
                request = urllib.request.Request(url, headers={'User-Agent': UA, **(headers or {})})
                with urllib.request.urlopen(request, timeout=self.config['timeout_seconds']) as response:
                    data = response.read(MAX_BYTES + 1)
                    if len(data) > MAX_BYTES:
                        raise SourceError('Response exceeded the download limit')
                    return data, dict(response.headers), response.geturl()
            except urllib.error.HTTPError as error:
                last = SourceError('HTTP ' + str(error.code))
                if error.code in (400, 401, 403, 404):
                    break
            except (urllib.error.URLError, TimeoutError, OSError) as error:
                # Never log credentials, request headers, or an upstream response body.
                last = SourceError(type(error).__name__ + ': transport or certificate failure')
            if attempt + 1 < self.config['retries']:
                time.sleep(min(2 ** attempt, 4))
        raise last or SourceError('Source request failed')

    def json(self, url, headers=None):
        body, _, _ = self.get(url, {'Accept': 'application/geo+json, application/json', **(headers or {})})
        return json.loads(body.decode('utf-8'))


def safe_official(url, hostname='api.weather.gov'):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != hostname or parsed.username or parsed.password:
        raise SourceError('Unrecognized source link')
    return url


def plain(value):
    return html.unescape(re.sub(r'<[^>]*>', '', re.sub(r'<br\s*/?>', '\n', value, flags=re.I))).strip()


def collect_nhc(client, config, now, directory):
    record = source_record('nhc', config['sources']['nhc'], now)
    tree = ET.fromstring(client.get(record['url'])[0])
    items = tree.findall('./channel/item')
    dated = [(parsedate_to_datetime(item.findtext('pubDate')).astimezone(UTC), item) for item in items if item.findtext('pubDate')]
    if not dated:
        raise SourceError('NHC feed has no dated Atlantic outlook')
    when, item = max(dated, key=lambda pair: pair[0])
    if not fresh(stamp(when), now, config['nhc_max_age_hours']):
        raise SourceError('NHC outlook issuance is too old')
    text = plain(item.findtext('description') or '')
    if 'Tropical Weather Outlook' not in text:
        raise SourceError('NHC feed did not contain a tropical outlook')
    record.update(issued_at=stamp(when), data={'text': text, 'tropical_activity': not bool(re.search(r'(no tropical cyclones|tropical cyclone formation is not expected)', text, re.I))})
    # Discover the currently advertised graphic; never guess an outlook filename.
    try:
        page = client.get(config['sources']['nhc_page'])[0].decode('utf-8')
        links = re.findall(r'(?:src|href)=[\"\']([^\"\']+xgtwo_atl_7d0_w1024\.png)', page)
        if links:
            image_url = urllib.parse.urljoin(config['sources']['nhc_page'], html.unescape(links[0]))
            safe_official(image_url, 'www.nhc.noaa.gov')
            record['images'].append(save_image(client, image_url, directory, 'nhc-outlook', stamp(when), 'NOAA/National Hurricane Center · Atlantic seven-day outlook', now=now))
            record['images'][-1]['timestamp_note'] = 'Outlook feed issuance; graphic’s own timestamp is embedded in the original image.'
        else:
            record['reason'] = 'The current outlook graphic was not advertised; text outlook is available.'
    except (SourceError, ValueError) as error:
        record['reason'] = 'Outlook text available; graphic unavailable: ' + str(error)
    return record


def observe(client, now, config, url):
    data = client.json(url)['properties']
    if not fresh(data.get('timestamp'), now, config['observation_max_age_hours']):
        raise SourceError('Latest nearby observation is stale')
    temperature = data.get('temperature', {})
    temp = temperature.get('value')
    if temp is not None and temperature.get('unitCode') == 'wmoUnit:degC':
        temp = round(temp * 9 / 5 + 32)
    elif temperature.get('unitCode') != 'wmoUnit:degF':
        temp = None
    wind = data.get('windSpeed', {})
    speed = wind.get('value')
    factors = {'wmoUnit:km_h-1': 1 / 1.609344, 'wmoUnit:m_s-1': 2.236936, 'wmoUnit:kn': 1.150779, 'wmoUnit:mi_h-1': 1}
    speed = round(speed * factors[wind['unitCode']]) if speed is not None and wind.get('unitCode') in factors else None
    record = source_record('observation', url, now, issued=data['timestamp'])
    record['data'] = {'station': data.get('stationName', 'Nearby NWS observation'), 'condition': data.get('textDescription'), 'temperature_f': temp, 'wind_mph': speed}
    return record


def collect_sources(client, config, now, directory):
    point_url = 'https://api.weather.gov/points/' + str(config['latitude']) + ',' + str(config['longitude'])
    point = client.json(point_url)['properties']
    forecast_url = safe_official(point['forecast'])
    forecast_data = official_forecast(client.json(forecast_url), now, config)
    forecast = source_record('forecast', forecast_url, now, issued=forecast_data['issued_at'])
    forecast['data'] = forecast_data
    sources = {'forecast': forecast}
    def hourly():
        url = safe_official(point['forecastHourly'])
        payload = client.json(url)
        record = source_record('hourly', url, now, issued=payload['properties']['updateTime'])
        record['data'] = hourly_today(payload, now, config)
        return record
    def text_product(kind, key, max_age):
        data = product(client, kind, now, config, max_age)
        record = source_record(key, data['@id'], now, issued=data['issuanceTime'])
        record['data'] = {'text': data['productText']}
        return record
    def alerts(name, url):
        data = client.json(url)
        if not isinstance(data.get('features'), list):
            raise SourceError('Alert response did not contain an alert collection')
        record = source_record(name, url, now)
        record['data'] = active_alerts(data['features'], now)
        record['timestamp_note'] = 'Live active-alert query retrieved at the stated time; each retained alert has its own issuance and expiration.'
        return record
    def marine():
        url = 'https://api.weather.gov/zones/forecast/AMZ630/forecast'
        props = client.json(url)['properties']
        if not fresh(props.get('updated'), now, config['marine_max_age_hours']) or not props.get('periods'):
            raise SourceError('Biscayne Bay marine forecast is stale or missing')
        record = source_record('marine', url, now, issued=props['updated'])
        record['data'] = props['periods'][:3]
        return record
    def mcnoldy():
        url = config['sources']['mcnoldy']
        page = client.get(url)[0].decode('utf-8')
        record = source_record('mcnoldy', url, now, 'link-only', reason='Original image reuse has not been authorized; official KAMX imagery is used instead.')
        # Even if reachable, copyrighted third-party images need explicit permission.
        # A flag alone is not enough: an operator must configure a verified source image.
        if config.get('mcnoldy_reuse_authorized') and config.get('mcnoldy_image_url'):
            image_url = config['mcnoldy_image_url']
            safe_official(image_url, 'bmcnoldy.earth.miami.edu')
            if image_url not in page and urllib.parse.urlsplit(image_url).path not in page:
                raise SourceError('Authorized image URL is not present on the source page')
            image = save_image(client, image_url, directory, 'mcnoldy-radar', credit='Brian McNoldy / University of Miami; used with permission', now=now)
            if not image.get('last_modified') or not fresh(stamp(parsedate_to_datetime(image['last_modified'])), now, config['radar_max_age_minutes'] / 60):
                raise SourceError('Authorized McNoldy image lacks a recent Last-Modified time')
            image['timestamp_note'] = 'File update time; observation timestamp is retained in the original image.'
            record.update(availability='available', reason='', images=[image], issued_at=stamp(parsedate_to_datetime(image['last_modified'])))
        return record
    forecast_alerts = 'https://api.weather.gov/alerts/active?' + urllib.parse.urlencode({'point': str(config['latitude']) + ',' + str(config['longitude'])})
    coastal_alerts = 'https://api.weather.gov/alerts/active?zone=AMZ630,AMZ651,FLZ173'
    work = {
        'hourly': (hourly, point['forecastHourly']),
        'observation': (lambda: observe(client, now, config, 'https://api.weather.gov/stations/KMIA/observations/latest'), 'https://api.weather.gov/stations/KMIA/observations/latest'),
        'alerts': (lambda: alerts('alerts', forecast_alerts), forecast_alerts),
        'coastal_alerts': (lambda: alerts('coastal_alerts', coastal_alerts), coastal_alerts),
        'discussion': (lambda: text_product('AFD', 'discussion', config['discussion_max_age_hours']), 'https://api.weather.gov/products/types/AFD/locations/MFL'),
        'beach': (lambda: text_product('SRF', 'beach', config['beach_max_age_hours']), 'https://api.weather.gov/products/types/SRF/locations/MFL'),
        'marine': (marine, 'https://api.weather.gov/zones/forecast/AMZ630/forecast'),
        'satellite': (lambda: collect_satellite(client, config, now, directory), config['sources']['satellite']),
        'mcnoldy': (mcnoldy, config['sources']['mcnoldy']),
        'local_radar': (lambda: radar_image(client, config, now, directory, 'local_radar', [config['longitude'], config['latitude']], 9.0, config['sources']['local_wms'], 'kamx_sr_bref'), config['sources']['local_wms']),
        'regional_radar': (lambda: radar_image(client, config, now, directory, 'regional_radar', config['regional_center'], config['regional_zoom'], config['sources']['regional_wms'], 'conus_bref_qcd'), config['sources']['regional_wms']),
        'nhc': (lambda: collect_nhc(client, config, now, directory), config['sources']['nhc']),
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(fn): (name, url) for name, (fn, url) in work.items()}
        for future in concurrent.futures.as_completed(futures):
            name, url = futures[future]
            try:
                sources[name] = future.result()
                LOG.info('%s: %s', name, sources[name]['availability'])
            except Exception as error:
                sources[name] = source_record(name, url, now, 'unavailable', reason=str(error)[:240])
                LOG.warning('%s unavailable: %s', name, type(error).__name__)
    if sources['nhc']['availability'] == 'available' and sources['nhc']['data']['tropical_activity']:
        url = config['sources']['tropical_tidbits']
        try:
            client.get(url)
            sources['tropical_tidbits'] = source_record('tropical_tidbits', url, now, 'link-only', reason='Optional context only. Imagery is not copied: Tropical Tidbits reserves reuse rights.')
        except SourceError:
            sources['tropical_tidbits'] = source_record('tropical_tidbits', url, now, 'unavailable', reason='Supplementary site unavailable; the report uses NHC information.')
    else:
        sources['tropical_tidbits'] = source_record('tropical_tidbits', config['sources']['tropical_tidbits'], now, 'not-used', reason='No current tropical context requiring this supplementary source, or the NHC input is unavailable.')
        sources['tropical_tidbits']['retrieved_at'] = None
    return sources


def product(client, kind, now, config, max_age):
    listing = client.json('https://api.weather.gov/products/types/' + kind + '/locations/MFL').get('@graph', [])
    candidates = [item for item in listing if fresh(item.get('issuanceTime'), now, max_age)]
    if not candidates:
        raise SourceError('No sufficiently current Miami ' + kind + ' product')
    chosen = max(candidates, key=lambda item: parse_time(item['issuanceTime']))
    data = client.json(safe_official(chosen['@id']))
    if data.get('issuingOffice') != 'KMFL' or data.get('productCode') != kind:
        raise SourceError('Unexpected weather office or product')
    return data


def active_alerts(features, now):
    result = []
    for feature in features:
        properties = feature.get('properties', {})
        if properties.get('status') != 'Actual' or properties.get('messageType') == 'Cancel':
            continue
        try:
            end = parse_time(properties.get('ends') or properties.get('expires'))
            start = parse_time(properties.get('effective') or properties.get('onset'))
            if properties.get('status') == 'Actual' and properties.get('messageType') != 'Cancel' and start <= now < end:
                result.append({key: properties.get(key) for key in ['event', 'headline', 'description', 'instruction', 'severity', 'sent', 'onset', 'expires', 'ends']})
        except (ValueError, SourceError):
            raise SourceError('An active alert lacks verifiable validity times')
    return result


def official_forecast(data, now, config):
    properties = data.get('properties', {})
    issued = properties.get('updateTime')
    if not fresh(issued, now, config['forecast_max_age_hours']):
        raise SourceError('Official forecast is missing, future-dated, or too old')
    zone = ZoneInfo(config['timezone'])
    local = now.astimezone(zone)
    tomorrow = datetime.combine(local.date() + timedelta(days=1), clock_time(), tzinfo=zone)
    periods = [period for period in properties.get('periods', []) if parse_time(period['endTime']) > now and parse_time(period['startTime']) < tomorrow]
    if not periods:
        raise SourceError('Official forecast does not cover the remaining local day')
    chosen = next((period for period in periods if period.get('isDaytime')), periods[0])
    if chosen.get('temperatureUnit') != 'F' or not isinstance(chosen.get('temperature'), (int, float)) or not chosen.get('detailedForecast'):
        raise SourceError('Official forecast lacks usable Fahrenheit forecast data')
    return {'issued_at': issued, 'period': chosen, 'periods': periods}


def hourly_today(data, now, config):
    if not fresh(data.get('properties', {}).get('updateTime'), now, config['forecast_max_age_hours']):
        raise SourceError('Hourly forecast is stale')
    zone = ZoneInfo(config['timezone'])
    today = now.astimezone(zone).date()
    return [period for period in data['properties']['periods'] if parse_time(period['endTime']) > now and parse_time(period['startTime']).astimezone(zone).date() == today][:18]


def save_image(client, url, directory, stem, observed=None, credit='', limit_hours=None, now=None):
    if observed and limit_hours is not None and not fresh(observed, now, limit_hours):
        raise SourceError('Image observation is too old or future-dated')
    raw, headers, resolved = client.get(url)
    try:
        image = Image.open(BytesIO(raw))
        image.verify()
        image = Image.open(BytesIO(raw))
        if image.width < 150 or image.height < 20 or image.width * image.height > 30_000_000:
            raise SourceError('Image dimensions failed validation')
        suffix = {'JPEG': '.jpg', 'PNG': '.png', 'GIF': '.gif'}.get(image.format)
        if not suffix:
            raise SourceError('Unsupported image encoding')
    except (UnidentifiedImageError, OSError) as error:
        raise SourceError('Source did not return valid imagery') from error
    name = stem + '-' + hashlib.sha256(raw).hexdigest()[:10] + suffix
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_bytes(raw)
    return {'filename': name, 'source_url': resolved, 'observed_at': observed, 'retrieved_at': stamp(now),
            'credit': credit, 'width': image.width, 'height': image.height,
            'sha256': hashlib.sha256(raw).hexdigest(), 'last_modified': headers.get('Last-Modified')}


def satellite_frames(text):
    urls = sorted(set(re.findall(r'https://cdn\.star\.nesdis\.noaa\.gov/GOES\d+/ABI/SECTOR/se/GEOCOLOR/\d{11}_GOES\d+-ABI-se-GEOCOLOR-1200x1200\.jpg', text)))
    frames = []
    for url in urls:
        match = re.search(r'/(\d{11})_GOES(\d+)', url)
        observed = datetime.strptime(match[1], '%Y%j%H%M').replace(tzinfo=UTC)
        frames.append((observed, url, match[2]))
    return sorted(frames)


def collect_satellite(client, config, now, directory):
    url = config['sources']['satellite']
    record = source_record('satellite', url, now)
    text = client.get(url)[0].decode('utf-8')
    frames = [frame for frame in satellite_frames(text) if fresh(stamp(frame[0]), now, config['satellite_max_age_hours'])]
    if not frames:
        raise SourceError('No recent timestamped Southeast GeoColor frames on the source page')
    selected = sorted({0, len(frames) // 2, len(frames) - 1})
    for index in selected:
        when, image_url, satellite = frames[index]
        record['images'].append(save_image(client, image_url, directory, 'satellite-' + when.strftime('%H%M'), stamp(when), 'CIRA/NOAA · GOES-' + satellite + ' Southeast GeoColor', now=now))
    record.update(issued_at=stamp(frames[-1][0]), data={'satellite': 'GOES-' + frames[-1][2]})
    return record


def projected(lon, lat):
    return (6378137 * math.radians(lon), 6378137 * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def radar_bounds(center, zoom, width=1000, height=650):
    x, y = projected(*center)
    resolution = 156543.03392804097 / (2 ** zoom)
    return (x - width * resolution / 2, y - height * resolution / 2, x + width * resolution / 2, y + height * resolution / 2)


def wms_times(xml, layer):
    tree = ET.fromstring(xml)
    for element in tree.findall('.//w:Layer', WMS):
        if element.findtext('w:Name', namespaces=WMS) == layer:
            dimension = next((d for d in element.findall('w:Dimension', WMS) if d.get('name') == 'time'), None)
            if dimension is None:
                raise SourceError('Radar layer has no observation times')
            return sorted({parse_time(value) for value in (dimension.text or '').split(',') if '/' not in value})
    raise SourceError('Requested radar layer was not advertised')


def echo_regions(image, legend, bounds, center):
    # Match actual colors from the downloaded legend, not a guessed reflectivity scale.
    palette = set()
    for count, rgba in legend.convert('RGBA').getcolors(legend.width * legend.height) or []:
        if count >= 8 and rgba[3] > 100 and max(rgba[:3]) - min(rgba[:3]) > 70:
            palette.add(rgba[:3])
    if len(palette) < 3:
        return []
    x, y = projected(*center)
    px = (x - bounds[0]) / (bounds[2] - bounds[0]) * image.width
    py = (bounds[3] - y) / (bounds[3] - bounds[1]) * image.height
    counts = {}
    pixels = image.convert('RGBA').load()
    for row in range(0, image.height, 2):
        for col in range(0, image.width, 2):
            rgba = pixels[col, row]
            if rgba[3] < 100 or rgba[:3] not in palette:
                continue
            dx, dy = col - px, py - row
            if abs(dx) < 15 and abs(dy) < 15:
                name = 'near Miami'
            else:
                angle = (math.degrees(math.atan2(dx, dy)) + 360) % 360
                name = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][int((angle + 22.5) // 45) % 8] + ' of Miami'
            counts[name] = counts.get(name, 0) + 1
    return [key for key, count in sorted(counts.items(), key=lambda item: -item[1]) if count >= 20][:3]


def radar_image(client, config, now, directory, kind, center, zoom, wms_url, layer):
    record = source_record(kind, wms_url, now)
    capabilities = client.get(wms_url + '?' + urllib.parse.urlencode({'service': 'WMS', 'request': 'GetCapabilities'}))[0]
    times = [when for when in wms_times(capabilities, layer) if fresh(stamp(when), now, config['radar_max_age_minutes'] / 60)]
    if not times:
        raise SourceError('No recent radar observations advertised')
    selected = sorted({0, len(times) // 2, len(times) - 1})
    bounds = radar_bounds(center, zoom)
    common = {'service': 'WMS', 'version': '1.1.1', 'request': 'GetMap', 'layers': layer,
              'srs': 'EPSG:3857', 'bbox': ','.join(str(value) for value in bounds), 'width': 1000,
              'height': 650, 'format': 'image/png', 'transparent': 'true'}
    legend_url = wms_url + '?' + urllib.parse.urlencode({'service': 'WMS', 'request': 'GetLegendGraphic', 'version': '1.3.0', 'format': 'image/png', 'layer': layer, 'width': 500, 'height': 30})
    legend_record = save_image(client, legend_url, directory, kind + '-legend', credit='NOAA/NWS radar reflectivity legend', now=now)
    legend = Image.open(directory / legend_record['filename']).convert('RGBA')
    base_url = config['sources']['basemap'] + '/export?' + urllib.parse.urlencode({'f': 'image', 'bbox': common['bbox'],
        'bboxSR': 3857, 'imageSR': 3857, 'size': '1000,650', 'format': 'png32', 'transparent': 'true', 'layers': 'show:3'})
    base_record = save_image(client, base_url, directory, kind + '-map', credit='NOAA/NWS state-border reference map', now=now)
    base = Image.open(directory / base_record['filename']).convert('RGBA')
    if base.size != (1000, 650):
        raise SourceError('Basemap size mismatch')
    for index in selected:
        when = times[index]
        map_url = wms_url + '?' + urllib.parse.urlencode({**common, 'time': stamp(when).replace('+00:00', 'Z')})
        raw_record = save_image(client, map_url, directory, kind + '-raw-' + when.strftime('%H%M'), stamp(when), 'NOAA/NWS radar', now=now)
        raw = Image.open(directory / raw_record['filename']).convert('RGBA')
        if raw.size != base.size:
            raise SourceError('Radar image size mismatch')
        canvas = Image.new('RGBA', (1000, 800), '#f4f5f0')
        canvas.alpha_composite(base, (0, 45)); canvas.alpha_composite(raw, (0, 45))
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.load_default()
        for font_path in ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
            if Path(font_path).exists():
                font = ImageFont.truetype(font_path, 17)
                break
        draw.text((16, 12), ('Miami KAMX' if kind == 'local_radar' else 'South Florida regional') + ' radar · ' + eastern(stamp(when), config), fill='#202526', font=font)
        for label, lon, lat in [('Miami / Brickell', config['longitude'], config['latitude']), ('West Palm Beach', -80.0534, 26.7153), ('Key West', -81.78, 24.555)]:
            x, y = projected(lon, lat)
            x = (x - bounds[0]) / (bounds[2] - bounds[0]) * 1000
            y = (bounds[3] - y) / (bounds[3] - bounds[1]) * 650 + 45
            if 10 < x < 860 and 65 < y < 675:
                draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill='#171e27')
                draw.text((x + 7, y - 8), label, fill='#171e27', stroke_width=1, stroke_fill='#ffffff', font=font)
        legend.thumbnail((850, 42))
        canvas.alpha_composite(legend, (16, 750))
        draw.text((16, 715), 'Reflectivity (dBZ) · NOAA/NWS · Echoes can include non-rain returns. No motion extrapolation.', fill='#202526', font=font)
        name = kind + '-' + when.strftime('%H%M') + '.png'
        canvas.convert('RGB').save(directory / name)
        digest = hashlib.sha256((directory / name).read_bytes()).hexdigest()
        image_record = {**raw_record, 'filename': name, 'width': 1000, 'height': 800, 'sha256': digest,
            'original_image': raw_record,
            'credit': 'NOAA/NWS radar and map reference · Composed by Noland; timestamp and original legend retained',
            'basemap_url': base_url, 'legend_url': legend_url, 'bounds_epsg3857': bounds, 'center': center, 'zoom': zoom}
        record['images'].append(image_record)
        if index == selected[-1]:
            record['data'] = {'echo_regions': echo_regions(raw, legend, bounds, [config['longitude'], config['latitude']])}
    record['issued_at'] = stamp(times[-1])
    return record


def escape(value):
    # Source text must not become HTML or a Liquid template during Jekyll's build.
    return html.escape(str(value)).replace('{', '&#123;').replace('}', '&#125;')


def coastal_text(text):
    blocks = text.split('$$')
    return next((block.strip() for block in blocks if re.search(r'\bFLZ173\b', block)), None)


def render_report(sources, config, now, asset_url, preview=False):
    date = now.astimezone(ZoneInfo(config['timezone'])).date().isoformat()
    period = sources['forecast']['data']['period']
    summary = '{}: {}°F. {}. Wind {} {}.'.format(period['name'], period['temperature'], period.get('shortForecast') or 'Forecast available', period.get('windSpeed') or 'not supplied', period.get('windDirection') or '')
    probability = period.get('probabilityOfPrecipitation', {}).get('value')
    if isinstance(probability, (int, float)):
        summary += ' Rain chance: {}%.'.format(probability)
    headline = 'Miami, {} — {}'.format(now.astimezone(ZoneInfo(config['timezone'])).strftime('%B %-d') if os.name != 'nt' else now.astimezone(ZoneInfo(config['timezone'])).strftime('%B %d').replace(' 0', ' '), period.get('shortForecast', 'daily forecast'))
    images = sources.get('satellite', {}).get('images', []) or sources.get('regional_radar', {}).get('images', [])
    metadata = {'report_date': date, 'generated_at': stamp(now), 'publication_time': eastern(stamp(now), config), 'title': headline,
                'summary': summary, 'url': '/miami-weather/' + date + '/', 'image': asset_url + '/' + images[-1]['filename'] if images else None,
                'image_alt': 'Latest archived NOAA satellite frame' if sources.get('satellite', {}).get('images') else 'Timestamped NOAA South Florida radar',
                'manual_preview': preview, 'partial': any(s['availability'] in ('unavailable', 'missing') for key, s in sources.items() if key not in ('tropical_tidbits', 'mcnoldy'))}
    front = {'layout': 'miami-weather', 'title': headline, 'date': stamp(now), 'description': summary, **metadata}
    out = ['---'] + [key + ': ' + json.dumps(value, ensure_ascii=False) for key, value in front.items()] + ['---', '<article class="weather-report" data-weather-date="' + date + '">']
    out.append('<p class="weather-notice">Automated weather summary from official sources; factual templates with validated source timestamps. Follow <a href="https://www.weather.gov/mfl/">NWS Miami</a> and <a href="https://www.nhc.noaa.gov/">NHC</a> for current guidance.</p>')
    if preview:
        out.append('<p class="weather-notice">Manual setup preview. These are real source data from the publication time below.</p>')
    if now.astimezone(ZoneInfo(config['timezone'])).strftime('%H:%M') > '10:30':
        out.append('<p class="weather-notice">Late report: current weather data were collected at the publication time below, rather than early this morning.</p>')
    out.append('<p class="weather-meta">Report date: ' + date + ' · Published ' + escape(metadata['publication_time']) + '</p><p class="weather-stale" data-weather-stale hidden></p>')
    out.append('<h2>Forecast for Miami / Brickell</h2><p class="weather-lede">' + escape(summary) + '</p><p>' + escape(period['detailedForecast']) + '</p><p class="weather-meta">Forecast issued ' + escape(eastern(sources['forecast']['issued_at'], config)) + '. Forecast values, not observed conditions.</p>')
    for extra in sources['forecast']['data']['periods']:
        if extra != period:
            out.append('<p><strong>' + escape(extra['name']) + ':</strong> ' + escape(extra['detailedForecast']) + '</p>')
    hourly = sources.get('hourly', {})
    if hourly.get('availability') == 'available' and hourly.get('data'):
        out.append('<details><summary>Hourly forecast — rain chances and timing</summary><div class="weather-table"><table><thead><tr><th>Eastern time</th><th>Temperature</th><th>Rain chance</th><th>Wind</th><th>Forecast</th></tr></thead><tbody>')
        for hour in hourly['data']:
            probability = hour.get('probabilityOfPrecipitation', {}).get('value')
            out.append('<tr><td>' + escape(eastern(hour['startTime'], config)) + '</td><td>' + escape(str(hour.get('temperature', '—')) + '°' + hour.get('temperatureUnit', 'F')) + '</td><td>' + (str(probability) + '%' if isinstance(probability, (int, float)) else 'Not supplied') + '</td><td>' + escape(hour.get('windSpeed', 'Not supplied') + ' ' + hour.get('windDirection', '')) + '</td><td>' + escape(hour.get('shortForecast', 'Not supplied')) + '</td></tr>')
        out.append('</tbody></table></div></details>')
    obs = sources.get('observation', {})
    out.append('<h2>Observed nearby</h2>')
    if obs.get('availability') == 'available':
        data = obs['data']
        out.append('<p>Miami International Airport (KMIA), ' + escape(eastern(obs['issued_at'], config)) + ': ' + escape(data.get('condition') or 'Condition not supplied') + '. Temperature ' + (str(data['temperature_f']) + '°F' if data['temperature_f'] is not None else 'not supplied') + '; wind ' + (str(data['wind_mph']) + ' mph' if data['wind_mph'] is not None else 'not supplied') + '. This airport observation does not measure conditions at your exact location in Brickell.</p>')
    else:
        out.append('<p>A sufficiently fresh nearby observation was unavailable. No current conditions are inferred.</p>')
    out.append('<h2>Alerts and outdoor plans</h2>')
    for name, label in [('alerts', 'Miami / Brickell'), ('coastal_alerts', 'Biscayne Bay and the Miami-Dade coast')]:
        record = sources.get(name, {})
        if record.get('availability') != 'available':
            out.append('<p>' + label + ': alert check unavailable; check NWS before heading out.</p>')
        elif not record['data']:
            out.append('<p>' + label + ': no active alerts returned by the official query at collection time. This is not a statement that conditions are safe.</p>')
        else:
            for alert in record['data']:
                out.append('<div class="weather-notice"><strong>' + escape(alert.get('headline') or alert['event']) + '</strong><p>' + escape(alert.get('instruction') or alert.get('description') or 'See official alert guidance.') + '</p></div>')
    out.append('<p><strong>Running:</strong> Use the temperature, rain and wind forecast above to plan your window. If thunderstorms are forecast or you hear thunder, postpone outdoor activity and seek a substantial building. This briefing does not certify a safe running window.</p>')
    marine = sources.get('marine', {})
    if marine.get('availability') == 'available':
        out.append('<h3>Paddleboarding — official Biscayne Bay forecast</h3>')
        for value in marine['data']:
            # Marine products use knots. Show the source unchanged and supply the unit conversion.
            text = re.sub(r'\b(\d+)\s*kt\b', lambda match: match.group(0) + ' (' + str(round(int(match.group(1)) * 1.150779)) + ' mph)', value['detailedForecast'])
            out.append('<p><strong>' + escape(value['name']) + ':</strong> ' + escape(text) + '</p>')
        out.append('<p>Wind speeds in the source use knots (1 knot = 1.151 mph). Check current marine alerts and local conditions before launching; no safe launch window is inferred.</p>')
    else:
        out.append('<p><strong>Paddleboarding:</strong> Fresh Biscayne Bay marine guidance was unavailable. Check the official marine forecast before launching.</p>')
    beach = sources.get('beach', {})
    coastal = coastal_text(beach['data']['text']) if beach.get('availability') == 'available' else None
    if coastal:
        out.append('<details><summary>Official coastal Miami-Dade beach and rip-current guidance</summary><pre>' + escape(coastal) + '</pre></details>')
    else:
        out.append('<p>Current Miami-Dade beach guidance could not be isolated; no rip-current risk is assumed.</p>')
    out.append('<h2>Satellite and radar</h2><p>Archived frames show what the instruments captured at their labeled times. Radar echoes can include non-rain returns. No movement or future arrival is inferred automatically from these frames.</p>')
    local_key = 'mcnoldy' if sources.get('mcnoldy', {}).get('availability') == 'available' and sources['mcnoldy'].get('images') else 'local_radar'
    local_title = 'Detailed Miami radar — Brian McNoldy' if local_key == 'mcnoldy' else 'Detailed Miami radar — official KAMX fallback'
    for key, title in [('satellite', 'Southeast GeoColor satellite'), (local_key, local_title), ('regional_radar', 'Regional South Florida radar')]:
        record = sources.get(key, {})
        out.append('<h3>' + title + '</h3>')
        if not record.get('images'):
            out.append('<p>Current imagery unavailable. Missing radar is not evidence of clear skies.</p>')
            continue
        if key == 'satellite':
            out.append('<p>GeoColor shows the Southeast, including Florida. The timestamped sequence below preserves cloud detail without automatically interpreting cloud cover at street level.</p>')
        else:
            regions = (record.get('data') or {}).get('echo_regions', [])
            out.append('<p>' + (escape('Colored reflectivity echoes are concentrated ' + ', '.join(regions) + ' relative to Miami in the latest frame. These are echo locations, not confirmation of rain at the surface.') if regions else 'The automatic echo-location check could not assign a reliable region. Inspect the image; this does not mean conditions are clear.') + '</p>')
        for frame_index, image in enumerate(reversed(record['images'])):
            if frame_index == 1:
                out.append('<details><summary>Earlier timestamped frames</summary>')
            url = asset_url + '/' + image['filename']
            when = eastern(image['observed_at'], config) if image.get('observed_at') else 'Timestamp embedded in source image'
            out.append('<figure class="weather-figure"><a href="' + url + '"><img src="' + url + '" width="' + str(image['width']) + '" height="' + str(image['height']) + '" loading="lazy" alt="' + escape(title + ' at ' + when + '; open full-size image for map and legend') + '"></a><figcaption>' + escape(when + ' · ' + image['credit']) + ' · <a href="' + escape(image['source_url']) + '">Original source</a> · <a href="' + url + '">Open full size</a></figcaption></figure>')
        if len(record['images']) > 1:
            out.append('</details>')
    for key, title in [('nhc', 'Tropical outlook'), ('discussion', 'Miami forecast discussion')]:
        record = sources.get(key, {})
        out.append('<h2>' + title + '</h2>')
        if record.get('availability') != 'available':
            out.append('<p>' + escape(record.get('reason', 'Current source unavailable.')) + '</p>')
            continue
        out.append('<p class="weather-meta">Issued ' + escape(eastern(record['issued_at'], config)) + ' · <a href="' + escape(record['url']) + '">Official source</a></p>')
        if key == 'nhc':
            out.append('<p>The Atlantic outlook describes development potential, not a forecast of impacts in Miami. No local hurricane impact is inferred here.</p>')
            for image in record['images']:
                url = asset_url + '/' + image['filename']
                out.append('<figure class="weather-figure"><a href="' + url + '"><img src="' + url + '" width="' + str(image['width']) + '" height="' + str(image['height']) + '" loading="lazy" alt="NHC Atlantic seven-day outlook; issuance timestamp and probability legend embedded in graphic"></a><figcaption>NOAA / NHC. ' + escape(image.get('timestamp_note', '')) + ' <a href="' + url + '">Open full size</a></figcaption></figure>')
        out.append('<details><summary>Read official source text</summary><pre>' + escape(record['data']['text']) + '</pre></details>')
    out.append('<h2>Sources and freshness</h2><p>Supplementary failures do not replace missing data with reassuring conclusions. All source times below are Eastern; source metadata and original downloads are archived with this report.</p><div class="weather-source-list">')
    for key in sorted(sources):
        record = sources[key]
        out.append('<details><summary>' + escape(key.replace('_', ' ').title() + ' · ' + record['availability']) + '</summary><p><a href="' + escape(record['url']) + '">Source</a>. Retrieved ' + escape(eastern(record['retrieved_at'], config) if record.get('retrieved_at') else 'not retrieved') + '. ' + ('Issued ' + escape(eastern(record['issued_at'], config)) + '. ' if record.get('issued_at') else '') + escape(record.get('reason', '')) + '</p></details>')
    out.append('</div><p><a href="' + asset_url + '/sources.json">Download source metadata</a> · <a href="/miami-weather/">Browse all reports</a></p></article>')
    return '\n'.join(out) + '\n', metadata


def latest_metadata(root):
    path = root / '_data/miami_weather_latest.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def publish(root, staging, sources, config, now, preview=False):
    date = now.astimezone(ZoneInfo(config['timezone'])).date().isoformat()
    revision = now.strftime('%H%M%S') + '-' + uuid.uuid4().hex[:8]
    asset_relative = Path('assets/weather') / date / revision
    asset_url = '/' + asset_relative.as_posix()
    text, metadata = render_report(sources, config, now, asset_url, preview)
    (staging / 'sources.json').write_text(json.dumps({'collected_at': stamp(now), 'sources': sources}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Validate all source image bytes before moving the complete dated asset directory.
    for record in sources.values():
        for item in record.get('images', []):
            path = staging / item['filename']
            if path.parent != staging or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                raise SourceError('Staged image failed integrity validation')
            with Image.open(path) as image:
                image.verify()
    target_assets = root / asset_relative
    target_assets.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(staging), str(target_assets))
    report_path = root / '_miami_weather' / (date + '.html')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_temp = report_path.with_suffix('.tmp')
    report_temp.write_text(text, encoding='utf-8')
    os.replace(report_temp, report_path)
    pointer = root / '_data/miami_weather_latest.json'
    pointer.parent.mkdir(parents=True, exist_ok=True)
    # A historical manual run must not move the homepage backward.
    previous = latest_metadata(root)
    if previous.get('report_date', '') <= date:
        pointer_temp = pointer.with_suffix('.tmp')
        pointer_temp.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.replace(pointer_temp, pointer)
    return metadata


def run(root=ROOT, manual=False, preview_dir=None, now=None, client=None):
    now = now or datetime.now(UTC)
    config = config_for(root)
    date = now.astimezone(ZoneInfo(config['timezone'])).date().isoformat()
    published = date if (root / '_miami_weather' / (date + '.html')).exists() else latest_metadata(root).get('report_date')
    action = schedule_action(now, config, published, manual or preview_dir is not None)
    if action in ('already-published', 'outside-window'):
        LOG.info(action)
        return False
    client = client or Client(config)
    lock = root / 'local-data/miami-weather.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        handle = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SourceError('Another local publication holds the lock; verify it has stopped before removing local-data/miami-weather.lock')
    os.close(handle)
    staging = Path(tempfile.mkdtemp(prefix='miami-weather-', dir=str(root / 'local-data')))
    try:
        sources = collect_sources(client, config, now, staging)
        destination = Path(preview_dir) if preview_dir else root
        if preview_dir:
            destination.mkdir(parents=True, exist_ok=True)
        local_clock = now.astimezone(ZoneInfo(config['timezone'])).strftime('%H:%M')
        outside_morning = not config['start'] <= local_clock <= config['catch_up_until']
        metadata = publish(destination, staging, sources, config, now, preview=preview_dir is not None or (manual and outside_morning))
        LOG.info('Published %s at %s', metadata['report_date'], destination)
        return True
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manual', action='store_true', help='Publish now, replacing the same local date if present')
    parser.add_argument('--preview-dir', type=Path, help='Collect real data into a separate preview directory')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    try:
        changed = run(manual=args.manual, preview_dir=args.preview_dir)
    except Exception as error:
        LOG.error('Publication stopped; previous latest report retained: %s', str(error))
        return 1
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as handle:
            handle.write('changed=' + str(changed).lower() + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
