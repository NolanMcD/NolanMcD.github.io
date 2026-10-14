"""Independent boundary checks for the proposed Blanket measure."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('blanket', Path(__file__).with_name('analyze-blanket.py'))
blanket = importlib.util.module_from_spec(spec)
spec.loader.exec_module(blanket)


class BlanketMeasurementTests(unittest.TestCase):
    def test_strict_threshold(self):
        self.assertTrue(blanket.is_blanket(.999999))
        self.assertFalse(blanket.is_blanket(1))
        self.assertFalse(blanket.is_blanket(1.000001))

    def test_time_weighting_not_row_weighting(self):
        # A ramp 0→2 over 0.1 sec, then 2 for 0.2 sec: area=.1+.4.
        self.assertAlmostEqual(blanket.average_separation([0,2,2],[0,.1,.3]),5/3)

    def test_average_can_qualify_despite_brief_gap(self):
        average = blanket.average_separation([.5,1.2,.5],[0,.1,.2])
        self.assertAlmostEqual(average,.85)
        self.assertTrue(blanket.is_blanket(average))

    def test_endpoint_is_not_the_average(self):
        average = blanket.average_separation([3,3,.5],[0,1,2])
        self.assertAlmostEqual(average,2.375)
        self.assertFalse(blanket.is_blanket(average))

    def test_exact_one_average_is_not_blanket(self):
        average = blanket.average_separation([.9,1.1],[0,.1])
        self.assertAlmostEqual(average,1)
        self.assertFalse(blanket.is_blanket(average))

    def test_invalid_windows_are_not_failures(self):
        for distance,time in [([1],[0]),([1,2],[0,0]),([1,2],[1,0]),([1,np.nan],[0,1]),([-1,1],[0,1]),([1,2],[0])]:
            with self.subTest(distance=distance,time=time):
                with self.assertRaises(ValueError):
                    blanket.average_separation(distance,time)
        with self.assertRaises(ValueError):
            blanket.is_blanket(np.nan)


if __name__ == '__main__':
    unittest.main()
