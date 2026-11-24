# skills

One curated agent-skill set, shared across every project and every agent.

```bash
npx github:mjeightyfive/skills init --profile web
```

That installs the profile's skills into `.agents/skills/`, symlinks them for Claude Code, seeds
the policy files, and writes routing and named policy blocks into `AGENTS.md`. Cursor and Codex
read `.agents/skills/` directly. Commit `skills-lock.json` and the set is reproducible.

## How it is put together

Three kinds of skill, three mechanisms:

1. **Mine** live in [`skills/`](skills/) — forks I patched, and skills I wrote. A fork carries
   an `UPSTREAM.md` saying what it came from and what I changed, so the patch is never
   mistaken for the original.
2. **Everyone else's** stay at their source. [`skills.json`](skills.json) records which ones,
   and `skills update` pulls newer content from upstream. Nothing is mirrored into this repo,
   so nothing here goes stale.
3. **Policy** is not a skill at all. Skills load conditionally on a description match, so a
   rule that must hold on every turn cannot be one. Policy lives in
   [`template/`](template/) — `AGENTS.md` for the prose, and the per-agent config that
   actually enforces it. Marked sections in that file sync on `update`; unmarked prose is
   seed-only. See [docs/agents.md](docs/agents.md).

## The manifest is the decision

[`skills.json`](skills.json) is the whole system. It records the source of every skill, which
profile installs it, and — for everything not installed — why not.

When two skills compete for the same trigger, precedence runs mine, then Vercel, then everyone
else — and within that bottom tier, one owner per domain: Emil owns motion, Jakub owns static
interface, and the Karpathy guidelines own coding behaviour. Policy beats precedence:
`deploy-to-vercel` is tier 2 and still excluded, because it instructs the agent to run
`git commit` and `git push`.

Skills with `disable-model-invocation: true` never compete, because the model cannot fire them
— only you can, by name. That is why `prototype` and `variant` both stay despite doing the same
job, and it is why `improve` was patched to add the flag: without it, its prose narrowing was
advisory and it collided with `improve-animations`.

## Using improve

`improve` is in every profile. An expensive model audits the repo and writes plan files; a
cheaper one executes them in a later session. The advisor never edits source — the plan is
the product.

This is a patched fork of [shadcn/improve](https://github.com/shadcn/improve). That README is
the original guide; this is the subset that actually applies here. `execute` and `--issues`
are off (diffs, never history), the default effort is `quick` not `standard`, and the skill
only fires when you name it.

`quick` / `deep` is audit coverage, not model quality. Only `/improve deep` uses the ceiling
knobs. Names below come from [docs/models.md](docs/models.md) and refresh with
`skills-setup models`.

<!-- skills:models:improve-runs:begin -->
| Command | What | Run as |
|---|---|---|
| `/improve` | cheap pass, hotspots, top findings (default) | Opus 5.5 High · GPT-5.6 Sol High |
| `/improve deep` | every package, every category | Opus 5.5 High · GPT-5.6 Sol Max |
| `/improve security` | one category (also: perf, tests, bugs, …) | Opus 5.5 High · GPT-5.6 Sol High |
| `/improve branch` | only what the current branch changes | Opus 5.5 High · GPT-5.6 Sol High |
| `/improve next` | feature suggestions | Opus 5.5 High · GPT-5.6 Sol High |
| `/improve plan <description>` | skip the audit, spec one thing | Opus 5.5 High · GPT-5.6 Sol High |
| `/improve review-plan <file>` | critique and tighten an existing plan | Opus 5.5 Medium · GPT-5.6 Sol Medium |
| `/improve reconcile` | refresh the backlog | Opus 5.5 Medium · GPT-5.6 Sol Medium |
| implement `plans/NNN-*.md` | execute a written plan | Opus 5.5 Low · Haiku 5.5 · GPT-5.6 Sol Low |
<!-- skills:models:improve-runs:end -->

1. **(optional) Plan mode** — `Shift+Tab` (Claude: `/plan`). Recon, questions, findings
   table. Do not **Build**, do not approve-as-implement. Claude Plan mode blocks source
   edits. Cursor's plan file is a this-session artifact, not `plans/*.md`. Skip when already
   in Agent.
2. **Write the handoff** — Agent,
   <!-- skills:models:role-high:begin -->Opus 5.5 High · GPT-5.6 Sol High<!-- skills:models:role-high:end -->.
   `/improve plan add a --json flag to the list command, matching existing output flags` —
   or, after a bare `/improve` findings table, "plan 1, 3 and 5". Leave Plan mode first; it
   blocks the writes. Skip only when this same capable session should implement after Plan
   mode.
3. **(optional) Review** —
   <!-- skills:models:role-medium:begin -->Opus 5.5 Medium · GPT-5.6 Sol Medium<!-- skills:models:role-medium:end -->.
   `/improve review-plan plans/001-json-list-flag.md`. Skip if the file already looks tight.
4. **Implement** — **new session**, Agent (not Plan mode),
   <!-- skills:models:role-mechanical:begin -->Opus 5.5 Low · Haiku 5.5 · GPT-5.6 Sol Low<!-- skills:models:role-mechanical:end -->.
   `implement plans/001-json-list-flag.md`. Plan mode here would re-plan a spec that is
   already written.
5. **(optional) Reconcile** — later, same models as review. `/improve reconcile`. Skip
   until something has landed or stuck.

A full audit is the same loop with `/improve` (or `/improve deep` / `/improve branch`) at
step 2 instead of `/improve plan`. `/improve deep` uses
<!-- skills:models:role-ceiling:begin -->Opus 5.5 High · GPT-5.6 Sol Max<!-- skills:models:role-ceiling:end -->.
`/improve branch` before a PR.

## Using orchestrate

`orchestrate` is in every profile. It runs a task too large for one sitting inside the usage
limits: it reads the window and the cap, sizes the work against a held-back reserve, splits it
into stages that each end at a checkpoint, routes chunks to the smallest model tier that can do
them, has a fresh agent verify each finished change, and writes a plan file and a handoff when
a stage will not fit before the reset. When work goes to other sessions or tools, it prints one
prompt per piece, each carrying its tier and the model and effort to use in every tool.

Invoke it by name — `/orchestrate` followed by the task — or ask explicitly for an orchestrated,
budgeted run. It never fires on its own (`disable-model-invocation: true`), and it skips the
machinery for questions and small jobs.

Estimates come from `~/.ai/usage-calibration.jsonl`, which the skill creates when it is
missing. Each stage appends a row: date, task, tool, model, effort, and which limit the
percentage is of. Rows from the same tool and model give percentages; rows from any other give
relative sizes only. The file lives in the home directory, not in a repository, so every
project and every tool reads the same history.

It is a skill rather than policy because it is a procedure for one kind of request, not a rule
that must hold on every turn. Loaded on every turn it would cost context in every session that
never orchestrates anything; loaded on request it costs nothing until it is used.

Run it on the strongest tier at high effort — the Deep row of the effort table in
[docs/agents.md](docs/agents.md#model-and-effort), in whichever tool you are in. The
orchestrating session decides, routes and integrates; the prompts it prints carry their own
tiers.

## Staying current

`skills update` pulls newer content for skills already listed. It cannot tell you an upstream
grew a skill you have never ruled on — that is what `audit` is for. Model names in this README
and in `AGENTS.md` come from CursorBench and refresh with `skills-setup models`.

```bash
npx github:mjeightyfive/skills audit
```

It lists every upstream skill that is neither installed nor explicitly excluded, with its
description, and exits non-zero while any remain undecided. Each one gets added to a profile or
to `exclude` with a reason. Nothing is installed by drift.

The full sequence — models, audit, update every consumer, commit — is in
[docs/updating.md](docs/updating.md), along with the traps worth knowing.

## Commands

| | |
|---|---|
| `init --profile <name>` | Install a profile here, seed policy files, write routing and policy blocks |
| `update --profile <name>` | Pull newer upstream content, regenerate routing and policy blocks |
| `models` | Fetch CursorBench and rewrite model names in this repo (source checkout only) |
| `audit` | Report upstream skills the manifest has never ruled on |
| `list --profile <name>` | Show what a profile resolves to, and what is excluded and why |
| `global` | Install the user-level skills once |

`--agents` overrides the target list, which defaults to Claude Code, Cursor, Codex and the
universal directory.

## Profiles

| | |
|---|---|
| `core` | Any repository, any stack |
| `web` | React, Next.js, Tailwind |
| `cli` | Command-line tools and services with no UI surface |
| `mobile` | React Native and Expo |
| `swift` | Native Swift |

Profiles extend `core`, so a stack-specific profile is only the delta.
