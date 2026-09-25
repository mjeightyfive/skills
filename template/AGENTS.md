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

<!-- skills:policy:proposing-work:begin -->

## Proposing work

Whenever work is proposed, handed to another session, or listed as an option, **name the
model and the effort level to run it at — in every tool, not just the one you are in.** A
recommendation that names only the current tool's model is unusable the moment the work moves,
and moving work between tools is the normal case here, not the exception.

More than one task means a table before the first prompt:

| # | Step | Tier | Claude Code | Cursor | Grok Build |
|---|---|---|---|---|---|

A single task carries the same information on one line — `<!-- skills:models:proposing-line:begin -->Deep — Opus 5 High or Max · Cursor: Opus 5 High · Grok 4.7 High · GPT-5.6 Sol High · Grok Build: Grok 4.7 High<!-- skills:models:proposing-line:end -->`. A step that needs no model at all, such
as running a gate or a commit, is listed as "no model" rather than left out.

<!-- skills:models:effort-table:begin -->
| Tier | Work | Claude Code | Cursor | Grok Build |
|---|---|---|---|---|
| Deep | Architecture, multi-file refactor, repo audits, debugging that resists a first guess | Opus 5 High or Max | Opus 5 High · Grok 4.7 High · GPT-5.6 Sol High | Grok 4.7 High |
| Standard | Feature work against a clear spec, a contained fix, a review | Opus 5 Medium | Composer 2.5 · Grok 4.7 Medium · GPT-5.6 Sol Medium | Grok 4.7 Medium |
| Mechanical | Renames, file moves, config edits, executing an already-written plan | Sonnet 5 · Haiku 4.5 | Composer 2.5 | Grok 4.7 Fast |
<!-- skills:models:effort-table:end -->

Three caveats that bite in practice. Cursor's effort switching needs Pro or higher, below
which Grok 4.5, 4.6, and 4.7 pin to medium and the Deep row collapses into Standard. Composer 2.5
calibrates its own effort from the task, which makes it a poor fit for Deep, where the point
is forcing more work than the task appears to need. And enforcement does not travel: moving a
step from Claude Code to Cursor or Codex drops `permissions.deny` and leaves only the prose
above, so say so when a step runs near git.

The prompt text itself is portable. Write it once; only the model, the effort and the
enforcement differ between tools.

Every handed-off prompt names its finish line, and when to stop and report.

<!-- skills:policy:proposing-work:end -->

<!-- skills:policy:long-runs:begin -->

## Long runs

Keep going until the named finish line. Stop only when blocked, or at a stop the author, a plan, or a skill has named. Print destructive steps. Keep the task list in a file in the repo so a later session can resume it.

A request to pair reverses this for the session: pause at each step and wait.

<!-- skills:policy:long-runs:end -->

<!-- skills:policy:reporting-back:begin -->

## Reporting back

End a run with these headings:

- **Needs you** — decisions or actions only the author can take.
- **Changed** — files touched and what changed.
- **Found** — anything learned that was not a change.
- **Not verified** — checks that did not run, and why.

When the run leaves a diff uncommitted, end the reply with copy-pasteable `git add` (explicit paths only, never `git add -A` or `git add .`), `git commit`, and `git push` for that diff. Saying the commands were understood is not a substitute for printing them.

A review lists only what would block the merge. For each item give the file and line, why it is wrong, and how to show it fails. A security finding states what the failing test asserts, with no payload.

<!-- skills:policy:reporting-back:end -->

## Skills

Skills live in `.agents/skills/`, with `.claude/skills/` and `.grok/skills/` symlinked into
it. That directory is the single copy; the symlinks are how each agent finds it. Do not edit a
skill in place — it is installed from a manifest and the next update overwrites it.

The set is curated in [mjeightyfive/skills](https://github.com/mjeightyfive/skills). To change
what is installed, change the manifest there, not this repository.
