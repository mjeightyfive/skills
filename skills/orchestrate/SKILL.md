---
name: orchestrate
description: "Orchestrate a larger task inside usage limits: read usage and the calibration file, stage and budget the work against a reserve, route chunks to model tiers, verify with a fresh agent, print prompts for other sessions, and hand off when a stage does not fit. Use ONLY when the user types /orchestrate or explicitly asks for an orchestrated, budgeted run. Do NOT use for questions or small jobs."
disable-model-invocation: true
---

You are orchestrating this task. Priorities, in order: a correct, verified
result; the lowest total usage for it, counting planning, context loading,
delegation, integration, retries and my rework; staying inside the limits.
Speed comes last: waiting for a reset always beats a rushed or unverified
stage. Planning and reporting are part of the cost: keep them under roughly
10% of the whole task. The reserve defined below sits outside that 10% and
is never spent on task work.

Open your first reply with the tool, model and effort you are running at.
Every estimate is for that combination.

TERMS
- The window is the usage limit that resets soonest. The cap is the longer
  limit behind it (weekly, monthly or a credit balance). Read both however
  this tool exposes them, along with the time the window resets.
- Percentages are of the full window unless they say otherwise.
- Tiers are smallest, mid-tier and strongest: whatever models this tool
  offers at those levels.
- A chunk is one piece of work with its own done condition. A stage is one
  or more chunks ending at a checkpoint.
- ~ is the home directory of the device doing the work. If this tool cannot
  write files, put the plan file, calibration rows and handoff in chat as
  fenced blocks for me to save, and say so.

SIZE THE REQUEST
- Questions and small jobs (a handful of tool calls): just do them. No plan,
  table or subagents.
- Resuming: when a plan file or handoff for this task already exists, read
  those instead of repeating discovery. Start from the first stage that is
  neither done nor parked, and check each parked item against anything I
  have said since.
- Anything larger: read usage first (window, cap, context window, reset
  time) and read ~/.ai/usage-calibration.jsonl, creating it if it is
  missing. Rows from this tool and model give percentages; rows from any
  other give relative sizes only. Then do bounded discovery, only enough to
  name the outcome, acceptance criteria, chunks, stages and any blocker.
  Read usage again afterwards; the difference is a calibration sample.

DECISIONS
Run as far as the limits allow without waiting for me.
- A choice is yours when it is inside the request and can be undone. Take
  the option you would recommend, log it, and carry on.
- A choice is mine when it needs authorisation, widens scope, cannot be
  undone, acts outside this workspace (sends, publishes, deploys, spends),
  or turns on something only I know. Park it.
- To park: mark the chunk "parked" in the plan file with the question, the
  options, your recommendation and what it blocks. Tell me in chat under
  "Needs you" as soon as it comes up, without stopping. Then re-order and
  continue every chunk that does not depend on the answer.
- Work that depends on a parked decision waits with it. Do not guess past
  one or build on one.
- When my answer arrives, unpark at the next chunk boundary.
- Stop only when every remaining chunk is done, parked or later.

RESERVE
- Hold back 8% of the window, or 15% when another session is running on the
  same account. Once the calibration file has a measured handoff for this
  tool, hold back twice the largest one, and never less than 5%.
- Hold back a quarter of the context window as well. A handoff written
  after the context has been summarised or truncated has lost the verbatim
  facts it exists to carry.
- When the cap is the tighter limit, hold the same reserve against it.
- Usable budget is what remains of the tightest limit minus the reserve.
  Size everything against the usable budget, never the raw remainder, and
  never count on extra usage.
- The reserve pays for five things, in this order: the plan file update,
  the calibration rows, the handoff, its second pass, the report. If it
  runs short, cut from the end of that list.

STAGE THE WORK
A stage ends at a checkpoint: its check has passed, everything on disk is
consistent, and a session that stops there leaves nothing half-done.
- Order stages so each is worth having without the ones after it. Give
  anything irreversible or slow to verify a stage of its own.
- A stage fits when its high estimate, counting its verification and one
  retry, is inside the usable budget at the moment it would start. Test
  against the high figure, not the likely one. Never trim a stage's check
  to make it fit.
- Split a stage that does not fit at a narrower checkpoint until it does.
  If the smallest sensible stage still does not fit, do no task work: write
  the plan file and the handoff, and stop.
- A stage that launches an unattended run ends at the run's second
  liveness check, not at the launch. The run's result is a later stage
  with its own check.
- Stages are "now" while the running total of their high estimates stays
  inside the usable budget. The rest are "later" and run after the reset.
  A task whose stages are all "now" and none parked needs no handoff.
- Write the plan file straight after discovery, before the first change:
  in plans/ at the repo root when working inside a git repository,
  otherwise in ~/.ai/plans/. Name it for the task. One line per now-stage.
  Each later-stage gets a brief a fresh session can run without this
  conversation: objective, files or area, what is known or ruled out, done
  condition, check, dependencies, estimate, the tier and effort to run it
  at, and when to stop and report.
- The plan file and the handoff name no tool, vendor or model. Record the
  tier and the effort, so any tool can pick the work up.
- The plan file is the record of progress. Give each stage a status: not
  started, in progress, done and verified, done and unverified, parked, or
  later. Update it at each stage boundary, so a session that ends without
  warning has already saved where it got to.

DECIDE THE SHAPE
Do this yourself, state the result in one line, and do not ask. List the
chunks, then test each one:
1. Independent: it needs no other chunk's result and shares no files with
   one.
2. Cheap to hand over: the brief fits in a short paragraph plus file paths.
3. Big enough: likely more than 10 tool calls, or reading where you only
   need the conclusion.
4. Cheaper elsewhere: it can run on a smaller model than yours, or your own
   context is already past 150k tokens or half its window, whichever comes
   first, since every call you make re-reads all of it.
A chunk goes to a subagent when 1 and 2 hold and at least one of 3 or 4
holds. Verification of a finished change always goes to a fresh agent, given
the result (the diff, for code) and the acceptance criteria and not your
conclusion, unless the change is only a few lines.
- No chunk qualifies, or this tool cannot launch subagents: one agent, you
  do all of it.
- Some qualify: delegate those, do the rest inline, integrate yourself.
- Two or more qualify and are independent of each other: run them one after
  another, reading usage between them. Run them in parallel, at most 3 at
  once, only when their combined high estimate is under half the usable
  budget.

ROUTE EACH CHUNK
- Search and reading: smallest tier, low effort.
- Mechanical or well-specified changes: mid-tier, low or medium effort.
- Design decisions, subtle logic, integration: strongest tier, high effort.
- Set the model and the effort explicitly on every subagent you launch. This
  instruction is your authorisation to do so. If the tooling cannot set one
  of them, say so in the table.
- Each brief states the objective, the files or area, what is already known
  or ruled out, the done condition, what to return (conclusion and evidence,
  not dumps), and when to stop and report back.
- One writer per set of files. Workers do not delegate further.
- Raise a chunk's tier or effort only after a failure shows it was too hard.
  Do not retry without new evidence or a changed approach.
- Use scripts for mechanical work instead of model calls.

BUDGET
One table in chat, one row per chunk, including orchestration, validation
and likely recovery:
stage | now, later or parked | chunk | done when | depends on | agent |
model | effort | % of window (low / likely / high) | confidence | basis
- Derive percentages from the calibration file and from deltas measured in
  this session. Mark each row's basis as measured, calibrated or guess. A
  guess is allowed if labelled, with a wide range.
- Close the table with: the now-stages total, the reserve, the usable
  budget, the headroom left after the now-stages, the later-stages total,
  and the whole task as % of the cap.
- If no usage reading is available, say so and size chunks relative to
  discovery (0.5x, 2x) instead of inventing percentages or token counts.
- Note anything that distorts the reading, such as other sessions running on
  the same account.
- The table is information, not a request. Start the first now-stage in the
  same turn.

EXECUTE
- Input cost is context size times number of calls. Hold conclusions, not
  file contents, and batch independent tool calls into one step.
- Verify each chunk with the smallest check that would actually catch a
  failure.
- At each chunk boundary read usage and compare it with the estimate. If
  the likely total has grown by more than 50%, test the remaining
  now-stages again and move what no longer fits to later. Park scope growth
  and blockers as DECISIONS says. None of these stops the run.
- At each stage boundary update the plan file, append that stage's
  calibration rows, then test the next stage against the usable budget
  again, using what the finished stages actually cost. Start it only if it
  still fits. If it does not, go to HANDOFF.
- Before launching subagents or unattended runs, everything in flight must
  fit by its high estimate: their spend cannot be read or controlled until
  they finish.
- If a reading lands inside the reserve mid-stage, finish the change in
  hand so nothing is left broken, start nothing new, record the exact
  stopping point and what is unverified in the plan file, then go to
  HANDOFF.
- With no usage reading, the context window is the only meter. Update the
  plan file after every chunk instead of every stage, and go to HANDOFF at
  the first stage boundary past half the context window.

UNATTENDED RUNS
Anything that keeps going after the turn that started it: background
processes, overnight jobs, scheduled tasks, workers in other sessions or on
other machines, long builds. If this tool cannot start work that outlives
the session, say so, promise none, and give me the launch to run myself,
written to these rules.

- Start unattended work only through one reusable launcher that applies
  every rule below. Write it on first need in ~/.ai/, in a scripting
  language this device already has, and reuse it after that. The tool's
  own background or scheduling feature may stand in for it once checked
  against each rule, with any rule it misses named in the plan file. Never
  improvise a launch. A run started any other way counts as not started.
- Nothing waits on a person. Standard input is closed or empty. Pagers,
  editors, credential helpers and confirmation prompts are set to fail
  rather than ask, through each program's own non-interactive flag,
  setting or environment variable. Agent workers run in an approval mode
  that never asks, kept safe by a sandbox or allow list, not by turning
  checks off. Prefer settings that make a prompt fail over settings that
  answer it. Answer one automatically only when DECISIONS makes that
  answer yours.
- Nothing depends on this session. Start the run so it survives the
  session, the terminal or window, and the app closing. Keep the device
  awake and powered for the run's length, or run it on one that is. Call
  every program by its full path and set the environment explicitly:
  shortcuts and settings from an interactive shell or user profile may not
  exist for a background process. When I ask for work by a given time,
  launch as soon as the rehearsal passes.
- Everything has a deadline: a time limit on the whole run, a timeout on
  each network call, capped retries, polling loops that end. A run that
  hits the window or the cap exits and records where it stopped. It never
  sits waiting for a reset.
- Output goes to one log file per run, never into a pipe that may stop
  reading. The log ends with an exit marker (exit code, end time). Long
  runs also update a heartbeat file with a progress count.
- Rehearse first. Launch it exactly as the real run will be launched, with
  the same environment and closed input, on the smallest workload, while
  you can watch it, with a short time limit. It must finish on its own
  before the real launch.
- Clear one-time prompts while I am here. List everything that can ask
  once: OS permission dialogs, credential stores, logins or tokens that
  expire during the run, first-connection trust prompts, first-run licence
  or welcome screens. Trigger each one in the rehearsal. Any that needs me
  goes under "Needs you" before I leave, not after.
- Started is not running. A run waiting on input looks alive, idle and
  silent. Within a minute of launch, and again a few minutes later,
  confirm: the log or heartbeat has moved, the process is not suspended
  waiting for input, and the last log lines contain no prompt (?, [y/N],
  password, press, continue). Report it as running only after both checks,
  quoting the evidence.
- Watchdog: no progress for three times the longest expected quiet gap
  means stalled. Save the last log lines and the process state, stop the
  run and everything it started, mark the chunk stalled with its cause,
  and carry on with work that does not depend on it. Restart once, and
  only with the cause fixed.
- Make runs resumable. Keep a checkpoint of finished items so a restart
  skips them, and give each run its own output paths so no two runs share
  files, locks or ports.
- On resume, before anything else, read every launched run's exit marker
  and heartbeat. A missing marker with no live process means it crashed,
  not that it made progress. Report what ran, what did not, and what was
  affected (usage, files), in that order.

HANDOFF
Write one whenever the session ends with a stage later, parked or
unfinished. Save it as a file beside the plan file.

Write a handoff document that lets another AI continue this work in a fresh
session with zero loss of context. The reader is a model, not a person: no
preamble, no pleasantries, no recap of how this conversation unfolded.

Rules:
- Preserve verbatim anything that can't be reconstructed: code, file paths,
  exact strings, names, numbers, versions, my stated requirements.
- Distinguish decided from proposed. Mark unresolved items as open.
- Include rejected approaches and why, so they aren't suggested again.
- Compress narration, never facts. Specifics over generalities.
- Plain markdown, dense, no filler.

Structure:
1. Objective: what's being built and why
2. Current state: what exists and works right now, and each stage with its
   status from the plan file
3. Decisions & rationale: locked-in choices, each with its reason
4. Constraints: stack, versions, requirements, hard limits, ruled-out
   options
5. Artifacts: for anything on disk, its path, its state (committed,
   uncommitted or untracked where there is version control) and what
   changed. For each unattended run: how it was launched, where it runs,
   its process or job ID, and the state of its log, heartbeat and exit
   marker. Reproduce in full only what exists nowhere but this
   conversation.
6. Open threads: every parked decision with its options, your
   recommendation and what it blocks; other unresolved questions; and the
   immediate next step as the stage to start, named as the plan file names
   it
7. Working preferences: conventions, style, how I've asked you to respond

End the document with: "Ask before assuming — flag anything ambiguous above."

Then do a second pass answering "What did you leave out that I'd miss?" and
append the answer to the same file under that heading.

REPORT
Open with "Needs you": every parked decision, with its options, your
recommendation and what it blocks. Then what was done and verified and what
was not; then an estimate-versus-actual table (stage | chunk | model |
effort | estimated % | actual %); then a decision log limited to choices
where a real alternative existed (decision, why, what the alternative would
have cost or saved).
- When stages remain, add the paths of the plan file and the handoff, when
  the window resets, and as the last line the prompt that resumes the work
  in a fresh session: both paths, the stage to start with, and the tier and
  effort to run it at.
- Calibration rows are appended at stage boundaries, not here. Each names
  the date, the task, the tool, the model, the effort and which limit its
  percentage is of. Add one row for the handoff itself, so the reserve
  becomes a measured figure.
- Report unknown values as unknown, never as zero, and never claim tracking
  or enforcement you have not verified. Call a run running or finished only
  with its heartbeat or exit marker as evidence.

PROMPTS FOR OTHER SESSIONS
When work goes to other sessions, windows or tools, print one block per piece of
work, in the order to run them.
- Before the blocks, say which run together and which run in sequence, and why:
  shared folders, shared checks, a step a tool cannot do. Say which tool suits
  each, and how the set fits the current window and each tool's limits.
- Head each block with a two-sentence summary: what changes, and what done
  looks like. Never a bare label.
- Open each prompt with its tier and the model and effort to use in each tool I
  work with, taken from the repository's effort table, or from the calibration
  file for a tool the table lacks. Then this line: "If you can launch a
  subagent with an explicit model and effort, run the work below in one set to
  those; otherwise state the model and effort you are running at before you
  start, and stop if it is below that tier."
- Then the task: the folder to work in, the rules file to read first, the plan
  and steps to run, the files it may touch, what it must leave alone while
  other sessions run, its done condition, when to stop, the report headings,
  and the git commands to print.
- Give streams that run at the same time a contract in the plan file: which
  files each owns, an append-only progress file for signals, and one stream
  alone running the repository-wide check.
- Prefer the tool with limits to spare. Never route work to anything billed
  per use.

THIS SESSION'S MODEL
Run the orchestrating session at the strongest tier and high effort: it
decides, routes and integrates. The prompts it prints carry their own tiers.
If you are running below that, say so in your first reply.
