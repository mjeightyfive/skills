import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyRegion,
  classifyFamily,
  codexBoardName,
  codexCells,
  loadPolicy,
  pair,
  parseLeaderboard,
  parseModelName,
  pickRow,
  pinnedCursorCells,
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
  assert.deepEqual(parseModelName('GPT-5.6 Sol Extra High'), { base: 'GPT-5.6 Sol', effort: 'extra-high' });
  assert.deepEqual(parseModelName('Opus 5 High'), { base: 'Opus 5', effort: 'high' });
  assert.deepEqual(parseModelName('Haiku 4.5'), { base: 'Haiku 4.5', effort: null });
  assert.equal(classifyFamily('GPT-5.6 Sol', policy), 'sol');
  assert.equal(classifyFamily('GPT-5.6 Terra', policy), 'terra');
  assert.equal(classifyFamily('Fable 5.1', policy), null);
});

test('parses a markdown CursorBench table and drops duplicate rows', () => {
  const text = readFileSync(join(FIXTURES, 'cursorbench.md'), 'utf8');
  const { bench, rows } = parseLeaderboard(text, policy);
  assert.equal(bench, 'cursorbench-4.0');
  assert.equal(rows.filter((r) => r.name === 'Opus 5 Max').length, 1);
  assert.equal(pickRow(rows, 'opus', 'max').score, 46.6);
  assert.equal(pickRow(rows, 'sol', 'high').name, 'GPT-5.6 Sol High');
});

test('parses nested CursorBench cells split by React comments', () => {
  const text = `<table><tr><td>6</td><td><span class="truncate">GPT-5.6 Sol Extra High</span><span></span></td><td>46.3<!-- -->%</td><td>$<!-- -->6.01</td><td>70,141</td><td>88</td></tr></table>`;
  const { rows } = parseLeaderboard(text, policy);
  const row = rows.find((r) => r.name === 'GPT-5.6 Sol Extra High');
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
  assert.equal(picks.ceiling.sol, 'GPT-5.6 Sol Max');
  assert.equal(picks.high.opus, 'Opus 5 High');
  assert.equal(picks.mechanical.opus, 'Opus 5 Low');
  assert.equal(picks.mechanical.haiku, 'Haiku 4.5');
  assert.equal(picks.mechanical.sol, 'GPT-5.6 Sol Low');
  assert.doesNotMatch(picks.ceiling.join, /Fable/);
  assert.doesNotMatch(picks.high.join, /Fable/);
});

test('tool columns put GPT Sol and Grok on Cursor, not Claude Code', () => {
  const picks = pair(frozenBoard(), policy);
  const cols = toolColumns(picks, policy);
  assert.equal(cols.deep.claude, 'Opus 5 High');
  assert.equal(cols.deep.cursor, 'Opus 5 High · GPT-5.6 Sol High · Grok 4.7 High');
  assert.equal(cols.standard.cursor, 'Opus 5 Medium · GPT-5.6 Sol Medium · Grok 4.7 Medium');
  assert.equal(cols.mechanical.claude, 'Opus 5 Low · Haiku 4.5');
  assert.equal(cols.mechanical.cursor, 'Grok 4.7 Fast · Opus 5 Low · GPT-5.6 Sol Low');
  assert.doesNotMatch(cols.deep.claude, /GPT|Grok/);
});

test('a pinned Cursor family needs no board rows', () => {
  const snapshot = frozenBoard();
  assert.ok(!snapshot.rows.some((r) => /^Grok\s/.test(r.name)));
  const cols = toolColumns(pair(snapshot, policy), policy);
  assert.match(cols.deep.cursor, /Grok 4\.7 High$/);
  assert.match(cols.mechanical.cursor, /^Grok 4\.7 Fast · /);
});

test('a malformed Cursor pin fails loudly', () => {
  const grok = policy.cursorPinned.grok;
  assert.throws(() => pinnedCursorCells({ cursorPinned: { grok: { ...grok, model: '' } } }), /has no model/);
  assert.throws(
    () => pinnedCursorCells({ cursorPinned: { grok: { ...grok, standard: undefined } } }),
    /has no standard effort/,
  );
  assert.throws(
    () => pinnedCursorCells({ cursorPinned: { grok: { ...grok, deep: { effort: 'ultra' } } } }),
    /not a known effort/,
  );
  assert.deepEqual(pinnedCursorCells({}).deep, { lead: [], tail: [] });
});

test('codex cells come from the policy at the tier efforts', () => {
  const cols = toolColumns(pair(frozenBoard(), policy), policy);
  assert.equal(cols.deep.codex, 'gpt-6.2-astra High');
  assert.equal(cols.standard.codex, 'gpt-6.2-sol Medium');
  assert.equal(cols.mechanical.codex, 'gpt-6.2-sol Low');
});

test('codex names match board families by name, and an unknown one fails', () => {
  assert.equal(codexBoardName('gpt-6.2-sol'), 'GPT-6.2 Sol');
  assert.equal(classifyFamily(codexBoardName('gpt-5.6-sol'), policy), 'sol');
  assert.equal(codexCells(policy).deep.family, 'astra');
  const typo = { ...policy, codex: { ...policy.codex, deep: { model: 'gpt-6.2-astro', effort: 'high' } } };
  assert.throws(() => codexCells(typo), /matches no family/);
  const badEffort = { ...policy, codex: { ...policy.codex, standard: { model: 'gpt-6.2-sol', effort: 'ultra' } } };
  assert.throws(() => codexCells(badEffort), /not a known effort/);
});

test('improve table uses ceiling only on /improve deep', () => {
  const picks = pair(frozenBoard(), policy);
  const table = renderImproveTable(picks, policy);
  const deep = table.split('\n').find((l) => l.includes('`/improve deep`'));
  const bare = table.split('\n').find((l) => l.startsWith('| `/improve` |'));
  assert.match(deep, /Opus 5 High/);
  assert.match(deep, /GPT-5\.6 Sol Max/);
  assert.doesNotMatch(bare, /Extra High/);
  assert.match(bare, /Opus 5 High/);
});

test('applyRegion keeps inline replacements on one line', () => {
  const src =
    'Run <!-- skills:models:role-high:begin -->old<!-- skills:models:role-high:end --> now.';
  const next = applyRegion(src, 'role-high', 'Opus 5 High · GPT-5.6 Sol High');
  assert.equal(next, 'Run <!-- skills:models:role-high:begin -->Opus 5 High · GPT-5.6 Sol High<!-- skills:models:role-high:end --> now.');
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
  const line = renderProposingLine(pair(frozenBoard(), policy), policy);
  assert.equal(line, 'Deep — Opus 5 High · Cursor: Opus 5 High · GPT-5.6 Sol High · Grok 4.7 High · Codex: gpt-6.2-astra High');
});
