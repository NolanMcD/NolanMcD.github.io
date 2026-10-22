"""Guard against outcome-biased sampling, invented truth labels, and bad phase math."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('validation', ROOT / 'tools/validate-blanket.py')
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


class ValidationTests(unittest.TestCase):
    def pairs(self, size=100):
        return pd.DataFrame({'game_id': np.arange(size), 'play_id': 1, 'nfl_id': 2, 'receiver_id': 3,
                             'mean_separation': np.arange(size) / 20, 'throw_separation': .5,
                             'snap_cushion': 3.5, 'blanket': np.arange(size) < 20, 'route': 'TEST'})

    def frame(self):
        t = np.arange(41) / 10
        angle = np.r_[np.zeros(16), np.linspace(0, 100, 9), np.full(16, 100.)]
        return pd.DataFrame({'time': pd.date_range('2026-01-01', periods=41, freq='100ms'),
                             's': 2 + 2 * np.minimum(abs(t - 2), 1), 'dir': angle,
                             'x': t, 'y': np.sin(t)})

    def test_random_sample_does_not_depend_on_outcomes_or_row_order(self):
        pairs = self.pairs()
        a = validation.review_sample(pairs)
        pairs.mean_separation = pairs.mean_separation.iloc[::-1].to_numpy()
        pairs.blanket = ~pairs.blanket
        b = validation.review_sample(pairs.sample(frac=1, random_state=99))
        self.assertEqual(a.game_id.tolist(), b.game_id.tolist())
        self.assertEqual(len(a), 80)
        self.assertFalse(a.duplicated(validation.KEYS).any())

    def test_no_labels_means_pending_not_zero_accuracy(self):
        result = validation.assess_labels(self.pairs(5), {})
        self.assertEqual(result['pending'], 5)
        self.assertEqual(result['confirmed'], 0)
        self.assertIsNone(result['confirmed_share_of_sample'])

    def test_tracking_annotations_cannot_confirm_assignments(self):
        label = {'verdict': 'confirmed', 'evidence_type': 'tracking', 'reviewer': 'test',
                 'source': 'trajectory plot', 'note': 'Looks close'}
        with self.assertRaises(ValueError):
            validation.assess_labels(self.pairs(1), {'0/1/2/3': label})
        label['evidence_type'] = 'film'
        label['source'] = ''
        with self.assertRaises(ValueError):
            validation.assess_labels(self.pairs(1), {'0/1/2/3': label})

    def test_unresolved_is_separate_from_incorrect_and_missing(self):
        label = {'verdict': 'unresolved', 'evidence_type': 'film', 'reviewer': 'fixture',
                 'source': 'synthetic test fixture', 'note': 'Responsibility ambiguous'}
        result = validation.assess_labels(self.pairs(2), {'0/1/2/3': label})
        self.assertEqual((result['unresolved'], result['incorrect'], result['pending']), (1, 0, 1))
        with self.assertRaises(ValueError):
            validation.assess_labels(self.pairs(2), {'999/1/2/3': label})

    def test_phase_wrap_rotation_and_translation_invariance(self):
        f = self.frame()
        original = validation.phase_variant(f)
        f['dir'] = (f.dir + 337) % 360
        f['x'] += 100
        f['y'] -= 200
        rotated = validation.phase_variant(f)
        for key in original:
            self.assertAlmostEqual(original[key], rotated[key], places=8)
        self.assertGreater(original['braking_loss'], 0)
        self.assertGreater(original['reacceleration'], 0)

    def test_invalid_time_or_geometry_rejected(self):
        f = self.frame()
        self.assertIsNone(validation.phase_variant(pd.concat([f, f.iloc[[2]]])))
        self.assertIsNone(validation.phase_variant(f.drop(index=[10, 11, 12])))
        f.loc[10, 'x'] = np.nan
        self.assertIsNone(validation.phase_variant(f))
        straight = self.frame()
        straight['dir'] = 0
        self.assertIsNone(validation.phase_variant(straight))

    def test_elapsed_time_detector_matches_published_on_regular_fixture(self):
        f = self.frame()
        # A unique maximum: the published detector has no explicit numerical-tie
        # policy, whereas the audit deliberately chooses the earliest tied time.
        f['dir'] = np.r_[np.zeros(16), [0., 1., 4., 12., 33., 68., 89., 97., 100.], np.full(16, 100.)]
        a, b = validation.expanded.phase_features(f), validation.phase_variant(f)
        for key in ['center_seconds', 'turn_speed', 'braking_loss', 'reacceleration']:
            self.assertAlmostEqual(a[key], b[key], places=8)

    def test_flat_maximum_has_rotation_invariant_tie_break(self):
        f = self.frame()
        a = validation.phase_variant(f)
        for rotation in [10, 45, 123, 337]:
            rotated = f.copy()
            rotated['dir'] = (rotated.dir + rotation) % 360
            self.assertEqual(a['center_seconds'], validation.phase_variant(rotated)['center_seconds'])

    def test_phase_annotation_boundaries_and_evidence(self):
        sample = [{'nfl_id': 1, 'drill': 'TEST', 'event_id': 'event', 'attempt': 1,
                   'seconds': [0, 1, 2, 3], 'detected_center': 2.0}]
        key = '1/TEST/event/1'
        label = {'verdict': 'annotated', 'evidence_type': 'film', 'reviewer': 'fixture',
                 'source': 'synthetic fixture', 'note': 'Annotated interval',
                 'phase_start_seconds': 1.8, 'phase_end_seconds': 2.2}
        result = validation.assess_phase_labels(sample, {key: label})
        self.assertEqual(result['detector_centers_inside_annotated_phase'], 1)
        label['phase_start_seconds'] = -1
        with self.assertRaises(ValueError):
            validation.assess_phase_labels(sample, {key: label})

    def test_application_boundaries_and_denominators(self):
        pairs = self.pairs(4)
        pairs.mean_separation = [.99, .99, 1., 1.]
        pairs.throw_separation = [.99, 1., .99, 2.]
        previous = validation.OUT
        try:
            with tempfile.TemporaryDirectory() as folder:
                validation.OUT = Path(folder)
                result = validation.application(pairs)
        finally:
            validation.OUT = previous
        self.assertEqual([c['reps'] for c in result['cells']], [1, 1, 1, 1])
        self.assertEqual(result['average_tight_only_flags'], 1)
        self.assertEqual(result['throw_tight_only_flags'], 1)
        self.assertEqual(result['late_gap_flags'], 0)
        self.assertEqual(sum(s['reps'] for s in result['cushion_strata']), 4)

    def test_public_audit_reconciles_and_contains_no_identifiers(self):
        data = json.loads((ROOT / '_data/blanket_validation.json').read_text(encoding='utf-8'))
        expanded = json.loads((ROOT / '_data/blanket_expanded.json').read_text(encoding='utf-8'))
        self.assertEqual(data['input_sha256'], expanded['input_sha256'])
        self.assertEqual(sum(c['reps'] for c in data['application']['cells']), expanded['screened_reps'])
        self.assertEqual(sum(s['reps'] for s in data['application']['cushion_strata']), expanded['screened_reps'])
        for d in data['phases']['drills']:
            self.assertEqual(len(d['variants']), 8)
            for v in d['variants']:
                self.assertLessEqual(v['paired_attempts'], d['attempts'])
                self.assertLessEqual(v['centers_shifted_over_point_two'], v['paired_attempts'])
                for correlation in v['player_rank_correlations'].values():
                    if correlation is not None:
                        self.assertTrue(-1.00000001 <= correlation <= 1.00000001)
        serialized = json.dumps(data)
        for private in ['nfl_id', 'receiver_id', 'game_id', 'play_id', 'event_id', 'display_name', 'sample_keys', 'reviewer', 'source', 'x', 'y']:
            self.assertNotIn('"' + private + '":', serialized)

    def test_baseline_median_excludes_the_held_out_target(self):
        p = pd.DataFrame({'nfl_id': np.arange(12), 'reps': 10, 'mean_separation': np.arange(12, dtype=float),
                          'forty': 4.5, 'combine_height': 72., 'combine_weight': 190., 'snap_cushion': 2.})
        expected = np.mean([abs(i - np.median(np.delete(np.arange(12), i))) for i in range(12)])
        result = validation.baseline_benchmarks(p)
        self.assertAlmostEqual(result['comparisons'][0]['mae'], expected)
        self.assertEqual(len(result['comparisons']), 4)
        # A low-workload player's extreme outcome must not change any fit.
        extra = p.iloc[[0]].assign(nfl_id=99, reps=1, mean_separation=10000.)
        self.assertEqual(result, validation.baseline_benchmarks(pd.concat([p, extra])))


if __name__ == '__main__':
    unittest.main()
