import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("kit", Path(__file__).with_name("sync-blood-manatees-kit.py"))
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)


class PackingContinuityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.scenes = self.root / "_blood_manatees"
        self.scenes.mkdir()
        self.target = self.scenes / "4.md"
        self.target.write_text("Authored opening.\n" + kit.START + "\n" + kit.END + "\nAuthored ending.\n", encoding="utf-8")

    def declare(self, scene, key="rope", beat="He coils a rope into the bag."):
        tag = "<!-- ewen-kit: " + json.dumps({"id": key, "packing_beat": beat}) + " -->"
        (self.scenes / f"{scene}.md").write_text(tag, encoding="utf-8")

    def test_later_prop_is_packed_once_without_changing_surrounding_prose(self):
        self.declare(10)
        self.declare(11)
        self.assertTrue(kit.synchronize(self.root))
        text = self.target.read_text(encoding="utf-8")
        self.assertEqual(text.count("He coils a rope"), 1)
        self.assertTrue(text.startswith("Authored opening.\n"))
        self.assertTrue(text.endswith("\nAuthored ending.\n"))
        self.assertFalse(kit.synchronize(self.root))

    def test_removed_annotation_removes_beat(self):
        self.declare(10)
        kit.synchronize(self.root)
        (self.scenes / "10.md").unlink()
        kit.synchronize(self.root)
        self.assertNotIn("rope", self.target.read_text(encoding="utf-8"))

    def test_conflict_does_not_modify_scene(self):
        self.declare(10)
        self.declare(11, beat="A different rope beat.")
        original = self.target.read_bytes()
        with self.assertRaisesRegex(ValueError, "conflicting"):
            kit.synchronize(self.root)
        self.assertEqual(original, self.target.read_bytes())

    def test_check_detects_stale_content_without_writing(self):
        self.declare(10)
        original = self.target.read_bytes()
        with self.assertRaisesRegex(ValueError, "stale"):
            kit.synchronize(self.root, check=True)
        self.assertEqual(original, self.target.read_bytes())

    def test_unfinished_annotation_does_not_modify_scene(self):
        (self.scenes / "10.md").write_text('<!-- ewen-kit: {"id":', encoding="utf-8")
        original = self.target.read_bytes()
        with self.assertRaisesRegex(ValueError, "incomplete"):
            kit.synchronize(self.root)
        self.assertEqual(original, self.target.read_bytes())

    def test_scene_order_is_numeric(self):
        self.declare(10, "rope", "ROPE")
        self.declare(5, "torch", "TORCH")
        kit.synchronize(self.root)
        text = self.target.read_text(encoding="utf-8")
        self.assertLess(text.index("TORCH"), text.index("ROPE"))


if __name__ == "__main__":
    unittest.main()
