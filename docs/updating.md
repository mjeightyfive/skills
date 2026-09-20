# Updating

Two different things go stale, and they need different commands.

- **Skill content** moves when an upstream edits a skill you already have. `update` pulls it.
- **The set itself** moves when an upstream *adds* a skill. Nothing pulls that, because nothing
  knows whether you want it. `audit` reports it and you rule on it in `skills.json`.

Run `audit` first. Deciding after you have already propagated an update means doing it twice.

## The runbook

Check for skills no one has ruled on yet:

```bash
cd ~/Dev/skills && node bin/cli.mjs audit
```

It exits non-zero while anything is undecided. Add each to a profile or to `exclude` with a
reason, commit, and push before going further.

Update every consumer repository:

```bash
for pair in /Users/marcin/Sites/mje.fi:web /Users/marcin/Dev/exy:cli; do cd "${pair%:*}" && node ~/Dev/skills/bin/cli.mjs update --profile "${pair#*:}"; done
```

Update the user-level skills, which the wrapper does not cover:

```bash
npx -y skills@latest update -g -y
```

Commit each consumer:

```bash
cd /Users/marcin/Sites/mje.fi && pnpm verify && git add skills-lock.json .agents/skills .claude/skills AGENTS.md && git commit -m "Update agent skills"
```

```bash
cd ~/Dev/exy && git add skills-lock.json .agents/skills .claude/skills AGENTS.md && git commit -m "Update agent skills"
```

## Things that bite

**`--profile` is required and defaults to `web`.** Run `update` in a `cli` project without it
and the generated `AGENTS.md` block is rewritten to claim the web set. The installed skills stay
correct — it is the block that lies. Read the `AGENTS.md` diff before committing.

**Use the local checkout, not `npx github:`.** npx caches GitHub specs, so right after you push
a manifest change the npx form can still serve the old one. `node ~/Dev/skills/bin/cli.mjs` reads
the working copy. The npx form is for machines without the checkout — pull first if you push
from more than one machine.

**The consumer list lives in that loop, not in the manifest.** Adding a project means editing
the loop. If that list grows past a handful, move it into `skills.json` and read it back.

**A skill is addressed by its declared `name:`, not its directory.** Four Vercel skills declare a
`vercel-` prefix, mapped under `installNames` in the manifest. A silent partial install — fewer
skills than the profile lists, reported as success — is this. Compare
`ls .agents/skills | wc -l` against `node bin/cli.mjs list --profile <name>`.
