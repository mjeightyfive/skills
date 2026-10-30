import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedTemplate } from '../bin/cli.mjs';

// Node has no TOML parser, and the package has no dependencies, so Python's
// standard-library tomllib (3.11+) does the parsing.
function parseToml(file) {
  const script = 'import json, sys, tomllib; print(json.dumps(tomllib.load(open(sys.argv[1], "rb"))))';
  return JSON.parse(execFileSync('python3', ['-c', script, file], { encoding: 'utf8' }));
}

function hasTomllib() {
  try {
    execFileSync('python3', ['-c', 'import tomllib'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// "Bash(git commit:*)" and "git commit*" name the same command prefix.
const claudePrefix = (rule) => rule.match(/^Bash\((.*):\*\)$/)[1];
const grokPrefix = (rule) => rule.pattern.replace(/\*$/, '');

test('init seeds .grok/config.toml with the same deny and allow lists as .claude/settings.json', { skip: !hasTomllib() && 'python3 with tomllib not installed' }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-seed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});

  seedTemplate(dir);

  const grokFile = join(dir, '.grok/config.toml');
  assert.ok(existsSync(grokFile), '.grok/config.toml was not written');
  const claude = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).permissions;
  const rules = parseToml(grokFile).permission.rules;

  assert.ok(rules.every((rule) => rule.tool === 'bash'));
  for (const action of ['deny', 'allow']) {
    assert.deepEqual(
      rules.filter((rule) => rule.action === action).map(grokPrefix),
      claude[action].map(claudePrefix),
      `${action} lists differ`,
    );
  }
});

test('seeding leaves an existing .grok/config.toml alone', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-seed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});

  seedTemplate(dir);
  const grokFile = join(dir, '.grok/config.toml');
  writeFileSync(grokFile, '# mine\n');
  seedTemplate(dir);

  assert.equal(readFileSync(grokFile, 'utf8'), '# mine\n');
});
