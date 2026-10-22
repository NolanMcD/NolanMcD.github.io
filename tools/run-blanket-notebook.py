"""Execute every plain-Python notebook cell, keeping all outputs in local-data.

This executor does not require a Jupyter kernel. It validates the same code cells
in a fresh Python process; it does not claim Kaggle-hosted or Jupyter execution.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reuse-verified-cache', action='store_true')
    args = parser.parse_args()
    notebook_path = ROOT / 'notebooks/blanket-reproduction.ipynb'
    notebook = json.loads(notebook_path.read_text(encoding='utf-8'))
    if args.reuse_verified_cache:
        os.environ['BLANKET_USE_VERIFIED_CACHE'] = '1'
    namespace = {'__name__': '__notebook__'}
    executed = 0
    start = time.monotonic()
    for index, cell in enumerate(notebook['cells']):
        if cell['cell_type'] != 'code':
            continue
        print(f'Executing cell {index + 1}', flush=True)
        exec(compile(''.join(cell['source']), f'{notebook_path.name}:cell-{index+1}', 'exec'), namespace)
        executed += 1
    work = namespace['WORK']
    actual = json.loads((work / '_data/blanket_expanded.json').read_text(encoding='utf-8'))
    expected = json.loads((ROOT / '_data/blanket_expanded.json').read_text(encoding='utf-8'))
    # Private source annotations are intentionally absent from notebook reproduction.
    for key in ['candidate_reps', 'screened_reps', 'screened_players', 'provisional_blankets', 'models', 'thresholds']:
        if actual[key] != expected[key]:
            raise ValueError('Notebook reproduction differs from published expanded results: ' + key)
    report = {'notebook_sha256': hashlib.sha256(notebook_path.read_bytes()).hexdigest(),
              'code_cells_executed': executed, 'seconds': round(time.monotonic() - start, 2),
              'execution': 'Fresh Python process; sequential execution of plain Python notebook cells',
              'cache_requested': args.reuse_verified_cache,
              'historical_aggregate_and_model_comparison': 'matched', 'kaggle_execution': 'not performed'}
    (work / 'execution-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
