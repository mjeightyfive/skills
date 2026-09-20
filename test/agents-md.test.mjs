import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyRouting,
  hashBlock,
  parsePolicySections,
  renderPolicySection,
  ROUTING_BEGIN,
  ROUTING_END,
  syncAgentsMd,
} from '../bin/agents-md.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = readFileSync(join(ROOT, 'template/AGENTS.md'), 'utf8');
const ROUTING = `${ROUTING_BEGIN}

## Installed skills

Profile \`web\`. Generated from the skills manifest — edit there, not here.

${ROUTING_END}`;

const PROPOSING = `## Proposing work

Whenever work is proposed, name the model.

The prompt text itself is portable.
`;

function sectionsFrom(...blocks) {
  const template = blocks
    .map(([id, inner]) => `<!-- skills:policy:${id}:begin -->\n\n${inner}<!-- skills:policy:${id}:end -->`)
    .join('\n\n');
  return parsePolicySections(template);
}

function sync(body, extra = {}) {
  return syncAgentsMd(body, {
    sections: extra.sections ?? sectionsFrom(['proposing-work', PROPOSING]),
    routing: extra.routing ?? ROUTING,
  });
}

test('template declares named policy sections', () => {
  const sections = parsePolicySections(TEMPLATE);
  assert.deepEqual(
    sections.map((s) => s.id),
    ['proposing-work'],
  );
  assert.equal(sections[0].title, 'Proposing work');
});

test('wraps an unmarked heading whose text still matches', () => {
  const body = `# Agent instructions

## Terminal workflow

Run the checks.

## Proposing work

Whenever work is proposed, name the model.

The prompt text itself is portable.

## Git workflow

Never commit.

${ROUTING}
`;
  const { body: next, notes, conflicts } = sync(body);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" wrapped in place']);
  assert.match(next, /<!-- skills:policy:proposing-work:begin hash="[a-f0-9]{16}" -->/);
  assert.match(next, /## Terminal workflow\n\nRun the checks\.\n\n<!-- skills:policy:proposing-work:begin/);
  assert.match(next, /<!-- skills:policy:proposing-work:end -->\n\n## Git workflow/);
  assert.match(next, /Never commit\.\n\n<!-- skills:begin -->/);
  assert.equal(next.includes('Run the checks.'), true);
  assert.equal(next.includes('Never commit.'), true);
});

test('inserts a missing section before the routing block', () => {
  const body = `# AGENTS

## Skills

Project-specific skill notes.

${ROUTING}
`;
  const { body: next, notes, conflicts } = sync(body);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" inserted']);
  const skillsAt = next.indexOf('## Skills');
  const policyAt = next.indexOf('<!-- skills:policy:proposing-work:begin');
  const routingAt = next.indexOf(ROUTING_BEGIN);
  assert.ok(skillsAt < policyAt && policyAt < routingAt);
  assert.match(next, /Project-specific skill notes\.\n\n<!-- skills:policy:proposing-work:begin/);
  assert.equal((next.match(/## Skills/g) ?? []).length, 1);
});

test('leaves a dirty section alone when the template has not moved', () => {
  const inner = '## Proposing work\n\nLocal rewrite.\n';
  const marked = `<!-- skills:policy:proposing-work:begin hash="${hashBlock(PROPOSING)}" -->\n\n${inner}<!-- skills:policy:proposing-work:end -->`;
  const body = `# Intro\n\n${marked}\n`;
  const { body: next, notes, conflicts } = sync(body);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" has local edits, left alone']);
  assert.equal(next.includes('Local rewrite.'), true);
  assert.equal(next.includes('Whenever work is proposed'), false);
});

test('updates a pristine section when the template moves', () => {
  const oldInner = '## Proposing work\n\nOld template text.\n';
  const marked = `<!-- skills:policy:proposing-work:begin hash="${hashBlock(oldInner)}" -->\n\n${oldInner}<!-- skills:policy:proposing-work:end -->`;
  const body = `# Intro\n\n${marked}\n`;
  const { body: next, notes, conflicts } = sync(body);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" updated from template']);
  assert.equal(next.includes('Old template text.'), false);
  assert.equal(next.includes('Whenever work is proposed, name the model.'), true);
});

test('reports a conflict when local edits and the template both moved', () => {
  const oldInner = '## Proposing work\n\nOld template text.\n';
  const local = '## Proposing work\n\nLocal rewrite of old text.\n';
  const marked = `<!-- skills:policy:proposing-work:begin hash="${hashBlock(oldInner)}" -->\n\n${local}<!-- skills:policy:proposing-work:end -->`;
  const before = `# Intro\n\nHand-written stays.\n\n${marked}\n`;
  const { body: next, notes, conflicts } = sync(before);
  assert.equal(notes.length, 0);
  assert.deepEqual(conflicts, [
    'policy "proposing-work" has local edits and the template moved; left as-is',
  ]);
  assert.equal(next.includes('Local rewrite of old text.'), true);
  assert.equal(next.includes('Hand-written stays.'), true);
  assert.equal(next.includes('Whenever work is proposed, name the model.'), false);
});

test('does not overwrite an unmarked heading whose text has diverged', () => {
  const body = `# Intro

## Proposing work

A local version of this section.

## Other

Keep me.

${ROUTING}
`;
  const { body: next, conflicts } = sync(body);
  assert.deepEqual(conflicts, [
    'policy "proposing-work": heading "## Proposing work" exists with local text; left as-is',
  ]);
  assert.equal((next.match(/## Proposing work/g) ?? []).length, 1);
  assert.equal(next.includes('A local version of this section.'), true);
  assert.equal(next.includes('Keep me.'), true);
});

test('does not treat a heading inside a fence as a section', () => {
  const body = `# Intro

\`\`\`
## Proposing work
not the real one
\`\`\`

## Skills

Notes.

${ROUTING}
`;
  const { body: next, notes } = sync(body);
  assert.deepEqual(notes, ['policy "proposing-work" inserted']);
  assert.equal((next.match(/## Proposing work/g) ?? []).length, 2);
  assert.match(next, /```\n## Proposing work\nnot the real one\n```/);
});

test('inserts several named sections in template order', () => {
  const sections = sectionsFrom(
    ['alpha', '## Alpha\n\nFirst.\n'],
    ['beta', '## Beta\n\nSecond.\n'],
  );
  const body = `# Intro\n\nHand-written.\n\n${ROUTING}\n`;
  const { body: next, notes } = sync(body, { sections });
  assert.deepEqual(notes, ['policy "alpha" inserted', 'policy "beta" inserted']);
  const alpha = next.indexOf('<!-- skills:policy:alpha:begin');
  const beta = next.indexOf('<!-- skills:policy:beta:begin');
  const routing = next.indexOf(ROUTING_BEGIN);
  assert.ok(alpha < beta && beta < routing);
});

test('applyRouting replaces only the generated block', () => {
  const body = `# Intro\n\nMine.\n\n${ROUTING_BEGIN}\nold\n${ROUTING_END}\n`;
  const next = applyRouting(body, `${ROUTING_BEGIN}\nnew\n${ROUTING_END}`);
  assert.equal(next.includes('Mine.'), true);
  assert.equal(next.includes('old'), false);
  assert.equal(next.includes('new'), true);
});

test('adds a hash to a marked section copied from the template', () => {
  const marked = `<!-- skills:policy:proposing-work:begin -->\n\n${PROPOSING}<!-- skills:policy:proposing-work:end -->`;
  const { notes, conflicts, body } = sync(`# Intro\n\n${marked}\n`);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" markers refreshed']);
  assert.match(body, /<!-- skills:policy:proposing-work:begin hash="[a-f0-9]{16}" -->/);
});

test('renderPolicySection is stable under normalize', () => {
  const a = renderPolicySection('proposing-work', PROPOSING);
  const b = renderPolicySection('proposing-work', `\n\n${PROPOSING}\n\n`);
  assert.equal(a, b);
});

test('wraps the real template section in a mje.fi-shaped file', () => {
  const [section] = parsePolicySections(TEMPLATE);
  const body = `# Agent instructions

## Non-negotiable rules

Project-specific rules.

## Terminal workflow

Run the checks.

${section.inner}
## Git workflow

Never commit.

${ROUTING}
`;
  const { body: next, notes, conflicts } = syncAgentsMd(body, {
    sections: [section],
    routing: ROUTING,
  });
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" wrapped in place']);
  assert.equal(next.includes('Project-specific rules.'), true);
  assert.equal(next.includes('Never commit.'), true);
  assert.equal((next.match(/## Proposing work/g) ?? []).length, 1);
  assert.match(next, /Run the checks\.\n\n<!-- skills:policy:proposing-work:begin/);
  assert.match(next, /<!-- skills:policy:proposing-work:end -->\n\n## Git workflow/);
});

test('inserts the real template section into an exy-shaped file', () => {
  const [section] = parsePolicySections(TEMPLATE);
  const body = `# AGENTS

## No AI traces

Never leave evidence of AI tooling.

## Skills

Project-specific skill notes.

${ROUTING}
`;
  const { body: next, notes, conflicts } = syncAgentsMd(body, {
    sections: [section],
    routing: ROUTING,
  });
  assert.deepEqual(conflicts, []);
  assert.deepEqual(notes, ['policy "proposing-work" inserted']);
  assert.equal(next.includes('Never leave evidence of AI tooling.'), true);
  assert.equal(next.includes('Project-specific skill notes.'), true);
  assert.equal((next.match(/## Skills/g) ?? []).length, 1);
  assert.match(next, /Project-specific skill notes\.\n\n<!-- skills:policy:proposing-work:begin/);
  assert.match(next, /<!-- skills:policy:proposing-work:end -->\n\n<!-- skills:begin -->/);
});
