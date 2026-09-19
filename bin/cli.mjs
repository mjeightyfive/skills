#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CWD = process.cwd();

const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'skills.json'), 'utf8'));
const BEGIN = '<!-- skills:begin -->';
const END = '<!-- skills:end -->';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function die(msg) {
  console.error(`${c.red('error')} ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- manifest

/** Every `source/skill` a profile pulls in, following `extends`. */
function resolveProfile(name, seen = new Set()) {
  const profile = MANIFEST.profiles[name];
  if (!profile) die(`unknown profile "${name}". Known: ${Object.keys(MANIFEST.profiles).join(', ')}`);
  if (seen.has(name)) return [];
  seen.add(name);
  const inherited = (profile.extends ?? []).flatMap((parent) => resolveProfile(parent, seen));
  return [...inherited, ...profile.skills];
}

/**
 * A skill is addressed by its declared `name:` on install, but by its directory
 * upstream. Those usually match; where they do not, the manifest maps them.
 */
function installName(source, skill) {
  return MANIFEST.sources[source]?.installNames?.[skill] ?? skill;
}

/** Group `source/skill` refs into one install per upstream repo. */
function groupBySource(refs) {
  const groups = new Map();
  for (const ref of refs) {
    const [source, skill] = ref.split('/');
    const meta = MANIFEST.sources[source];
    if (!meta) die(`"${ref}" names an unknown source "${source}"`);
    if (!groups.has(source)) groups.set(source, { repo: meta.repo, skills: [] });
    groups.get(source).skills.push(installName(source, skill));
  }
  return groups;
}

/** Everything the manifest has an opinion about, included or excluded. */
function declared() {
  const set = new Set(Object.keys(MANIFEST.exclude));
  for (const name of Object.keys(MANIFEST.profiles)) resolveProfile(name).forEach((r) => set.add(r));
  (MANIFEST.global?.skills ?? []).forEach((r) => set.add(r));
  return set;
}

// ---------------------------------------------------------------- install

function agentFlags(agents) {
  return agents.flatMap((a) => ['-a', a]);
}

function add(from, skills, { agents, global: isGlobal }) {
  const args = ['-y', 'skills@latest', 'add', from, ...skills.flatMap((s) => ['-s', s]), ...agentFlags(agents), '-y'];
  if (isGlobal) args.push('-g');
  execFileSync('npx', args, { stdio: 'inherit', cwd: CWD });
}

function install(groups, { agents, global: isGlobal, local }) {
  for (const [source, { repo, skills }] of groups) {
    console.log(`\n${c.cyan('→')} ${c.bold(source)} ${c.dim(repo)} ${c.dim(`(${skills.length})`)}`);

    // Own skills can come from this checkout, but the lockfile then records a
    // relative path that resolves on no other machine. Only for bootstrapping,
    // before the repo is pushed.
    if (source === 'mine' && local) {
      add(ROOT, skills, { agents, global: isGlobal });
      console.log(c.yellow('  bootstrap install — lockfile entry is machine-local until you re-run without --local'));
      continue;
    }

    try {
      add(repo, skills, { agents, global: isGlobal });
    } catch {
      if (source !== 'mine') {
        die(`installing from ${repo} failed. Re-run that one by hand:\n  npx skills add ${repo} ${skills.map((s) => `-s ${s}`).join(' ')}`);
      }
      console.log(c.yellow(`  ${repo} is not reachable — falling back to this checkout`));
      add(ROOT, skills, { agents, global: isGlobal });
      console.log(c.yellow('  push the repo, then re-run init to get a portable lockfile entry'));
    }
  }
}

// ---------------------------------------------------------------- routing block

/**
 * The dedup decisions are derived from the manifest, never hand-copied into a
 * project. Regenerated in place on every init and update.
 */
function routingBlock(profileName) {
  const refs = resolveProfile(profileName);
  const lines = [
    BEGIN,
    '',
    '## Installed skills',
    '',
    `Profile \`${profileName}\`. Generated from the skills manifest — edit there, not here.`,
    '',
    '### Who owns what',
    '',
  ];
  for (const rule of MANIFEST.routing) {
    lines.push(`- **${rule.domain}** — ${MANIFEST.sources[rule.owner].label}. ${rule.rule}`);
  }
  lines.push('', '### Deliberately not installed', '');
  for (const [ref, meta] of Object.entries(MANIFEST.exclude)) {
    lines.push(`- \`${ref}\` — ${meta.reason}`);
  }
  lines.push('', `${refs.length} skills installed. Run \`skills-setup list\` to see them.`, '', END);
  return lines.join('\n');
}

function writeRouting(profileName) {
  const path = join(CWD, 'AGENTS.md');
  const block = routingBlock(profileName);
  let body = existsSync(path) ? readFileSync(path, 'utf8') : '# Agent instructions\n';
  if (body.includes(BEGIN) && body.includes(END)) {
    body = body.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), block);
  } else {
    body = `${body.trimEnd()}\n\n${block}\n`;
  }
  writeFileSync(path, body);
  console.log(`${c.green('✓')} AGENTS.md routing block`);
}

// ---------------------------------------------------------------- template

function seedTemplate() {
  const pairs = [
    ['template/AGENTS.md', 'AGENTS.md'],
    ['template/claude/settings.json', '.claude/settings.json'],
    ['template/cursor/rules/engineering-policy.mdc', '.cursor/rules/engineering-policy.mdc'],
  ];
  for (const [from, to] of pairs) {
    const src = join(ROOT, from);
    const dest = join(CWD, to);
    if (!existsSync(src)) continue;
    if (existsSync(dest)) {
      console.log(`${c.dim('·')} ${to} ${c.dim('exists, left alone')}`);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
    console.log(`${c.green('✓')} ${to}`);
  }
}

// ---------------------------------------------------------------- audit

async function ghJson(path) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'mjeightyfive-skills' };
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
    } catch {
      /* unauthenticated is fine until the rate limit bites */
    }
  }
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json();
}

async function upstreamSkills(repo) {
  const { default_branch } = await ghJson(`/repos/${repo}`);
  const { tree } = await ghJson(`/repos/${repo}/git/trees/${default_branch}?recursive=1`);
  return tree
    .filter((n) => /^skills\/[^/]+\/SKILL\.md$/.test(n.path))
    .map((n) => n.path.split('/')[1]);
}

async function description(repo, skill) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/skills/${skill}/SKILL.md`);
  if (!res.ok) return '';
  const text = await res.text();
  const front = text.split(/^---$/m)[1] ?? '';
  const match = front.match(/^description:\s*([\s\S]*?)(?=^\w+:|$)/m);
  return (match?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

/**
 * Drift, not versions. `skills update` already pulls new content; what it
 * cannot tell you is that an upstream grew a skill you have never ruled on.
 */
async function audit() {
  const known = declared();
  let drift = 0;

  for (const [source, meta] of Object.entries(MANIFEST.sources)) {
    if (source === 'mine') continue;
    process.stdout.write(`${c.dim('checking')} ${meta.repo}… `);
    let upstream;
    try {
      upstream = await upstreamSkills(meta.repo);
    } catch (err) {
      console.log(c.red(err.message));
      continue;
    }
    const undeclared = upstream.filter((s) => !known.has(`${source}/${s}`));
    const vanished = [...known]
      .filter((r) => r.startsWith(`${source}/`))
      .map((r) => r.split('/')[1])
      .filter((s) => !upstream.includes(s));
    console.log(c.dim(`${upstream.length} skills`));

    for (const skill of undeclared) {
      drift++;
      const desc = await description(meta.repo, skill);
      console.log(`  ${c.yellow('new')} ${c.bold(`${source}/${skill}`)}`);
      if (desc) console.log(`      ${c.dim(desc)}`);
    }
    for (const skill of vanished) {
      drift++;
      console.log(`  ${c.red('gone')} ${c.bold(`${source}/${skill}`)} ${c.dim('— in the manifest, not upstream')}`);
    }
  }

  console.log();
  if (drift === 0) {
    console.log(`${c.green('✓')} every upstream skill is either installed or excluded on purpose.`);
  } else {
    console.log(
      `${c.yellow('!')} ${drift} undecided. Add each to a profile or to \`exclude\` with a reason in skills.json.`,
    );
    console.log(c.dim('  Nothing is installed until you do — the manifest is the whole decision.'));
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------- list

function list(profileName) {
  const refs = resolveProfile(profileName);
  const byTier = [...refs].sort((a, b) => {
    const ta = MANIFEST.sources[a.split('/')[0]].tier;
    const tb = MANIFEST.sources[b.split('/')[0]].tier;
    return ta - tb || a.localeCompare(b);
  });
  console.log(`\n${c.bold(profileName)} ${c.dim(MANIFEST.profiles[profileName].description)}\n`);
  for (const ref of byTier) {
    const meta = MANIFEST.sources[ref.split('/')[0]];
    console.log(`  ${c.cyan(ref.padEnd(38))} ${c.dim(`tier ${meta.tier}  ${meta.label}`)}`);
  }
  console.log(`\n${c.bold('excluded')}\n`);
  for (const [ref, meta] of Object.entries(MANIFEST.exclude)) {
    console.log(`  ${c.dim(ref.padEnd(38))} ${c.dim(meta.reason.split('.')[0])}`);
  }
  console.log();
}

// ---------------------------------------------------------------- main

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

const usage = `
${c.bold('skills-setup')} — one curated skill set across every project and every agent

  ${c.cyan('init')}    [--profile web] [--agents claude-code,cursor,grok] [--local]
          Install a profile here, seed the policy files, write the routing block.
  ${c.cyan('update')}  [--profile web]
          Pull newer upstream content and regenerate the routing block.
  ${c.cyan('audit')}
          Report upstream skills the manifest has never ruled on.
  ${c.cyan('list')}    [--profile web]
          Show what a profile resolves to, and what is excluded and why.
  ${c.cyan('global')}
          Install the user-level skills once.

Profiles: ${Object.keys(MANIFEST.profiles).join(', ')}
`;

const command = process.argv[2];
const profile = arg('--profile', 'web');
const agents = (arg('--agents') ?? MANIFEST.agents.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const local = process.argv.includes('--local');

switch (command) {
  case 'init': {
    console.log(`${c.bold('Installing')} profile ${c.cyan(profile)} for ${c.dim(agents.join(', '))}`);
    install(groupBySource(resolveProfile(profile)), { agents, local });
    console.log();
    seedTemplate();
    writeRouting(profile);
    console.log(`\n${c.green('Done.')} ${c.dim('Commit skills-lock.json and .agents/skills so the set is reproducible.')}`);
    break;
  }
  case 'update': {
    try {
      execFileSync('npx', ['-y', 'skills@latest', 'update', '-p', '-y'], { stdio: 'inherit', cwd: CWD });
    } catch {
      die('`skills update` failed');
    }
    writeRouting(profile);
    console.log(`\n${c.dim('Now run')} skills-setup audit ${c.dim('to catch skills upstream added since you last looked.')}`);
    break;
  }
  case 'global': {
    install(groupBySource(MANIFEST.global.skills), { agents, global: true });
    break;
  }
  case 'audit':
    await audit();
    break;
  case 'list':
    list(profile);
    break;
  default:
    console.log(usage);
    process.exit(command ? 1 : 0);
}
