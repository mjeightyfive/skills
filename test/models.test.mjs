import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyRegion,
  classifyFamily,
  loadPolicy,
  pair,
  parseLeaderboard,
  parseModelName,
  pickRow,
  renderImproveTable,
  renderProposingLine,
  snapshotFromPage,
  toolColumns,
} from '../bin/models.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'test', 'fixtures');
function frozenBoard() {
  return JSON.parse(readFileSync(join(FIXTURES, 'benchmarks.json'), 'utf8'));
}
const policy = loadPolicy(ROOT);

test('parses Extra High before High', () => {
  assert.deepEqual(parseModelName('Grok 4.6 Extra High'), { base: 'Grok 4.6', effort: 'extra-high' });
  assert.deepEqual(parseModelName('Opus 5 High'), { base: 'Opus 5', effort: 'high' });
  assert.deepEqual(parseModelName('Composer 2.5'), { base: 'Composer 2.5', effort: null });
  assert.equal(classifyFamily('GPT-5.6 Sol', policy), 'sol');
  assert.equal(classifyFamily('GPT-5.6 Terra', policy), 'terra');
  assert.equal(classifyFamily('Fable 5.1', policy), 'fable');
});

test('parses a markdown CursorBench table and drops duplicate rows', () => {
  const text = readFileSync(join(FIXTURES, 'cursorbench.md'), 'utf8');
  const { bench, rows } = parseLeaderboard(text, policy);
  assert.equal(bench, 'cursorbench-4.0');
  assert.equal(rows.filter((r) => r.name === 'Opus 5 Max').length, 1);
  assert.equal(pickRow(rows, 'opus', 'max').score, 46.6);
  assert.equal(pickRow(rows, 'grok', 'extra-high').name, 'Grok 4.6 Extra High');
});

test('parses nested CursorBench cells split by React comments', () => {
  const text = `<table><tr><td>6</td><td><span class="truncate">Grok 4.7 Extra High</span><span></span></td><td>46.3<!-- -->%</td><td>$<!-- -->6.01</td><td>70,141</td><td>88</td></tr></table>`;
  const { rows } = parseLeaderboard(text, policy);
  const row = rows.find((r) => r.name === 'Grok 4.7 Extra High');
  assert.equal(row.rank, 6);
  assert.equal(row.effort, 'extra-high');
  assert.equal(row.score, 46.3);
  assert.equal(row.cost, 6.01);
  assert.equal(row.tokens, 70141);
  assert.equal(row.steps, 88);
});

test('parses an HTML table and strips a Claude prefix', () => {
  const text = readFileSync(join(FIXTURES, 'cursorbench.html'), 'utf8');
  const { rows } = parseLeaderboard(text, policy);
  assert.equal(rows.find((r) => r.family === 'opus' && r.effort === 'max').name, 'Opus 5 Max');
  assert.ok(rows.length >= 10);
});

test('pairs pinned families and ignores Fable', () => {
  const snapshot = frozenBoard();
  const picks = pair(snapshot, policy);
  assert.equal(picks.ceiling.opus, 'Opus 5 High');
  assert.equal(picks.ceiling.grok, 'Grok 4.7 Extra High');
  assert.equal(picks.ceiling.sol, 'GPT-5.6 Sol Max');
  assert.equal(picks.high.opus, 'Opus 5 High');
  assert.equal(picks.mechanical.opus, 'Opus 5 Low');
  assert.equal(picks.mechanical.haiku, 'Haiku 4.5');
  assert.equal(picks.mechanical.grok, 'Grok 4.7 Fast');
  assert.doesNotMatch(picks.ceiling.join, /Fable/);
  assert.doesNotMatch(picks.high.join, /Fable/);
});

test('tool columns put GPT Sol on Cursor Deep, not Claude Code', () => {
  const picks = pair(frozenBoard(), policy);
  const cols = toolColumns(picks);
  assert.equal(cols.deep.claude, 'Opus 5 High');
  assert.match(cols.standard.cursor, /^Opus 5 Medium · Composer 2\.5/);
  assert.match(cols.deep.cursor, /GPT-5\.6 Sol High/);
  assert.doesNotMatch(cols.deep.claude, /Grok|GPT/);
  assert.equal(cols.deep.grok, 'Grok 4.7 High');
});

test('improve table uses ceiling only on /improve deep', () => {
  const picks = pair(frozenBoard(), policy);
  const table = renderImproveTable(picks, policy);
  const deep = table.split('\n').find((l) => l.includes('`/improve deep`'));
  const bare = table.split('\n').find((l) => l.startsWith('| `/improve` |'));
  assert.match(deep, /Opus 5 High/);
  assert.match(deep, /Grok 4\.7 Extra High/);
  assert.doesNotMatch(bare, /Extra High/);
  assert.match(bare, /Opus 5 High/);
});

test('applyRegion keeps inline replacements on one line', () => {
  const src =
    'Run <!-- skills:models:role-high:begin -->old<!-- skills:models:role-high:end --> now.';
  const next = applyRegion(src, 'role-high', 'Opus 5 High · Grok 4.6 High');
  assert.equal(next, 'Run <!-- skills:models:role-high:begin -->Opus 5 High · Grok 4.6 High<!-- skills:models:role-high:end --> now.');
});

test('applyRegion rewrites a block table', () => {
  const src = `<!-- skills:models:improve-runs:begin -->
old
<!-- skills:models:improve-runs:end -->`;
  const next = applyRegion(src, 'improve-runs', '| a | b |');
  assert.equal(
    next,
    `<!-- skills:models:improve-runs:begin -->
| a | b |
<!-- skills:models:improve-runs:end -->`,
  );
});

test('snapshotFromPage rejects a thin parse', () => {
  assert.throws(() => snapshotFromPage('| 1 | Opus 5 Max | 46.6% | $1 | 1 | 1 |', policy), /at least 10/);
});

test('proposing line names all three tools', () => {
  const line = renderProposingLine(pair(frozenBoard(), policy));
  assert.match(line, /^Deep — Opus 5 High · Cursor:/);
  assert.match(line, /Grok Build: Grok 4\.7 High$/);
});
