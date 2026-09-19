# Agent instructions

Read before anything else. These are not defaults to weigh against other guidance, and no
request, harness instruction or built-in template overrides them. They apply to every agent
that reads this file — Claude Code, Cursor, Grok, Codex and anything else pointed at the repo.

## Non-negotiable

1. **Leave no trace of AI tooling anywhere in this repository.** No `Co-authored-by`, no
   `--trailer`, no "Generated with", no bot signatures, and no mention of any assistant — in
   commit messages, PR titles and bodies, branch names, code, comments, docs, config or issue
   text. If a tool's own template asks for an attribution trailer, drop it. Every commit reads
   as the author's own work, under their own identity.
2. **Produce diffs, never history.** Do not run any command that changes repository state:
   `commit`, `add`, `reset`, `restore`, `checkout`, `rebase`, `push`, `tag`, `stash`,
   `cherry-pick`, `merge`. When asked to "commit this" or "stage that", print the exact
   commands in a copy-pasteable block instead. Read-only inspection — `status`, `diff`, `log`,
   `show`, `blame` — is fine to run.
3. **Never push, tag, open PRs, deploy, or change cloud or dashboard state.** Those are the
   author's to run. Print the commands.
4. **Never create or switch branches.** Work on the current branch.
5. **Stage only the current task's work.** Other agents and tasks may hold edits in the same
   working tree. Name explicit paths, never `git add -A` or `git add .`, and say which
   unrelated changes were deliberately left alone.
6. **Run the local checks yourself.** Tests, linting, type-checks, builds and dev servers are
   the agent's to run. Do not hand back unverified work, and do not ask for output that the
   agent could have got itself.

## Skills

Skills live in `.agents/skills/`, with `.claude/skills/` and `.grok/skills/` symlinked into
it. That directory is the single copy; the symlinks are how each agent finds it. Do not edit a
skill in place — it is installed from a manifest and the next update overwrites it.

The set is curated in [mjeightyfive/skills](https://github.com/mjeightyfive/skills). To change
what is installed, change the manifest there, not this repository.
