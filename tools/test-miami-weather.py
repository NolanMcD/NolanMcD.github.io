"""Offline regression checks for weather dates, freshness and safe publication."""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('weather', Path(__file__).with_name('miami_weather.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
UTC = timezone.utc


class WeatherTests(unittest.TestCase):
    def setUp(self):
        self.config = w.config_for()
        self.now = datetime(2026, 7, 1, 11, 30, tzinfo=UTC)
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / '_data').mkdir()
        (self.root / '_data/miami_weather_settings.json').write_text(json.dumps(self.config))

    def tearDown(self):
        self.temp.cleanup()

    def forecast(self):
        return {'properties': {'updateTime': w.stamp(self.now), 'periods': [{'name': 'Today', 'startTime': w.stamp(self.now - timedelta(hours=1)), 'endTime': w.stamp(self.now + timedelta(hours=12)), 'isDaytime': True, 'temperature': 88, 'temperatureUnit': 'F', 'shortForecast': 'Showers', 'detailedForecast': 'Chance of showers.', 'windSpeed': '5 mph', 'windDirection': 'E'}]}}

    def sources(self):
        record = w.source_record('forecast', 'https://api.weather.gov/test', self.now, issued=w.stamp(self.now))
        record['data'] = w.official_forecast(self.forecast(), self.now, self.config)
        return {'forecast': record}

    def test_dst_windows_and_deadline(self):
        for date, utc_start in [('2026-07-01', 9), ('2026-01-01', 10), ('2026-03-08', 9), ('2026-11-01', 10)]:
            start = datetime.fromisoformat(date).replace(hour=utc_start, minute=30, tzinfo=UTC)
            self.assertEqual(w.schedule_action(start - timedelta(minutes=1), self.config), 'outside-window')
            self.assertEqual(w.schedule_action(start, self.config), 'publish')
            self.assertEqual(w.schedule_action(start + timedelta(hours=2), self.config), 'publish')
            self.assertEqual(w.schedule_action(start + timedelta(hours=5, minutes=1), self.config), 'outside-window')

    def test_local_date_and_duplicate(self):
        self.assertEqual(w.schedule_action(self.now, self.config, '2026-07-01'), 'already-published')
        self.assertEqual(w.schedule_action(self.now, self.config, '2026-07-01', manual=True), 'publish')
        midnight = datetime(2026, 7, 2, 2, tzinfo=UTC)
        text, meta = w.render_report(self.sources(), self.config, midnight, '/example')
        self.assertEqual(meta['report_date'], '2026-07-01')

    def test_freshness_rejects_stale_future_and_missing(self):
        for value in [None, 'invalid', w.stamp(self.now - timedelta(hours=7)), w.stamp(self.now + timedelta(hours=1))]:
            self.assertFalse(w.fresh(value, self.now, 6))
        data = self.forecast()
        data['properties']['updateTime'] = w.stamp(self.now - timedelta(hours=7))
        with self.assertRaises(w.SourceError):
            w.official_forecast(data, self.now, self.config)

    def test_forecast_must_cover_remaining_day(self):
        data = self.forecast()
        data['properties']['periods'][0]['endTime'] = w.stamp(self.now - timedelta(minutes=1))
        with self.assertRaises(w.SourceError):
            w.official_forecast(data, self.now, self.config)

    def test_expired_alerts_are_not_active_unknown_is_not_clear(self):
        properties = {'status': 'Actual', 'messageType': 'Alert', 'onset': w.stamp(self.now - timedelta(hours=1)), 'expires': w.stamp(self.now - timedelta(minutes=1)), 'event': 'Warning'}
        self.assertEqual(w.active_alerts([{'properties': properties}], self.now), [])
        properties['expires'] = None
        with self.assertRaises(w.SourceError):
            w.active_alerts([{'properties': properties}], self.now)
        text, _ = w.render_report(self.sources(), self.config, self.now, '/example')
        self.assertIn('alert check unavailable', text)
        self.assertNotIn('no active alerts returned', text)

    def test_effective_alert_with_future_hazard_onset_is_retained(self):
        properties = {'status': 'Actual', 'messageType': 'Alert', 'effective': w.stamp(self.now - timedelta(minutes=20)), 'onset': w.stamp(self.now + timedelta(hours=2)), 'expires': w.stamp(self.now + timedelta(hours=10)), 'event': 'Heat Advisory'}
        self.assertEqual(w.active_alerts([{'properties': properties}], self.now)[0]['event'], 'Heat Advisory')

    def test_source_text_cannot_be_html_or_liquid(self):
        self.assertEqual(w.escape('<script>{{ site.secret }}</script>'), '&lt;script&gt;&#123;&#123; site.secret &#125;&#125;&lt;/script&gt;')

    def test_optional_sources_fail_independently(self):
        payload = self.forecast()
        class Fake:
            def json(_, url, headers=None):
                if '/points/' in url:
                    return {'properties': {'forecast': 'https://api.weather.gov/gridpoints/MFL/110,50/forecast', 'forecastHourly': 'https://api.weather.gov/gridpoints/MFL/110,50/forecast/hourly'}}
                if url.endswith('/forecast') and '/gridpoints/' in url:
                    return payload
                raise w.SourceError('test source unavailable')
            def get(_, url, headers=None):
                raise w.SourceError('test source unavailable')
        sources = w.collect_sources(Fake(), self.config, self.now, self.root)
        self.assertEqual(sources['forecast']['availability'], 'available')
        self.assertEqual(sources['alerts']['availability'], 'unavailable')
        self.assertEqual(sources['regional_radar']['availability'], 'unavailable')
        text, metadata = w.render_report(sources, self.config, self.now, '/example')
        self.assertTrue(metadata['partial'])
        self.assertNotIn('no active alerts returned', text)

    def test_required_source_failure_retains_latest_and_releases_lock(self):
        pointer = self.root / '_data/miami_weather_latest.json'
        pointer.write_text('{"report_date":"2026-06-30"}')
        before = pointer.read_bytes()
        with patch.object(w, 'collect_sources', side_effect=w.SourceError('forecast stale')):
            with self.assertRaises(w.SourceError):
                w.run(self.root, manual=True, now=self.now)
        self.assertEqual(pointer.read_bytes(), before)
        self.assertFalse((self.root / 'local-data/miami-weather.lock').exists())
        self.assertFalse((self.root / '_miami_weather').exists())

    def test_rerun_updates_same_report_and_preserves_dated_assets(self):
        def stage():
            result = self.root / ('stage-' + w.uuid.uuid4().hex)
            result.mkdir()
            return result
        w.publish(self.root, stage(), self.sources(), self.config, self.now)
        w.publish(self.root, stage(), self.sources(), self.config, self.now + timedelta(minutes=15))
        self.assertEqual(len(list((self.root / '_miami_weather').glob('*.html'))), 1)
        self.assertEqual(len(list((self.root / 'assets/weather/2026-07-01').iterdir())), 2)
        self.assertEqual(w.latest_metadata(self.root)['generated_at'], w.stamp(self.now + timedelta(minutes=15)))
        with patch.object(w, 'collect_sources', side_effect=AssertionError('should skip all requests')):
            self.assertFalse(w.run(self.root, now=self.now))

    def test_bad_image_never_updates_pointer(self):
        staging = self.root / 'stage'
        staging.mkdir()
        (staging / 'bad.png').write_bytes(b'not an image')
        sources = self.sources()
        sources['forecast']['images'] = [{'filename': 'bad.png', 'sha256': 'incorrect'}]
        with self.assertRaises(w.SourceError):
            w.publish(self.root, staging, sources, self.config, self.now)
        self.assertFalse((self.root / '_data/miami_weather_latest.json').exists())

    def test_beach_guidance_is_only_miami_dade(self):
        text = 'FLZ168\nPalm Beach HIGH$$FLZ173\nMiami-Dade LOW$$FLZ172\nBroward HIGH'
        self.assertEqual(w.coastal_text(text), 'FLZ173\nMiami-Dade LOW')

    def test_satellite_follows_current_goes_product(self):
        url = 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/se/GEOCOLOR/20261821200_GOES19-ABI-se-GEOCOLOR-1200x1200.jpg'
        frames = w.satellite_frames(url)
        self.assertEqual(frames[0][2], '19')
        self.assertEqual(frames[0][0].tzinfo, UTC)

    def test_nhc_uses_item_issuance_not_feed_refresh(self):
        class Fake:
            def get(_, url):
                return b'<rss><channel><lastBuildDate>Wed, 01 Jul 2026 11:30:00 GMT</lastBuildDate><item><pubDate>Tue, 30 Jun 2026 11:30:00 GMT</pubDate><description>Tropical Weather Outlook</description></item></channel></rss>', {}, url
        with self.assertRaises(w.SourceError):
            w.collect_nhc(Fake(), self.config, self.now, self.root)


if __name__ == '__main__':
    unittest.main()
