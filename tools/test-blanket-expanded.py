"""Check drill-phase math, fold-local model preprocessing, and public summaries."""
import importlib.util
import json
from pathlib import Path
import unittest
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('expanded',ROOT/'tools/expand-blanket.py')
expanded=importlib.util.module_from_spec(spec)
spec.loader.exec_module(expanded)


class ExpandedTests(unittest.TestCase):
    def frame(self,direction,speed=None):
        return pd.DataFrame({'time':pd.date_range('2026-01-01',periods=len(direction),freq='100ms'),
                             'dir':direction,'s':speed if speed is not None else np.full(len(direction),3.)})

    def test_straight_or_stationary_has_no_turn_feature(self):
        self.assertIsNone(expanded.phase_features(self.frame(np.zeros(41))))
        self.assertIsNone(expanded.phase_features(self.frame(np.linspace(0,90,41),np.zeros(41))))

    def test_heading_wrap_and_rotation_do_not_change_speed_features(self):
        heading=np.r_[np.full(15,350.),np.linspace(350,430,11),np.full(15,430.)]
        a=expanded.phase_features(self.frame(heading%360))
        b=expanded.phase_features(self.frame((heading+137)%360))
        self.assertIsNotNone(a)
        for name in ['turn_speed','braking_loss','reacceleration','heading_change_degrees']:
            self.assertAlmostEqual(a[name],b[name],places=8)
        self.assertEqual(a['turn_speed'],3)
        self.assertEqual(a['braking_loss'],0)
        self.assertEqual(a['reacceleration'],0)

    def test_braking_and_acceleration_window(self):
        t=np.arange(41)/10
        heading=np.r_[np.zeros(16),np.linspace(0,100,9),np.full(16,100.)]
        speed=2+2*np.minimum(np.abs(t-2),1)
        result=expanded.phase_features(self.frame(heading,speed))
        self.assertGreater(result['braking_loss'],0)
        self.assertGreater(result['reacceleration'],0)
        self.assertLess(result['pre_seconds'],result['turn_seconds'])
        self.assertGreater(result['post_seconds'],result['turn_seconds'])

    def test_ridge_fit_uses_training_scaling(self):
        prediction=expanded.ridge_predict(np.array([[0.],[1.],[2.]]),np.array([0.,1.,2.]),np.array([[3.]]))
        self.assertAlmostEqual(prediction[0],2.5)
        # A missing held-out value is imputed to the training median, not zero.
        missing=expanded.ridge_predict(np.array([[10.],[11.],[12.]]),np.array([0.,1.,2.]),np.array([[np.nan]]))
        self.assertAlmostEqual(missing[0],1)

    def test_snapshot_denominators_and_privacy(self):
        data=json.loads((ROOT/'_data/blanket_expanded.json').read_text(encoding='utf-8'))
        self.assertEqual(data['candidate_reps'],data['screened_reps']+sum(data['exclusions'].values()))
        self.assertEqual(sum(r['count'] for r in data['histogram']),data['screened_reps'])
        self.assertEqual(sum(r['reps'] for r in data['strata'][:3]),data['screened_reps'])
        self.assertEqual(next(r['count'] for r in data['thresholds'] if r['threshold']==1),data['provisional_blankets'])
        self.assertEqual(data['review']['film_verified'],0)
        self.assertEqual(len(data['models']),9)
        for model in data['models']:
            self.assertAlmostEqual(model['baseline_mae']-model['augmented_mae'],model['mae_improvement'])
        serialized=json.dumps(data)
        for forbidden in ['nfl_id','receiver_id','display_name','x_cb','review_notes']:
            self.assertNotIn('"'+forbidden+'"',serialized)


if __name__=='__main__':unittest.main()
