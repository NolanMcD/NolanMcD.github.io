"""Verify the Letterboxd export importer and the published rating counts."""
import csv
import json
from collections import Counter
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class RatingDistributionTests(unittest.TestCase):
    def test_export_matches_published_distribution(self):
        export = ROOT / 'local-data/ratings.csv'
        if not export.exists():
            export = ROOT / 'ratings.csv'
        if not export.exists():
            self.skipTest('The raw personal ratings export is kept local.')
        with export.open(encoding='utf-8-sig', newline='') as source:
            films = {row['Letterboxd URI']: int(row['Rating']) for row in csv.DictReader(source)}
        counts = Counter(films.values())
        published = json.loads((ROOT / 'assets/data/rating-distribution.json').read_text(encoding='utf-8'))
        self.assertEqual(published['source'], 'letterboxd-ratings-export')
        self.assertEqual(published['total'], len(films))
        self.assertEqual({row['rating']: row['count'] for row in published['ratings']}, {rating: counts[rating] for rating in range(1, 6)})
        self.assertEqual(published['average'], round(sum(films.values()) / len(films), 2))
        self.assertEqual(published['mostCommon'], min(counts, key=lambda rating: (-counts[rating], rating)))

    def test_published_totals_and_statistics_reconcile(self):
        published = json.loads((ROOT / 'assets/data/rating-distribution.json').read_text(encoding='utf-8'))
        counts = {row['rating']: row['count'] for row in published['ratings']}
        self.assertEqual(set(counts), set(range(1, 6)))
        self.assertTrue(all(isinstance(n, int) and n >= 0 for n in counts.values()))
        total = sum(counts.values())
        self.assertGreater(total, 0)
        self.assertEqual(published['total'], total)
        self.assertEqual(published['average'], round(sum(rating * count for rating, count in counts.items()) / total, 2))
        self.assertEqual(published['mostCommon'], min(counts, key=lambda rating: (-counts[rating], rating)))

    def test_case_sensitive_uris_duplicate_updates_and_zero_bins(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / 'ratings.csv'
            output = directory / 'distribution.json'
            source.write_text('Date,Name,Year,Letterboxd URI,Rating\n2026-10-03,Film A,2020,https://boxd.it/aB,2\n2026-10-03,Film B,2020,https://boxd.it/ab,3\n2026-10-03,Film A,2020,https://boxd.it/aB,4\n', encoding='utf-8')
            shell = shutil.which('pwsh') or shutil.which('powershell')
            self.assertIsNotNone(shell, 'PowerShell is required for the import test')
            subprocess.run([shell, '-ExecutionPolicy', 'Bypass', '-File', str(ROOT / 'tools/sync-rating-distribution.ps1'), '-CsvPath', str(source), '-OutputPath', str(output)], check=True, capture_output=True)
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(result['total'], 2)
            self.assertEqual(result['average'], 3.5)
            self.assertEqual(result['mostCommon'], 3)
            self.assertEqual([row['count'] for row in result['ratings']], [0, 0, 1, 1, 0])


if __name__ == '__main__':
    unittest.main()
