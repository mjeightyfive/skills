import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedTemplate } from '../bin/cli.mjs';

test('init seeds the policy files for Claude Code and Cursor', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-seed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});

  seedTemplate(dir);

  for (const file of ['AGENTS.md', '.claude/settings.json', '.cursor/rules/engineering-policy.mdc']) {
    assert.ok(existsSync(join(dir, file)), `${file} was not written`);
  }
  const deny = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).permissions.deny;
  assert.ok(deny.includes('Bash(git commit:*)'));
});

test('seeding leaves an existing .claude/settings.json alone', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-seed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});

  seedTemplate(dir);
  const settings = join(dir, '.claude/settings.json');
  writeFileSync(settings, '{}\n');
  seedTemplate(dir);

  assert.equal(readFileSync(settings, 'utf8'), '{}\n');
});
