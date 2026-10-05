const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const explorer = require('../assets/js/triple-atlas-explorer.js');
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/triple-atlas.json'), 'utf8'));
const state = overrides => ({...explorer.readURL('https://noland.blog/triple-atlas/'), ...overrides});
const play = (id, overrides = {}) => ({id, date: '2026-04-01', game_pk: 1, at_bat_number: 1,
  player: 'Runner', batter_id: 1, park: 'Park', team: 'SEA', description: 'Into the gap',
  video_url: 'https://baseballsavant.mlb.com/sporty-videos?playId=valid-id',
  annotation: {status: 'tagged', tags: ['gap'], note: '', rating: null, video_url: null}, ...overrides});

test('snapshot totals and every grouping reconcile to the original plays', () => {
  const stats = explorer.summarize(snapshot.plays);
  assert.equal(stats.total, snapshot.plays.length);
  assert.equal(stats.players, new Set(snapshot.plays.map(p => p.batter_id)).size);
  for (const key of ['player', 'park', 'team']) {
    assert.equal(explorer.rank(snapshot.plays, key).reduce((total, row) => total + row.count, 0), snapshot.plays.length);
  }
  assert.equal(explorer.months(snapshot.plays, snapshot.season).reduce((total, month) => total + month.count, 0), snapshot.plays.length);
});

test('player, park, dates and ALL chosen tags intersect instead of broadening the view', () => {
  const chosen = snapshot.plays.find(p => p.annotation.tags.length >= 2);
  const options = state({player: chosen.player, park: chosen.park, from: chosen.date, through: chosen.date, tags: chosen.annotation.tags});
  const list = explorer.filter(snapshot.plays, options);
  assert.ok(list.some(p => p.id === chosen.id));
  assert.ok(list.every(p => p.player === chosen.player && p.park === chosen.park && p.date === chosen.date && options.tags.every(t => p.annotation.tags.includes(t))));
  assert.equal(explorer.filter(snapshot.plays, {...options, tags: ['nonexistent-tag']}).length, 0);
});

test('source video overrides include intentional removal and reject unsafe links', () => {
  const valid = play('linked');
  const removed = play('removed', {annotation: {...valid.annotation, video_url: ''}});
  const unsafe = play('unsafe', {video_url: 'https://evil.example/sporty-videos?playId=x'});
  const injection = play('injection', {video_url: 'javascript:alert(1)'});
  assert.equal(explorer.summarize([valid, removed, unsafe, injection]).linked, 1);
  assert.deepEqual(explorer.filter([valid, removed, unsafe, injection], state({video: 'linked'})).map(p => p.id), ['linked']);
  assert.equal(explorer.filter([valid, removed, unsafe, injection], state({video: 'missing'})).length, 3);
});

test('share URLs round-trip unicode, dates, all tags and the selected play without leaking owner credentials', () => {
  const options = state({search: 'José & a gap', player: 'José', park: 'A & B', from: '2026-03-31', through: '2026-04-30',
    status: 'review again', rating: '4', video: 'linked', sort: 'oldest', tags: ['first', 'second', 'first']});
  const url = explorer.writeURL('http://127.0.0.1:8765/triple-atlas/?owner=secret&other=secret#owner=secret', options, '123-2-3');
  assert.ok(!url.href.includes('secret'));
  assert.equal(url.hash, '');
  assert.deepEqual(explorer.readURL(url.href), {...options, tags: ['first', 'second']});
  assert.equal(url.searchParams.get('play'), '123-2-3');
  assert.equal(explorer.writeURL(url.href, state()).search, '');
});

test('malformed share parameters recover to valid defaults', () => {
  const options = explorer.readURL('https://noland.blog/triple-atlas/?from=2026-02-30&through=garbage&sort=evil&rating=9&video=yes&status=bad');
  assert.equal(options.from, ''); assert.equal(options.through, '');
  assert.equal(options.sort, 'newest'); assert.equal(options.rating, '');
  assert.equal(options.video, ''); assert.equal(options.status, '');
  assert.equal(explorer.validDate('2028-02-29'), true);
  assert.equal(explorer.validDate('2026-02-29'), false);
  assert.equal(explorer.filter(snapshot.plays, state({from: '2026-09-30', through: '2026-03-01'})).length, 0);
});

test('sorting is deterministic, leaves source order intact and puts unrated plays last', () => {
  const input = [play('a'), play('c', {date: '2026-05-01', player: 'Zed', annotation: {...play('x').annotation, rating: 5}}), play('b', {at_bat_number: 2})];
  assert.deepEqual(explorer.sort(input, 'newest').map(p => p.id), ['c', 'b', 'a']);
  assert.deepEqual(explorer.sort(input, 'oldest').map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(explorer.sort(input, 'player').map(p => p.id), ['b', 'a', 'c']);
  assert.equal(explorer.sort(input, 'rating')[0].id, 'c');
  assert.deepEqual(input.map(p => p.id), ['a', 'c', 'b']);
  assert.deepEqual(explorer.rank([play('1', {player: 'B'}), play('2', {player: 'A'})], 'player').map(row => row.label), ['A', 'B']);
});

test('surprise selections respect the filtered pool, skip the current play and require a safe clip', () => {
  const input = [play('current'), play('missing', {video_url: ''}), play('other')];
  assert.equal(explorer.pick(input, 'current', () => 0).id, 'other');
  assert.equal(explorer.pick(input.slice(0, 2), 'current'), null);
  assert.equal(explorer.pick([], ''), null);
  const chosen = snapshot.plays[0];
  const pool = explorer.filter(snapshot.plays, state({player: chosen.player}));
  for (let i = 0; i < 10; i++) assert.equal(explorer.pick(pool, chosen.id).player, chosen.player);
});

test('the season timeline includes empty months with correct month boundaries', () => {
  const list = explorer.months([play('1', {date: '2026-03-31'}), play('2', {date: '2026-04-30'})], 2026);
  assert.equal(list.length, 7);
  assert.deepEqual(list[0], {month: '2026-03', count: 1, from: '2026-03-01', through: '2026-03-31'});
  assert.deepEqual(list[1], {month: '2026-04', count: 1, from: '2026-04-01', through: '2026-04-30'});
  assert.equal(list[6].count, 0);
});

test('empty views yield useful zero counts, empty rankings and no random play', () => {
  assert.deepEqual(explorer.summarize([]), {total: 0, players: 0, parks: 0, linked: 0, tagged: 0});
  assert.deepEqual(explorer.rank([], 'player'), []);
  assert.deepEqual(explorer.sort([]), []);
  assert.equal(explorer.pick([], ''), null);
});
