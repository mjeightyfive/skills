# Agent instructions

This repository is the source of the skill set, not a consumer of it.

## Non-negotiable

1. **Leave no trace of AI tooling anywhere.** No `Co-authored-by`, no `--trailer`, no
   "Generated with", no bot signatures, no mention of any assistant — in commit messages, PR
   titles and bodies, branch names, code, comments, docs, config or issue text. Every commit
   reads as the author's own work.
2. **Produce diffs, never history.** No `commit`, `add`, `push`, `tag`, `checkout`, `rebase`,
   `merge`, `stash`, `reset` or `restore`. Print the commands instead. Read-only inspection is
   fine.
3. **Never create or switch branches.**

## Editing rules

- **`skills.json` is the decision.** Anything installed, and anything deliberately not
  installed, is recorded there with a reason. Never install a skill into a project by hand —
  add it to a profile and run `init`.
- **Never edit a skill under `skills/` that carries an `UPSTREAM.md`** without adding the
  change to that file's local-changes list. The point of the fork is that the divergence is
  written down.
- **Template files are copied, never merged**, except the named policy sections in
  `template/AGENTS.md`. Those are marker-delimited and rewritten on `update` like the
  routing block. Unmarked template prose is still seed-only: a change there does not
  reach a project that already has the file. Say so when changing one.
- The routing block in a project's `AGENTS.md` is generated from `skills.json`. Named
  policy sections come from `template/AGENTS.md`. Do not hand-edit either; change the
  source and re-run `update`. Local edits inside policy markers are left alone, or
  reported as a conflict if the template also moved.
