# skills

One curated agent-skill set, shared across every project and every agent.

```bash
npx github:mjeightyfive/skills init --profile web
```

That installs the profile's skills into `.agents/skills/`, symlinks them for Claude Code and
Grok, seeds the policy files, and writes a routing block into `AGENTS.md`. Commit
`skills-lock.json` and the set is reproducible.

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
   actually enforces it. See [docs/agents.md](docs/agents.md).

## The manifest is the decision

[`skills.json`](skills.json) is the whole system. It records the source of every skill, which
profile installs it, and — for everything not installed — why not.

When two skills compete for the same trigger, precedence runs mine, then Vercel, then everyone
else — and within that bottom tier, one owner per domain: Emil owns motion, Jakub owns static
interface. Policy beats precedence: `deploy-to-vercel` is tier 2 and still excluded, because it
instructs the agent to run `git commit` and `git push`.

Skills with `disable-model-invocation: true` never compete, because the model cannot fire them
— only you can, by name. That is why `prototype` and `variant` both stay despite doing the same
job, and it is why `improve` was patched to add the flag: without it, its prose narrowing was
advisory and it collided with `improve-animations`.

## Staying current

`skills update` pulls newer content for skills already listed. It cannot tell you an upstream
grew a skill you have never ruled on — that is what `audit` is for:

```bash
npx github:mjeightyfive/skills audit
```

It lists every upstream skill that is neither installed nor explicitly excluded, with its
description, and exits non-zero while any remain undecided. Each one gets added to a profile or
to `exclude` with a reason. Nothing is installed by drift.

The full sequence — audit, update every consumer, commit — is in
[docs/updating.md](docs/updating.md), along with the traps worth knowing.

## Commands

| | |
|---|---|
| `init --profile <name>` | Install a profile here, seed policy files, write the routing block |
| `update --profile <name>` | Pull newer upstream content, regenerate the routing block |
| `audit` | Report upstream skills the manifest has never ruled on |
| `list --profile <name>` | Show what a profile resolves to, and what is excluded and why |
| `global` | Install the user-level skills once |

`--agents` overrides the target list, which defaults to Claude Code, Cursor, Grok, Codex and
the universal directory.

## Profiles

| | |
|---|---|
| `core` | Any repository, any stack |
| `web` | React, Next.js, Tailwind |
| `cli` | Command-line tools and services with no UI surface |
| `mobile` | React Native and Expo |
| `swift` | Native Swift |

Profiles extend `core`, so a stack-specific profile is only the delta.
