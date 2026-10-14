"""Audit the local BDB ZIP without extracting or publishing raw competition data."""
import argparse
import csv
import io
import json
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
MISSING = {"", "NA", "N/A", "NaN", "nan", "null", "None"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, default=ROOT / "nfl-big-data-bowl-2027.zip")
    args = parser.parse_args()
    output = ROOT / "local-data" / "big-data-bowl"
    output.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.zip) as archive:
        members = {Path(n).name: n for n in archive.namelist() if not n.endswith("/")}

        def rows(name):
            with archive.open(members[name]) as raw:
                yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))

        players = {r["nfl_id"]: r for r in rows("players.csv")}
        combine = list(rows("combine_results.csv"))
        cb = {r["nfl_id"]: r for r in combine if players.get(r["nfl_id"], {}).get("nfl_position") == "CB"}
        print("Combine positions:", dict(Counter(r["combine_position"] for r in combine)), flush=True)
        stats = {pid: Counter() for pid in cb}
        assignments = Counter()
        assignment_snap = Counter()
        separation_positions = Counter()
        samples = []
        play_rows = 0
        for row in rows("player_play.csv"):
            play_rows += 1
            if row["separation_at_pass_forward"] not in MISSING:
                separation_positions[row["lined_up_position"]] += 1
            pid = row["nfl_id"]
            if pid not in cb:
                continue
            stat = stats[pid]
            stat["player_play_rows"] += 1
            if row["team_coverage_man_zone"] == "MAN_COVERAGE":
                stat["man_rows"] += 1
            if row["coverage_assignment"] not in MISSING:
                stat["assignment_rows"] += 1
                assignments[row["coverage_assignment"]] += 1
            if row["coverage_assignment_at_snap"] not in MISSING:
                assignment_snap[row["coverage_assignment_at_snap"]] += 1
            if row["separation_at_pass_forward"] not in MISSING:
                stat["separation_rows"] += 1
            if len(samples) < 5 and row["coverage_assignment"] not in MISSING:
                samples.append({k: row[k] for k in ["game_id", "play_id", "nfl_id", "lined_up_position", "team_coverage_man_zone", "coverage_assignment", "coverage_assignment_at_snap", "separation_at_pass_forward", "cushion"]})
        drill_names = Counter()
        cb_drill_names = Counter()
        drill_players = defaultdict(set)
        for row in rows("combine_tracking.csv"):
            key = row["drill_type"] + " / " + row["drill_name"]
            drill_names[key] += 1
            if row["nfl_id"] in cb:
                cb_drill_names[key] += 1
                drill_players[key].add(row["nfl_id"])
        cohort = []
        for pid, result in cb.items():
            cohort.append({"nfl_id": pid, "display_name": players.get(pid, {}).get("display_name", ""), "draft_year": result["draft_year"], "three_cone": result["three_cone"], "forty": result["forty"], "short_shuttle": result["short_shuttle"], **{k: stats[pid][k] for k in ["player_play_rows", "man_rows", "assignment_rows", "separation_rows"]}})
        report = {
            "archive": args.zip.name,
            "files": {Path(i.filename).name: i.file_size for i in archive.infolist()},
            "combine_rows": len(combine),
            "combine_positions": dict(Counter(r["combine_position"] for r in combine)),
            "cornerbacks": len(cb),
            "cornerbacks_by_year": dict(Counter(r["draft_year"] for r in cb.values())),
            "cornerbacks_with_three_cone": sum(r["three_cone"] not in MISSING for r in cb.values()),
            "cornerbacks_with_three_cone_and_play_rows": sum(r["three_cone"] not in MISSING and stats[pid]["player_play_rows"] > 0 for pid, r in cb.items()),
            "cornerbacks_with_play_rows": sum(s["player_play_rows"] > 0 for s in stats.values()),
            "player_play_rows": play_rows,
            "separation_populated_by_lined_up_position": dict(separation_positions),
            "cb_coverage_assignment_values": dict(assignments),
            "cb_coverage_assignment_at_snap_values": dict(assignment_snap),
            "cb_assignment_examples": samples,
            "combine_tracking_drills": dict(drill_names),
            "cb_combine_tracking_drills": dict(cb_drill_names),
            "cb_tracking_players_by_drill": {k: len(v) for k, v in drill_players.items()},
            "cohort": cohort,
        }
    (output / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (output / "cornerback-cohort.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(cohort[0]) if cohort else ["nfl_id"])
        writer.writeheader()
        writer.writerows(cohort)
    print(json.dumps({k: v for k, v in report.items() if k not in {"cohort", "files", "combine_tracking_drills", "cb_coverage_assignment_values", "cb_coverage_assignment_at_snap_values"}}, indent=2))
    print("Private audit outputs:", output)


if __name__ == "__main__":
    main()
