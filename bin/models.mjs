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

const EFFORT_LABELS = Object.fromEntries(EFFORTS.map(({ key, label }) => [key, label]));

const SLICE_FAMILIES = new Set(['opus', 'sonnet', 'haiku', 'sol', 'terra', 'luna', 'astra']);

const TIERS = ['deep', 'standard', 'mechanical'];

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

  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const row of text.matchAll(rowRe)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      decodeEntities(cell[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')),
    );
    const rank = numberish(cells[0]);
    if (!Number.isInteger(rank)) continue;
    add(rank, cells[1], numberish(cells[2]), numberish(cells[3]), numberish(cells[4]), numberish(cells[5]));
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

/** `gpt-6.2-sol` is CursorBench's `GPT-6.2 Sol`: the same family, spelled for the CLI. */
export function codexBoardName(model) {
  const m = model.match(/^gpt-([\d.]+)-([a-z]+)$/i);
  if (!m) return null;
  return `GPT-${m[1]} ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}`;
}

/**
 * CursorBench does not rank the Codex models, so their names come from the
 * policy, which records them from the calibration file. Each must still name a
 * GPT family the policy knows, so a typo fails here rather than in a table.
 */
export function codexCells(policy) {
  const cells = {};
  for (const tier of TIERS) {
    const spec = policy.codex?.[tier];
    if (!spec) throw new Error(`no codex ${tier} model in policy`);
    const board = codexBoardName(spec.model);
    const family = board && classifyFamily(board, policy);
    if (!family) throw new Error(`codex model "${spec.model}" matches no family in policy`);
    const label = EFFORT_LABELS[spec.effort];
    if (!label) throw new Error(`codex ${tier} effort "${spec.effort}" is not a known effort`);
    cells[tier] = { name: `${spec.model} ${label}`, model: spec.model, family };
  }
  return cells;
}

/**
 * Cursor families the owner pins without a board pick. The board need not
 * contain them; only a malformed pin fails. `lead` puts the pin first in its
 * tier's cell, otherwise it follows the measured names.
 */
export function pinnedCursorCells(policy) {
  const cells = Object.fromEntries(TIERS.map((tier) => [tier, { lead: [], tail: [] }]));
  for (const [family, spec] of Object.entries(policy.cursorPinned ?? {})) {
    if (typeof spec?.model !== 'string' || !spec.model.trim()) {
      throw new Error(`pinned cursor family "${family}" has no model`);
    }
    for (const tier of TIERS) {
      const effort = spec[tier]?.effort;
      if (!effort) throw new Error(`pinned cursor family "${family}" has no ${tier} effort`);
      const label = EFFORT_LABELS[effort];
      if (!label) throw new Error(`pinned cursor ${family} ${tier} effort "${effort}" is not a known effort`);
      cells[tier][spec[tier].lead ? 'lead' : 'tail'].push(`${spec.model} ${label}`);
    }
  }
  return cells;
}

export function toolColumns(picks, policy) {
  const codex = codexCells(policy);
  const pinned = pinnedCursorCells(policy);
  const cursor = (tier, names) => joinNames([...pinned[tier].lead, ...names, ...pinned[tier].tail]);
  return {
    deep: {
      claude: picks.high.opus,
      cursor: cursor('deep', [picks.high.opus, picks.high.sol]),
      codex: codex.deep.name,
    },
    standard: {
      claude: picks.medium.opus,
      cursor: cursor('standard', [picks.medium.opus, picks.medium.sol]),
      codex: codex.standard.name,
    },
    mechanical: {
      claude: joinNames([picks.mechanical.opus, picks.mechanical.haiku]),
      cursor: cursor('mechanical', [picks.mechanical.opus, picks.mechanical.sol]),
      codex: codex.mechanical.name,
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
  const cols = toolColumns(picks, policy);
  const lines = [
    '| Tier | Work | Claude Code | Cursor | Codex |',
    '|---|---|---|---|---|',
    `| Deep | ${work.deep} | ${cols.deep.claude} | ${cols.deep.cursor} | ${cols.deep.codex} |`,
    `| Standard | ${work.standard} | ${cols.standard.claude} | ${cols.standard.cursor} | ${cols.standard.codex} |`,
    `| Mechanical | ${work.mechanical} | ${cols.mechanical.claude} | ${cols.mechanical.cursor} | ${cols.mechanical.codex} |`,
  ];
  return lines.join('\n');
}

export function renderProposingLine(picks, policy) {
  const cols = toolColumns(picks, policy);
  return `Deep — ${cols.deep.claude} · Cursor: ${cols.deep.cursor} · Codex: ${cols.deep.codex}`;
}

export function renderModelsDoc(snapshot, picks, policy) {
  const cols = toolColumns(picks, policy);
  const codex = codexCells(policy);
  const slice = (snapshot.rows ?? []).filter((r) => SLICE_FAMILIES.has(r.family));
  const lines = [
    '<!-- Generated by `skills-setup models`. Do not edit. -->',
    '',
    '# Model scores',
    '',
    `CursorBench snapshot from ${snapshot.source}, fetched ${snapshot.fetchedAt}, bench \`${snapshot.bench}\`.`,
    'Families are pinned: Opus (with Haiku for mechanical work) and GPT, plus Grok in Cursor. Refresh with `node bin/cli.mjs models`.',
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
    `| Tier | Claude Code | Cursor | Codex |`,
    `|---|---|---|---|`,
    `| Deep | ${cols.deep.claude} | ${cols.deep.cursor} | ${cols.deep.codex} |`,
    `| Standard | ${cols.standard.claude} | ${cols.standard.cursor} | ${cols.standard.codex} |`,
    `| Mechanical | ${cols.mechanical.claude} | ${cols.mechanical.cursor} | ${cols.mechanical.codex} |`,
    '',
    '## Codex',
    '',
    `CursorBench does not rank the Codex models. Their names come from the calibration rows in \`${policy.codex.source}\`,`,
    'recorded under `codex` in [`data/models.json`](../data/models.json), and each is matched to a board family by name.',
    '',
    '| Tier | Codex | Family | On the board |',
    '|---|---|---|---|',
  ];
  for (const tier of TIERS) {
    const cell = codex[tier];
    const bases = [
      ...new Set((snapshot.rows ?? []).filter((r) => r.family === cell.family).map((r) => parseModelName(r.name).base)),
    ];
    const label = `${tier[0].toUpperCase()}${tier.slice(1)}`;
    lines.push(`| ${label} | ${cell.name} | ${cell.family} | ${bases.length ? bases.join(', ') : '—'} |`);
  }
  const pinned = Object.values(policy.cursorPinned ?? {});
  if (pinned.length) {
    lines.push(
      '',
      '## Pinned in Cursor',
      '',
      `${pinned.map((spec) => spec.model).join(', ')} is pinned, not measured: the Cursor cells name it at the efforts set`,
      'under `cursorPinned` in [`data/models.json`](../data/models.json), whatever the board ranks.',
      '',
      '| Tier | Cursor pin |',
      '|---|---|',
    );
    const cells = pinnedCursorCells(policy);
    for (const tier of TIERS) {
      const label = `${tier[0].toUpperCase()}${tier.slice(1)}`;
      lines.push(`| ${label} | ${joinNames([...cells[tier].lead, ...cells[tier].tail])} |`);
    }
  }
  lines.push(
    '',
    '## Leaderboard slice',
    '',
    'Opus, Sonnet, Haiku and GPT only. Every other family stays in',
    '[`data/benchmarks.json`](../data/benchmarks.json) and is not recommended.',
    '',
    '| Rank | Model | Score | Cost / task |',
    '|---|---|---|---|',
  );
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

function jsonField(value) {
  return value == null ? 'null' : JSON.stringify(value);
}

function writeSnapshot(path, snapshot) {
  const rows = snapshot.rows
    .map(
      (row) =>
        `    { "rank": ${row.rank}, "name": ${jsonField(row.name)}, "family": ${jsonField(row.family)}, "effort": ${jsonField(row.effort)}, "score": ${jsonField(row.score)}, "cost": ${jsonField(row.cost)}, "tokens": ${jsonField(row.tokens)}, "steps": ${jsonField(row.steps)} }`,
    )
    .join(',\n');
  writeFileSync(
    path,
    `{
  "source": ${JSON.stringify(snapshot.source)},
  "fetchedAt": ${JSON.stringify(snapshot.fetchedAt)},
  "bench": ${JSON.stringify(snapshot.bench)},
  "rows": [
${rows}
  ]
}
`,
  );
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
  const pinned = ['opus', 'sol'];
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
      'proposing-line': renderProposingLine(picks, policy),
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
      writeSnapshot(join(root, 'data', 'benchmarks.json'), snapshot);
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
