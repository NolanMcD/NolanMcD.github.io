"""Maintain Scene 4's packing montage from explicit ewen-kit scene annotations."""

import argparse
import json
from pathlib import Path
import re
import time

ROOT = Path(__file__).resolve().parents[1]
START = "<!-- BEGIN GENERATED EWEN PACKING -->"
END = "<!-- END GENERATED EWEN PACKING -->"
TAG = re.compile(r"<!--\s*ewen-kit:\s*(.*?)\s*-->", re.DOTALL)


def synchronize(root=ROOT, check=False):
    scenes = root / "_blood_manatees"
    target = scenes / "4.md"
    original = target.read_text(encoding="utf-8")
    if original.count(START) != 1 or original.count(END) != 1:
        raise ValueError("Scene 4 must contain exactly one pair of packing markers")
    before, remainder = original.split(START)
    _, after = remainder.split(END)
    items = {}
    paths = sorted(scenes.glob("*.md"), key=lambda p: (int(p.stem) if p.stem.isdigit() else float("inf"), p.name))
    for path in paths:
        source = path.read_text(encoding="utf-8")
        if source.count("ewen-kit:") != len(TAG.findall(source)):
            raise ValueError(f"{path.name}: incomplete ewen-kit annotation")
        for match in TAG.finditer(source):
            try:
                item = json.loads(match.group(1))
                if not isinstance(item, dict) or set(item) != {"id", "packing_beat"}:
                    raise ValueError("expected id and packing_beat")
                key, beat = item["id"], item["packing_beat"]
                if not isinstance(key, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", key):
                    raise ValueError("id must be a lowercase slug")
                if not isinstance(beat, str) or not beat.strip():
                    raise ValueError("packing_beat must be nonempty screenplay action")
                if any(token in beat for token in ("<!--", "-->", "{%", "{{")):
                    raise ValueError("packing_beat must not contain comments or Liquid code")
                beat = beat.strip()
                if key in items and items[key] != beat:
                    raise ValueError(f"conflicting packing beats for {key}")
                items[key] = beat
            except (ValueError, TypeError) as exc:
                raise ValueError(f"{path.name}: {exc}") from exc
    generated = "\n\n".join(items.values())
    updated = before + START + "\n\n" + generated + "\n\n" + END + after
    if original == updated:
        return False
    if check:
        raise ValueError("Packing montage is stale; run python tools/sync-blood-manatees-kit.py")
    target.write_text(updated, encoding="utf-8")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--watch", action="store_true", help="rescan saved scenes every 30 seconds")
    args = parser.parse_args()
    while True:
        try:
            changed = synchronize(check=args.check)
            if changed or not args.watch:
                print("Packing montage updated." if changed else "Packing montage is current.", flush=True)
        except (ValueError, OSError) as exc:
            if not args.watch:
                parser.exit(1, f"{exc}\n")
            print(f"Waiting for a valid saved draft: {exc}", flush=True)
        if not args.watch:
            return
        time.sleep(30)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
