import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');

export const CURSORBENCH_URL = 'https://cursor.com/cursorbench';
export const MODELS_BEGIN = (id) => `<!-- skills:models:${id}:begin -->`;
export const MODELS_END = (id) => `<!-- skills:models:${id}:end -->`;

const EFFORTS = [
  { key: 'extra-high', re: /\s+(Extra High|xhigh)$/i, label: 'Extra High' },
  { key: 'max', re: /\s+Max$/i, label: 'Max' },
  { key: 'high', re: /\s+High$/i, label: 'High' },
  { key: 'medium', re: /\s+Medium$/i, label: 'Medium' },
  { key: 'low', re: /\s+Low$/i, label: 'Low' },
  { key: 'minimal', re: /\s+Minimal$/i, label: 'Minimal' },
  { key: 'fast', re: /\s+Fast$/i, label: 'Fast' },
];

const SLICE_FAMILIES = new Set(['opus', 'sonnet', 'haiku', 'grok', 'sol', 'composer']);

export function isSkillsCheckout(root = ROOT) {
  return existsSync(join(root, '.git')) && existsSync(join(root, 'data', 'models.json'));
}

export function loadPolicy(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data', 'models.json'), 'utf8'));
}

export function loadSnapshot(root = ROOT) {
  const path = join(root, 'data', 'benchmarks.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripVendorPrefix(name) {
  return name.replace(/^Claude\s+/i, '').trim();
}

export function parseModelName(raw) {
  let name = stripVendorPrefix(decodeEntities(raw));
  let effort = null;
  for (const { key, re } of EFFORTS) {
    const m = name.match(re);
    if (m) {
      effort = key;
      name = name.slice(0, m.index).trim();
      break;
    }
  }
  return { base: name, effort };
}

export function classifyFamily(base, policy) {
  for (const [id, meta] of Object.entries(policy.families)) {
    if (new RegExp(meta.match).test(base)) return id;
  }
  return null;
}

export function parseBenchId(text) {
  const m = text.match(/CursorBench\s+(\d+\.\d+)/i);
  return m ? `cursorbench-${m[1]}` : 'cursorbench';
}

function numberish(s) {
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(/[$,%]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseLeaderboard(text, policy) {
  const seen = new Map();

  function add(rank, name, score, cost, tokens, steps) {
    const cleaned = stripVendorPrefix(decodeEntities(name));
    if (!cleaned || score == null) return;
    if (seen.has(cleaned)) return;
    const { base, effort } = parseModelName(cleaned);
    seen.set(cleaned, {
      rank,
      name: cleaned,
      family: classifyFamily(base, policy),
      effort,
      score,
      cost,
      tokens,
      steps,
    });
  }

  const mdRe =
    /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*%?\s*\|\s*\$?([\d.,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/gm;
  for (const m of text.matchAll(mdRe)) {
    add(
      Number(m[1]),
      m[2],
      numberish(m[3]),
      numberish(m[4]),
      numberish(m[5]),
      numberish(m[6]),
    );
  }

  const htmlRe =
    /<t[dh][^>]*>\s*(\d+)\s*<\/t[dh]>\s*<t[dh][^>]*>\s*([^<]+?)\s*<\/t[dh]>\s*<t[dh][^>]*>\s*([\d.]+)\s*%?/gi;
  for (const m of text.matchAll(htmlRe)) {
    add(Number(m[1]), m[2], numberish(m[3]), null, null, null);
  }

  const rows = [...seen.values()].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return { bench: parseBenchId(text), rows };
}

export function pickRow(rows, family, effort) {
  const candidates = rows.filter((r) => r.family === family && (effort == null || r.effort === effort));
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => b.score - a.score || (a.rank ?? 0) - (b.rank ?? 0))[0];
}

function displayName(row, spec, fallback) {
  if (!row) return fallback ?? null;
  if (spec.display === 'base') return parseModelName(row.name).base;
  return row.name;
}

export function pair(snapshot, policy) {
  const rows = snapshot.rows ?? [];
  const roles = {};
  for (const [role, specs] of Object.entries(policy.roles)) {
    const byFamily = {};
    const names = [];
    for (const spec of specs) {
      const row = pickRow(rows, spec.family, spec.effort);
      const name = displayName(row, spec, spec.fallback ? policy.fallbacks[spec.fallback] : null);
      if (!name) {
        throw new Error(`no ${spec.family}${spec.effort ? ` ${spec.effort}` : ''} row in snapshot (role ${role})`);
      }
      byFamily[spec.family] = name;
      names.push(name);
    }
    roles[role] = { ...byFamily, join: names.join(' · ') };
  }
  return roles;
}

export function joinNames(names) {
  return names.filter(Boolean).join(' · ');
}

function sameBase(a, b) {
  return parseModelName(a).base === parseModelName(b).base;
}

export function toolColumns(picks) {
  const claudeDeep = sameBase(picks.high.opus, picks.ceiling.opus)
    ? `${parseModelName(picks.high.opus).base} High or Max`
    : `${picks.high.opus} or ${picks.ceiling.opus}`;
  return {
    deep: {
      claude: claudeDeep,
      cursor: joinNames([picks.high.opus, picks.high.grok, picks.high.sol]),
      grok: picks.high.grok,
    },
    standard: {
      claude: picks.medium.opus,
      cursor: joinNames([picks.medium.composer, picks.medium.grok, picks.medium.sol]),
      grok: picks.medium.grok,
    },
    mechanical: {
      claude: joinNames([picks.mechanical.sonnet, picks.mechanical.haiku]),
      cursor: picks.mechanical.composer,
      grok: picks.mechanical.grok,
    },
  };
}

export function renderImproveTable(picks, policy) {
  const lines = ['| Command | What | Run as |', '|---|---|---|'];
  for (const row of policy.improve) {
    lines.push(`| ${row.command} | ${row.what} | ${picks[row.role].join} |`);
  }
  return lines.join('\n');
}

export function renderEffortTable(picks, policy, which) {
  const work = policy.effortWork[which];
  const cols = toolColumns(picks);
  const lines = [
    '| Tier | Work | Claude Code | Cursor | Grok Build |',
    '|---|---|---|---|---|',
    `| Deep | ${work.deep} | ${cols.deep.claude} | ${cols.deep.cursor} | ${cols.deep.grok} |`,
    `| Standard | ${work.standard} | ${cols.standard.claude} | ${cols.standard.cursor} | ${cols.standard.grok} |`,
    `| Mechanical | ${work.mechanical} | ${cols.mechanical.claude} | ${cols.mechanical.cursor} | ${cols.mechanical.grok} |`,
  ];
  return lines.join('\n');
}

export function renderProposingLine(picks) {
  const cols = toolColumns(picks);
  return `Deep — ${cols.deep.claude} · Cursor: ${cols.deep.cursor} · Grok Build: ${cols.deep.grok}`;
}

export function renderModelsDoc(snapshot, picks, policy) {
  const cols = toolColumns(picks);
  const slice = (snapshot.rows ?? []).filter((r) => SLICE_FAMILIES.has(r.family));
  const lines = [
    '<!-- Generated by `skills-setup models`. Do not edit. -->',
    '',
    '# Model scores',
    '',
    `CursorBench snapshot from ${snapshot.source}, fetched ${snapshot.fetchedAt}, bench \`${snapshot.bench}\`.`,
    'Families are pinned: Opus (not Fable), Grok, GPT Sol, Composer. Refresh with `node bin/cli.mjs models`.',
    '',
    'Grok has no Max. Extra High is its ceiling knob, not a claim it scores with Opus Max.',
    '',
    '## Pairing used in the repo',
    '',
    '| Role | Used for | Models |',
    '|---|---|---|',
    `| Ceiling | \`/improve deep\` | ${picks.ceiling.join} |`,
    `| High | other \`/improve\` advisor commands | ${picks.high.join} |`,
    `| Medium | \`review-plan\`, \`reconcile\`, Standard work | ${picks.medium.join} |`,
    `| Mechanical | executing a written plan | ${picks.mechanical.join} |`,
    '',
    'Across tools:',
    '',
    `| Tier | Claude Code | Cursor | Grok Build |`,
    `|---|---|---|---|`,
    `| Deep | ${cols.deep.claude} | ${cols.deep.cursor} | ${cols.deep.grok} |`,
    `| Standard | ${cols.standard.claude} | ${cols.standard.cursor} | ${cols.standard.grok} |`,
    `| Mechanical | ${cols.mechanical.claude} | ${cols.mechanical.cursor} | ${cols.mechanical.grok} |`,
    '',
    '## Leaderboard slice',
    '',
    'Opus, Sonnet, Grok, GPT Sol, and Composer only. Fable, Gemini, Muse, Terra, and Luna stay in',
    '[`data/benchmarks.json`](../data/benchmarks.json) and are not recommended.',
    '',
    '| Rank | Model | Score | Cost / task |',
    '|---|---|---|---|',
  ];
  for (const r of slice) {
    const cost = r.cost == null ? '—' : `$${r.cost}`;
    lines.push(`| ${r.rank} | ${r.name} | ${r.score}% | ${cost} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function applyRegion(text, id, inner) {
  const begin = MODELS_BEGIN(id);
  const end = MODELS_END(id);
  const start = text.indexOf(begin);
  if (start === -1) throw new Error(`missing models region "${id}"`);
  const afterBegin = start + begin.length;
  const endIdx = text.indexOf(end, afterBegin);
  if (endIdx === -1) throw new Error(`unclosed models region "${id}"`);
  if (text[afterBegin] !== '\n') {
    return `${text.slice(0, afterBegin)}${inner.trim()}${text.slice(endIdx)}`;
  }
  const chunk = inner.endsWith('\n') ? inner : `${inner}\n`;
  return `${text.slice(0, afterBegin)}\n${chunk}${end}${text.slice(endIdx + end.length)}`;
}

export function applyRegions(text, regions) {
  let next = text;
  for (const [id, inner] of Object.entries(regions)) {
    next = applyRegion(next, id, inner);
  }
  return next;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function fetchCursorBench(fetcher = fetch) {
  const res = await fetcher(CURSORBENCH_URL, {
    headers: { 'user-agent': 'mjeightyfive-skills', accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`CursorBench ${res.status}`);
  return res.text();
}

export function snapshotFromPage(text, policy, fetchedAt = new Date().toISOString()) {
  const { bench, rows } = parseLeaderboard(text, policy);
  if (rows.length < 10) {
    throw new Error(`CursorBench table parsed to ${rows.length} rows; need at least 10`);
  }
  const pinned = ['opus', 'grok', 'sol'];
  for (const family of pinned) {
    if (!rows.some((r) => r.family === family)) {
      throw new Error(`CursorBench parse missed family "${family}"`);
    }
  }
  return {
    source: CURSORBENCH_URL,
    fetchedAt,
    bench,
    rows,
  };
}

const FILE_REGIONS = [
  {
    file: 'README.md',
    regions: (picks, policy) => ({
      'improve-runs': renderImproveTable(picks, policy),
      'role-high': picks.high.join,
      'role-medium': picks.medium.join,
      'role-mechanical': picks.mechanical.join,
      'role-ceiling': picks.ceiling.join,
    }),
  },
  {
    file: 'docs/agents.md',
    regions: (picks, policy) => ({
      'effort-table': renderEffortTable(picks, policy, 'agents'),
    }),
  },
  {
    file: 'template/AGENTS.md',
    regions: (picks, policy) => ({
      'proposing-line': renderProposingLine(picks),
      'effort-table': renderEffortTable(picks, policy, 'template'),
    }),
  },
];

export function rewriteFiles(root, picks, policy) {
  const notes = [];
  for (const spec of FILE_REGIONS) {
    const path = join(root, spec.file);
    const previous = readFileSync(path, 'utf8');
    const next = applyRegions(previous, spec.regions(picks, policy));
    if (next !== previous) {
      writeFileSync(path, next);
      notes.push(spec.file);
    }
  }
  return notes;
}

export async function refreshModels({ root = ROOT, fetchPage = true, fetcher = fetch, log = console } = {}) {
  if (!isSkillsCheckout(root)) {
    throw new Error('models is source-repo only — run it from the skills git checkout');
  }
  const policy = loadPolicy(root);
  let snapshot = loadSnapshot(root);
  let fetched = false;

  if (fetchPage) {
    try {
      const text = await fetchCursorBench(fetcher);
      snapshot = snapshotFromPage(text, policy);
      writeJson(join(root, 'data', 'benchmarks.json'), snapshot);
      fetched = true;
      log.log(`✓ CursorBench ${snapshot.bench} (${snapshot.rows.length} rows)`);
    } catch (err) {
      if (!snapshot) throw err;
      log.error(`error fetching CursorBench: ${err.message}`);
      log.error('keeping last committed snapshot');
      return { snapshot, picks: pair(snapshot, policy), fetched: false, failed: true };
    }
  }

  if (!snapshot) throw new Error('no benchmarks.json snapshot');
  const picks = pair(snapshot, policy);
  writeFileSync(join(root, 'docs', 'models.md'), renderModelsDoc(snapshot, picks, policy));
  const rewritten = rewriteFiles(root, picks, policy);
  for (const file of rewritten) log.log(`✓ ${file} model regions`);
  if (!rewritten.length) log.log('· model regions already current');
  return { snapshot, picks, fetched, failed: false };
}
