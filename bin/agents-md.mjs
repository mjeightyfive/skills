import { createHash } from 'node:crypto';

export const ROUTING_BEGIN = '<!-- skills:begin -->';
export const ROUTING_END = '<!-- skills:end -->';

const POLICY_BEGIN = (id) => `<!-- skills:policy:${id}:begin`;
const POLICY_END = (id) => `<!-- skills:policy:${id}:end -->`;

const ANY_BEGIN_RE = /<!-- skills:(?:policy:[a-z0-9-]+:)?begin(?:\s+hash="[a-f0-9]+")? -->/g;

export function hashBlock(s) {
  return createHash('sha256').update(normalizeBlock(s), 'utf8').digest('hex').slice(0, 16);
}

export function normalizeBlock(s) {
  const t = s.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return `${t}\n`;
}

export function renderPolicySection(id, inner) {
  const body = normalizeBlock(inner);
  return `${POLICY_BEGIN(id)} hash="${hashBlock(body)}" -->\n\n${body}\n${POLICY_END(id)}\n`;
}

export function parsePolicySections(template) {
  const sections = [];
  const re = /<!-- skills:policy:([a-z0-9-]+):begin(?:\s+hash="[a-f0-9]+")? -->([\s\S]*?)<!-- skills:policy:\1:end -->/g;
  let m;
  while ((m = re.exec(template))) {
    const id = m[1];
    const inner = normalizeBlock(m[2]);
    const title = headingTitle(inner);
    if (!title) {
      throw new Error(`template policy "${id}" has no H2 heading`);
    }
    if (sections.some((s) => s.id === id)) {
      throw new Error(`template policy "${id}" is declared twice`);
    }
    sections.push({ id, inner, title });
  }
  const begins = template.match(/<!-- skills:policy:[a-z0-9-]+:begin/g) ?? [];
  if (begins.length !== sections.length) {
    throw new Error('template/AGENTS.md has a policy begin marker without a matching end');
  }
  return sections;
}

/**
 * Rewrite named policy sections, then the routing block. Policy is three-way:
 * still what we last wrote → regenerate; local edits only → leave alone;
 * local edits and a newer template → conflict, never overwrite.
 */
export function syncAgentsMd(body, { sections, routing }) {
  let text = body.replace(/\r\n/g, '\n');
  const notes = [];
  const conflicts = [];
  const missing = [];

  for (const section of sections) {
    const result = syncExisting(text, section);
    if (result.missing) {
      missing.push(section);
      continue;
    }
    text = result.text;
    if (result.note) notes.push(result.note);
    if (result.conflict) conflicts.push(result.conflict);
  }

  for (const section of missing) {
    const at = insertionIndex(text, section, sections);
    text = insertAt(text, at, renderPolicySection(section.id, section.inner));
    notes.push(`policy "${section.id}" inserted`);
  }

  text = applyRouting(text, routing);
  if (body.endsWith('\n') && !text.endsWith('\n')) text += '\n';
  if (!text.endsWith('\n')) text += '\n';
  return { body: text, notes, conflicts };
}

export function applyRouting(body, block) {
  if (body.includes(ROUTING_BEGIN) && body.includes(ROUTING_END)) {
    return body.replace(new RegExp(`${ROUTING_BEGIN}[\\s\\S]*?${ROUTING_END}`), block);
  }
  return `${body.replace(/[ \t\n]+$/, '')}\n\n${block}\n`;
}

function headingTitle(inner) {
  const m = inner.match(/^##[ \t]+(.+?)[ \t]*$/m);
  return m?.[1] ?? null;
}

function syncExisting(text, section) {
  const expected = normalizeBlock(section.inner);
  const expectedHash = hashBlock(expected);
  const marked = findMarked(text, section.id);

  if (marked) {
    if (marked.unclosed) {
      return {
        text,
        conflict: `policy "${section.id}" is missing its end marker; left as-is`,
      };
    }
    const current = normalizeBlock(marked.inner);
    if (current === expected) {
      const rendered = renderPolicySection(section.id, expected);
      if (text.slice(marked.start, marked.end) === rendered) {
        return { text };
      }
      return {
        text: splice(text, marked.start, marked.end, rendered),
        note: `policy "${section.id}" markers refreshed`,
      };
    }
    const pristine = Boolean(marked.hash) && hashBlock(current) === marked.hash;
    if (pristine) {
      return {
        text: splice(text, marked.start, marked.end, renderPolicySection(section.id, expected)),
        note: `policy "${section.id}" updated from template`,
      };
    }
    if (marked.hash && marked.hash !== expectedHash) {
      return {
        text,
        conflict: `policy "${section.id}" has local edits and the template moved; left as-is`,
      };
    }
    return { text, note: `policy "${section.id}" has local edits, left alone` };
  }

  const unmarked = findUnmarkedH2(text, section.title);
  if (!unmarked) return { text, missing: true };

  if (normalizeBlock(unmarked.inner) === expected) {
    return {
      text: splice(text, unmarked.start, unmarked.end, renderPolicySection(section.id, expected)),
      note: `policy "${section.id}" wrapped in place`,
    };
  }
  return {
    text,
    conflict: `policy "${section.id}": heading "## ${section.title}" exists with local text; left as-is`,
  };
}

function findMarked(text, id) {
  const beginRe = new RegExp(`${escapeRe(POLICY_BEGIN(id))}(?:\\s+hash="([a-f0-9]+)")? -->`);
  const m = beginRe.exec(text);
  if (!m) return null;
  const endMarker = POLICY_END(id);
  const endIdx = text.indexOf(endMarker, m.index + m[0].length);
  if (endIdx === -1) return { unclosed: true, start: m.index };
  let end = endIdx + endMarker.length;
  if (text[end] === '\n') end += 1;
  return {
    start: m.index,
    end,
    hash: m[1] ?? null,
    inner: text.slice(m.index + m[0].length, endIdx),
  };
}

function findUnmarkedH2(text, title) {
  const skip = skipRanges(text);
  const headingRe = new RegExp(`^##[ \\t]+${escapeRe(title)}[ \\t]*$`, 'gm');
  let m;
  while ((m = headingRe.exec(text))) {
    if (inRanges(m.index, skip)) continue;
    const start = m.index;
    const end = nextBoundary(text, start + m[0].length, skip);
    return { start, end, inner: text.slice(start, end) };
  }
  return null;
}

function nextBoundary(text, from, skip) {
  const re = /^(#{1,2} )|^<!-- skills:begin|^<!-- skills:policy:/gm;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(text))) {
    if (inRanges(m.index, skip)) continue;
    return m.index;
  }
  return text.length;
}

function locateManaged(text, section) {
  const marked = findMarked(text, section.id);
  if (marked && !marked.unclosed) return marked;
  return findUnmarkedH2(text, section.title);
}

function insertionIndex(text, section, all) {
  const idx = all.findIndex((s) => s.id === section.id);
  for (let i = idx + 1; i < all.length; i++) {
    const pos = locateManaged(text, all[i]);
    if (pos) return pos.start;
  }
  for (let i = idx - 1; i >= 0; i--) {
    const pos = locateManaged(text, all[i]);
    if (pos) return pos.end;
  }
  const routing = text.indexOf(ROUTING_BEGIN);
  return routing === -1 ? text.length : routing;
}

function skipRanges(text) {
  const ranges = [];
  let fenceStart = null;
  let off = 0;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (fenceStart == null) fenceStart = off;
      else {
        ranges.push([fenceStart, off + line.length]);
        fenceStart = null;
      }
    }
    off += line.length + (i < lines.length - 1 ? 1 : 0);
  }
  if (fenceStart != null) ranges.push([fenceStart, text.length]);

  ANY_BEGIN_RE.lastIndex = 0;
  let m;
  while ((m = ANY_BEGIN_RE.exec(text))) {
    const policyId = m[0].match(/policy:([a-z0-9-]+):begin/)?.[1];
    const endMarker = policyId ? POLICY_END(policyId) : ROUTING_END;
    const e = text.indexOf(endMarker, m.index + m[0].length);
    ranges.push([m.index, e === -1 ? text.length : e + endMarker.length]);
  }
  return ranges;
}

function inRanges(index, ranges) {
  return ranges.some(([a, b]) => index >= a && index < b);
}

function splice(text, start, end, chunk) {
  return join(text.slice(0, start), chunk, text.slice(end));
}

function insertAt(text, index, chunk) {
  let before = text.slice(0, index);
  if (before && !before.endsWith('\n\n')) before = before.endsWith('\n') ? before + '\n' : before + '\n\n';
  return join(before, chunk, text.slice(index));
}

function join(before, block, after) {
  const left = before && !before.endsWith('\n') ? `${before}\n` : before;
  const mid = block.endsWith('\n') ? block : `${block}\n`;
  if (!after) return left + mid;
  const gap = after.startsWith('\n') ? '' : '\n';
  return left + mid + gap + after;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
