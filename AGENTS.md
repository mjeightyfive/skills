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
- **Template files are copied, never merged.** `init` skips a destination that already exists,
  so a change in `template/` does not reach a project that already has the file. Say so when
  changing one.
- The routing block in a project's `AGENTS.md` is generated from `skills.json`. Do not hand-edit
  it anywhere; change the manifest and re-run `update`.
