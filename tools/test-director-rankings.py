"""Check ranking arithmetic, tie semantics, data coverage, and source matching."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('director_builder', ROOT / 'tools/build-director-rankings.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class DirectorRankingsTests(unittest.TestCase):
    def test_published_snapshot(self):
        data = json.loads((ROOT / '_data/director_rankings.json').read_text(encoding='utf-8'))
        rows = data['directors']
        by_id = {d['id']: d for d in rows}
        self.assertEqual(len(rows), 18)
        self.assertEqual(data['filmCount'], 216)
        self.assertEqual(data['totalStars'], 759)
        self.assertEqual(rows[0]['name'], 'Steven Spielberg')
        self.assertEqual((rows[0]['total'], rows[0]['count']), (74, 21))
        self.assertEqual(by_id['hitchcock']['total'], 73)
        self.assertAlmostEqual(by_id['nolan']['average'], 54 / 13)
        self.assertEqual(by_id['nolan']['averageRank'], 1)
        self.assertEqual(by_id['kubrick']['total'], 39)
        self.assertEqual(by_id['kubrick']['averageRank'], 2)
        self.assertEqual(by_id['tarantino']['averageRank'], 3)
        self.assertEqual(by_id['weir']['averageRank'], 3)
        self.assertEqual(by_id['hitchcock']['averageRank'], 5)
        for d in rows:
            self.assertEqual(d['count'], len(d['films']))
            self.assertEqual(d['total'], sum(f['rating'] for f in d['films']))
            self.assertAlmostEqual(d['average'], d['total'] / d['count'])
            self.assertEqual(len({f['url'] for f in d['films']}), d['count'])
        images = json.loads((ROOT / '_data/director_images.json').read_text(encoding='utf-8'))
        self.assertEqual(set(images), set(by_id))
        for pair in images.values():
            for kind in ('portrait', 'poster'):
                self.assertTrue(pair[kind]['url'].startswith('https://'))
                self.assertTrue(pair[kind]['source'].startswith('https://'))

    def test_uri_match_and_missing_rating(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            for slug in builder.DIRECTORS:
                (folder / f'nolans-{slug}-rankings.csv').write_text(
                    'Letterboxd list export v7\nDate,Name,Tags,URL,Description\n'
                    '2026-11-05,Example,,https://boxd.it/list,\n\n'
                    'Position,Name,Year,URL,Description\n1,Alternate Title,2000,https://boxd.it/test,\n', encoding='utf-8')
            ratings = folder / 'ratings.csv'
            ratings.write_text('Date,Name,Year,Letterboxd URI,Rating\n2026-11-05,Original Title,2000,https://boxd.it/test,4.5\n', encoding='utf-8')
            data = builder.build(folder, ratings)
            self.assertTrue(all(d['average'] == 4.5 for d in data['directors']))
            self.assertTrue(all(d['totalRank'] == 1 for d in data['directors']))
            ratings.write_text('Date,Name,Year,Letterboxd URI,Rating\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Missing rating'):
                builder.build(folder, ratings)


if __name__ == '__main__':
    unittest.main()
