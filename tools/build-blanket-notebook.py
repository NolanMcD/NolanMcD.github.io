"""Build a portable, output-free notebook containing exact Blanket source files."""
import argparse
import hashlib
import json
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'notebooks/blanket-reproduction.ipynb'
SOURCES = ['analyze-blanket.py', 'expand-blanket.py', 'validate-blanket.py',
           'plot-blanket-models.py', 'plot-blanket-validation.py']


def make_notebook():
    cells = []

    def cell(kind, source):
        entry = {'cell_type': kind, 'id': f'blanket-{len(cells):02}', 'metadata': {},
                 'source': textwrap.dedent(source).lstrip('\n').splitlines(keepends=True)}
        if kind == 'code':
            entry.update(execution_count=None, outputs=[])
            compile(''.join(entry['source']), entry['id'], 'exec')
        cells.append(entry)

    cell('markdown', '''
        # Blanket: reproduce the measurement and baseline audit

        Nolan McDermott · NFL Big Data Bowl 2027 · October 22, 2026

        **Question:** do combine defensive-back movement traits translate to sustained
        man-coverage proximity? Current evidence does not establish predictive value.
        This notebook reproduces the cohort, nine historical sensor comparisons,
        measurement sensitivity, four simple baselines, and aggregate figures.

        [Research brief](https://noland.blog/projects/nfl-big-data-bowl/brief/)
        · [Methods](https://github.com/NolanMcD/NolanMcD.github.io/blob/main/docs/blanket.md)

        Attach the official competition dataset after accepting its rules. Either the
        downloaded ZIP or an extracted folder containing all nine CSVs is supported.
        On Kaggle, one matching attached folder is detected automatically. Otherwise
        set `DATA_PATH` in the first cell, or the `BLANKET_DATA_PATH` environment variable.

        Requires Python 3.10+, numpy 2.x, pandas 2.2+, and matplotlib 3.9+; see the
        repository requirements. There are no runtime network downloads. No raw data
        or stored execution outputs are embedded here. Scripts below are exact,
        readable source copies with hashes. The large source cells are an executable
        appendix; the findings and tables appear after the run cell.

        The extracted-folder route creates a temporary uncompressed ZIP under the
        working directory (about the total CSV size). Kaggle must have sufficient
        writable disk. All tracking caches and review packets remain in that working
        directory. Do not publish them as notebook output datasets.
    ''')
    cell('code', '''
        import hashlib
        import json
        import os
        from pathlib import Path
        import shutil
        import subprocess
        import sys
        import zipfile

        DATA_PATH = None  # Set to your ZIP or extracted CSV folder if auto-discovery is ambiguous.
        parents = [Path.cwd().resolve(), *Path.cwd().resolve().parents]
        repository = next((p for p in parents if (p / 'tools/expand-blanket.py').exists()), None)
        if os.environ.get('BLANKET_DATA_PATH'):
            DATA_PATH = Path(os.environ['BLANKET_DATA_PATH'])
        if DATA_PATH is None and repository and (repository / 'nfl-big-data-bowl-2027.zip').exists():
            DATA_PATH = repository / 'nfl-big-data-bowl-2027.zip'
        if DATA_PATH is None:
            matches = sorted({p.parent for p in Path('/kaggle/input').rglob('players.csv')})
            matches = [p for p in matches if (p / 'combine_tracking.csv').exists() and (p / 'game_tracking_2025.csv').exists()]
            if len(matches) != 1:
                raise RuntimeError('Attach one official dataset or set DATA_PATH explicitly.')
            DATA_PATH = matches[0]
        DATA_PATH = Path(DATA_PATH).expanduser().resolve()
        default_work = (Path('/kaggle/working/blanket-reproduction') if Path('/kaggle').exists()
                        else (repository or Path.cwd()) / 'local-data/big-data-bowl/notebook-run')
        WORK = Path(os.environ.get('BLANKET_NOTEBOOK_WORKDIR', str(default_work))).resolve()
        (WORK / 'tools').mkdir(parents=True, exist_ok=True)
        (WORK / '_data').mkdir(exist_ok=True)
        # Optional local matplotlib installation; Kaggle normally has this dependency.
        if repository and (repository / 'local-data/big-data-bowl/plot-deps').exists():
            extra = str(repository / 'local-data/big-data-bowl/plot-deps')
            sys.path.insert(0, extra)
            os.environ['PYTHONPATH'] = os.pathsep.join([extra, os.environ.get('PYTHONPATH', '')])
        print('Working directory:', WORK)
    ''')
    cell('markdown', '## Exact source appendix\n\nThese cells write only the bundled analysis code into the working directory.\n')
    for name in SOURCES:
        raw = (ROOT / 'tools' / name).read_text(encoding='utf-8')
        digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
        literals = '\n'.join('    ' + repr(line) for line in raw.splitlines(keepends=True))
        source = f'# {name}; SHA-256 of UTF-8 source: {digest}\nsource = (\n{literals}\n)\n'
        source += f"assert hashlib.sha256(source.encode('utf-8')).hexdigest() == '{digest}'\n"
        source += f"(WORK / 'tools' / '{name}').write_bytes(source.encode('utf-8'))\n"
        cell('code', source)
    cell('markdown', '''
        ## Prepare licensed input and reproduce

        An existing ZIP is linked where possible, otherwise copied. Extracted CSVs
        are streamed into a canonical local ZIP without loading them all into memory.
        For repeated **local** runs only, `BLANKET_USE_VERIFIED_CACHE=1` can reuse the
        repository's tracking cache. The analysis checks its archive hash and filter
        version before accepting it. This is a cached rerun, not a cold-data audit.

        Expect several minutes and substantial disk use on a fresh run. Source
        evidence labels are absent by default, so independent reviews correctly
        appear pending. No package installations or web requests are made.
    ''')
    cell('code', '''
        required = ['players.csv', 'combine_results.csv', 'combine_tracking.csv', 'player_play.csv',
                    'games.csv', 'player_career_successes.csv',
                    'game_tracking_2023.csv', 'game_tracking_2024.csv', 'game_tracking_2025.csv']
        archive = WORK / 'nfl-big-data-bowl-2027.zip'
        if DATA_PATH.is_dir():
            missing = [name for name in required if not (DATA_PATH / name).is_file()]
            if missing:
                raise FileNotFoundError('Missing official CSV files: ' + ', '.join(missing))
            # Rebuild from the supplied folder; do not silently reuse a stale ZIP.
            with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as handle:
                for name in required:
                    handle.write(DATA_PATH / name, 'nfl-big-data-bowl-2027/' + name)
        elif DATA_PATH.is_file():
            if archive.exists() and not os.path.samefile(DATA_PATH, archive):
                raise RuntimeError('Working ZIP already exists and is not this input. Choose a fresh WORK directory.')
            if not archive.exists():
                try:
                    os.link(DATA_PATH, archive)
                except OSError:
                    shutil.copy2(DATA_PATH, archive)
        else:
            raise FileNotFoundError(DATA_PATH)
        use_cache = os.environ.get('BLANKET_USE_VERIFIED_CACHE') == '1'
        if use_cache and repository:
            cache = WORK / 'local-data/big-data-bowl/expanded'
            cache.mkdir(parents=True, exist_ok=True)
            for filename in ['tracking.pkl', 'tracking-cache.json']:
                original = repository / 'local-data/big-data-bowl/expanded' / filename
                target = cache / filename
                if original.exists() and not target.exists():
                    shutil.copy2(original, target)
        for filename in ['expand-blanket.py', 'validate-blanket.py', 'plot-blanket-models.py', 'plot-blanket-validation.py']:
            arguments = [sys.executable, str(WORK / 'tools' / filename)]
            if filename in ['expand-blanket.py', 'validate-blanket.py']:
                arguments.append('--publish')
            run = subprocess.run(arguments, cwd=WORK, text=True, capture_output=True)
            (WORK / (filename + '.log')).write_text(run.stdout + run.stderr, encoding='utf-8')
            if run.returncode:
                raise RuntimeError(filename + ' failed; inspect its private log. ' + run.stderr[-1500:])
            print('Completed:', filename)
    ''')
    cell('markdown', '''
        ## Aggregate results

        Blanket stays strictly below one yard averaged from snap to throw. Window
        comparisons are alternatives, not revised definitions. The baseline table
        uses the same workload-eligible held-out players. NFL cushion is contextual
        information, not an available pre-draft input. Rank sensitivity is not phase
        truth. Error resampling holds predictions fixed and omits full training and
        assignment uncertainty. No untouched test cohort exists.
    ''')
    cell('code', '''
        import pandas as pd
        expanded = json.loads((WORK / '_data/blanket_expanded.json').read_text(encoding='utf-8'))
        audit = json.loads((WORK / '_data/blanket_validation.json').read_text(encoding='utf-8'))
        assert expanded['screened_reps'] == sum(c['reps'] for c in audit['application']['cells'])
        assert expanded['candidate_reps'] == expanded['screened_reps'] + sum(expanded['exclusions'].values())
        print('Measured pairs:', expanded['screened_reps'], '| CBs:', expanded['screened_players'],
              '| Provisional Blankets:', expanded['provisional_blankets'])
        print('\\nSimple comparators (MAE in yards):')
        print(pd.DataFrame(audit['baselines']['comparisons'])[['name', 'mae', 'scope']].to_string(index=False))
        print('\\nAll nine historical sensor comparisons:')
        print(pd.DataFrame(expanded['models'])[['drill', 'feature', 'players', 'baseline_mae',
                                               'augmented_mae', 'mae_improvement', 'improvement_95']].to_string(index=False))
        print('\\nIndependent assignment review:', audit['assignment']['status'])
        print('Independent phase review:', audit['phases']['annotation_review']['status'])
        print('Film-meeting shortlist:', audit['application']['meeting_shortlist'], 'private examples')
    ''')
    cell('code', '''
        figures = [WORK / 'assets/images/blanket' / name for name in
                   ['coverage-context.png', 'phase-sensitivity.png', 'held-out-models.png']]
        assert all(path.is_file() for path in figures)
        try:
            from IPython.display import Image, display
        except ImportError:
            print('Figures written:', *figures, sep='\\n')
        else:
            for path in figures:
                display(Image(filename=str(path)))
    ''')
    cell('markdown', '''
        ## Interpretation and submission status

        This reproduces a retrospective exploratory analysis, not a validated
        prospect forecast. The original sensor comparisons are preserved. Four
        simple comparators clarify their interpretation; no sensor model or penalty
        was tuned in this audit. Receiver assignments, physical phases, current-year
        units, route/receiver adjustment, and genuinely new evaluation data remain
        unresolved. Missing film labels are not evidence of incorrect assignments.

        Raw tracking, player identities, caches, local review packets, and annotations
        remain in the working directory; publish only intended aggregate findings.
        The source notebook intentionally has no saved outputs. Execute it with the
        official data to inspect the figures and tables. A GitHub notebook is not an
        attached public Kaggle notebook: that separate competition step is pending.

        Data attribution: NFL / Next Gen Stats, via
        [NFL Big Data Bowl 2027](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027).
    ''')
    return {'cells': cells, 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                                       'language_info': {'name': 'python', 'version': '3.11'}},
            'nbformat': 4, 'nbformat_minor': 5}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = json.dumps(make_notebook(), indent=1, ensure_ascii=True) + '\n'
    if args.check:
        if not DESTINATION.exists() or DESTINATION.read_text(encoding='utf-8') != result:
            raise SystemExit('Notebook is stale; run python tools/build-blanket-notebook.py')
        print('Notebook matches source; every code cell compiles; no stored execution outputs.')
    else:
        DESTINATION.parent.mkdir(parents=True, exist_ok=True)
        DESTINATION.write_bytes(result.encode('utf-8'))
        print(DESTINATION)


if __name__ == '__main__':
    main()
