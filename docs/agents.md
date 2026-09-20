# Agents

Where each tool reads from, how the policy is enforced there, and which model to reach for.

## What each agent reads

`.agents/skills/<name>/SKILL.md` is the only copy of a skill. Everything else points at it.

| Agent | Skills | Instructions | Enforcement |
|---|---|---|---|
| Claude Code | `.claude/skills/` → symlink | `CLAUDE.md`, `AGENTS.md` | `.claude/settings.json` `permissions.deny` |
| Grok Build | `.grok/skills/` → symlink, and `.agents/skills/` directly | `AGENTS.md`, and it also reads `CLAUDE.md` and `.claude/` | `.grok/settings.json`; `grok inspect` shows what was picked up |
| Cursor | `.agents/skills/` directly | `AGENTS.md`, `.cursor/rules/*.mdc` | allowlist Run Mode (global setting, not a repo file) |
| Codex | `.agents/skills/` directly | `AGENTS.md` | sandbox mode |

Grok reading `.claude/` and `CLAUDE.md` unprompted is the quiet win here: a repo set up for
Claude Code is already set up for Grok. Cursor and Codex need `AGENTS.md`, which the template
provides.

## Enforcement is not portable

The policy prose in `AGENTS.md` is advisory in every tool — a model can read it and still
decide to run `git commit`. Only some tools can actually block the call, and they do it
differently:

- **Claude Code** — `permissions.deny` in `.claude/settings.json` is checked before the tool
  runs. This is the real boundary, and the template ships it.
- **Cursor** — the denylist was deprecated in 1.3 and was never a boundary anyway (a pattern
  blocks one spelling and misses the alias, the subshell, the script). Use allowlist Run Mode
  instead: permit `git status`, `git diff`, `git log`, `git show`, `git blame` and the project's
  test and build commands, and let everything else prompt. It is a global setting, so it is set
  once per machine, not per repo.
- **Grok Build** — `.grok/settings.json` per project. It also honours `.claude/` hooks.

Treat all three as guardrails, not sandboxes. The reason the rule is also written into
`AGENTS.md` is that the guardrail catches the obvious spelling and the prose catches the intent.

## How AGENTS.md is kept in sync

Two generated regions, both marker-delimited, both rewritten on `init` and `update`:

1. **The routing block** (`<!-- skills:begin -->`) — derived from `skills.json`. Always
   regenerated. Do not edit it.
2. **Named policy sections** (`<!-- skills:policy:<id>:begin -->`) — copied from
   `template/AGENTS.md`. Regenerated when the copy is still what the CLI last wrote. If the
   author has edited inside the markers, the CLI leaves the text alone; if the template also
   moved, it reports a conflict and refuses to overwrite.

They are several named sections, not one policy block. A consumer's `AGENTS.md` is mostly
theirs — mje.fi rewrote Non-negotiable, exy replaced it with No AI traces. One wrap around
the whole template would either stamp over that or sit in permanent conflict, and a new
section like Proposing work could not land without taking the rest. Each portable section is
its own region, opted in by markers in the template. Unmarked headings in the template are
still seed-only: copied on first `init`, never merged, same as `settings.json`. Today the
only opted-in section is Proposing work; Non-negotiable and Skills stay unmarked because
every consumer has rewritten them.

When a marked section is missing, `update` inserts it before the routing block (or after the
nearest already-present policy section, so template order holds). When the heading is already
there without markers and the text still matches the template, the CLI wraps it in place
rather than appending a duplicate.

The hash on the begin marker is a dirty bit, not a signature. It records what the CLI last
wrote so a later `update` can tell a local edit from a stale copy.

## Model and effort

Work splits into three tiers. The table maps them across the three tools; model lineups move
quarterly, so check the picker rather than trusting the name.

| Tier | Work | Claude Code | Cursor | Grok Build |
|---|---|---|---|---|
| Deep | Architecture, multi-file refactor, repo audits, debugging something that resists a first guess | Opus 5, high or max effort | Claude Opus 5, or Grok 4.6 at high effort | Grok 4.6, high effort |
| Standard | Feature work against a clear spec, a contained bug fix, a review | Opus 5, medium effort | Composer 2.5, or Grok 4.6 at medium | Grok 4.6, medium effort |
| Mechanical | Renames, file moves, config edits, boilerplate, anything where the answer is already decided | Sonnet 5, or Haiku 4.5 for pure mechanics | Composer 2.5 | Grok 4.5, fast mode |

Notes that bite in practice:

- Cursor's effort switching and fast mode need Pro or higher. On the entry plan Grok 4.5 and
  4.6 are pinned to medium effort, so the Deep row collapses into the Standard row.
- Composer 2.5 calibrates its own effort from the task, so there is no dial to set — which
  makes it a poor fit for the Deep tier, where you want to force more work than the task
  appears to need.
- The `improve` skill is explicit-invoke and read-only. Run it at the Deep tier; it produces
  plan files that the Mechanical tier can then execute without re-reading the codebase. That
  split is the whole point of the skill.

## Switching tools mid-task

The skill set, the instructions and the lockfile are all in the repo, so switching is just
opening the other tool in the same directory. The two things that do not carry over:

- **Session context.** Hand off through a file, not a paste. `improve` writes plan files for
  exactly this reason.
- **Enforcement.** Moving from Claude Code to Cursor drops the `permissions.deny` boundary and
  leaves only the prose. Set the Cursor allowlist once and it stops mattering.
