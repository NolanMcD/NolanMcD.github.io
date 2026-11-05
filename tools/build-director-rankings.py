"""Build the public director snapshot from private Letterboxd CSV exports."""
import argparse
import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORS = {
    'carpenter': ('John Carpenter', 'The Thing (1982 film)'),
    'coen-brothers': ('Coen brothers', 'No Country for Old Men'),
    'fincher': ('David Fincher', 'The Social Network'),
    'hitchcock': ('Alfred Hitchcock', 'Rear Window'),
    'kubrick': ('Stanley Kubrick', 'Barry Lyndon'),
    'nolan': ('Christopher Nolan', 'Oppenheimer (film)'),
    'payne': ('Alexander Payne', 'The Descendants'),
    'pta': ('Paul Thomas Anderson', 'There Will Be Blood'),
    'richie': ('Guy Ritchie', 'Lock, Stock and Two Smoking Barrels'),
    'scorsese': ('Martin Scorsese', 'The King of Comedy (film)'),
    'scott': ('Ridley Scott', 'Alien (film)'),
    'soderbergh': ('Steven Soderbergh', 'Solaris (2002 film)'),
    'spielberg': ('Steven Spielberg', 'Jaws (film)'),
    'tarantino': ('Quentin Tarantino', 'Inglourious Basterds'),
    'weir': ('Peter Weir', 'Master and Commander: The Far Side of the World'),
    'wes-anderson': ('Wes Anderson', 'The Life Aquatic with Steve Zissou'),
    'yorgos': ('Yorgos Lanthimos', 'Bugonia (film)'),
    'zemeckis': ('Robert Zemeckis', 'Back to the Future'),
}


def key(title, year):
    return (title.casefold().strip(), str(year))


def read_list(path):
    text = path.read_text(encoding='utf-8-sig')
    metadata = list(csv.reader(io.StringIO(text)))[2]
    start = text.index('Position,Name,Year,URL,Description')
    return metadata[3], list(csv.DictReader(io.StringIO(text[start:])))


def build(source_dir, ratings_path):
    with ratings_path.open(encoding='utf-8-sig', newline='') as stream:
        ratings = list(csv.DictReader(stream))
    by_url = {r['Letterboxd URI'].rstrip('/'): r for r in ratings}
    by_title = {key(r['Name'], r['Year']): r for r in ratings}
    diary = json.loads((ROOT / 'assets/data/film-diary.json').read_text(encoding='utf-8-sig'))
    recent = {}
    for r in sorted(diary, key=lambda r: (r.get('watchedDate', ''), r.get('publishedDate', ''))):
        if r.get('rating') is not None:
            recent[key(r['title'], r['year'])] = r
    # Directly supplied by Nolan on November 5, 2026, before the diary synced.
    overrides = {key('Paths of Glory', 1957): 4}
    directors = []
    for slug, (name, film_article) in DIRECTORS.items():
        path = source_dir / f'nolans-{slug}-rankings.csv'
        list_url, rows = read_list(path)
        films, seen = [], set()
        for row in rows:
            identity = row['URL'].rstrip('/')
            if identity in seen:
                raise ValueError(f'Duplicate film in {path.name}: {row["Name"]}')
            seen.add(identity)
            match_key = key(row['Name'], row['Year'])
            rating_row = by_url.get(identity) or by_title.get(match_key)
            if match_key in overrides:
                rating, source = overrides[match_key], 'owner-confirmed'
            elif rating_row:
                rating, source = float(rating_row['Rating']), 'ratings-export'
            elif match_key in recent:
                rating, source = float(recent[match_key]['rating']), 'diary'
            else:
                raise ValueError(f'Missing rating: {row["Name"]} ({row["Year"]})')
            if not 0 < rating <= 5 or rating * 2 != int(rating * 2):
                raise ValueError(f'Invalid rating: {rating}')
            films.append(dict(position=int(row['Position']), title=row['Name'], year=int(row['Year']),
                              url=row['URL'], rating=rating, ratingSource=source))
        films.sort(key=lambda f: f['position'])
        total = sum(f['rating'] for f in films)
        directors.append(dict(id=slug, name=name, listUrl=list_url, filmArticle=film_article,
                              count=len(films), total=total, average=total / len(films),
                              fiveStars=sum(f['rating'] == 5 for f in films), films=films))
    for metric, secondary in [('total', 'average'), ('average', 'total')]:
        ordered = sorted(directors, key=lambda d: (-d[metric], -d[secondary], d['name']))
        previous, rank = None, 0
        for index, director in enumerate(ordered, 1):
            if director[metric] != previous:
                rank = index
            director[metric + 'Rank'] = rank
            previous = director[metric]
    directors.sort(key=lambda d: (-d['total'], -d['average'], d['name']))
    return dict(asOf='2026-11-05', directors=directors,
                filmCount=sum(d['count'] for d in directors),
                totalStars=sum(d['total'] for d in directors))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'local-data/director-lists')
    parser.add_argument('--ratings', type=Path, default=ROOT / 'ratings.csv')
    args = parser.parse_args()
    data = build(args.source_dir, args.ratings)
    (ROOT / '_data/director_rankings.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for d in data['directors']:
        print(f'{d["totalRank"]:2} {d["name"]:24} {d["total"]:5g} stars / {d["count"]:2} films = {d["average"]:.2f}')
