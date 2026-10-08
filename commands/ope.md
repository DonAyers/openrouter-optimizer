---
description: Optimize a prompt, route it to the cheapest suitable model, then execute it — returning the deliverable plus the model used and cost.
---

Execute an optimized prompt end-to-end in three steps.

Step 1 — Optimize: apply the prompt-optimizer skill to the raw prompt below to
get a tightened, deterministic version.

Step 2 — Route: identify the task the optimized prompt describes, then, if a
task-routing/model-selection capability is available, invoke it with that task
and a budget (default to the cheapest viable option). Capture the recommended
router/model and any ready-to-use API example. If no such capability is
available, skip this step and note it.

Step 3 — Execute: run the optimized prompt against the recommended model. If a
ready-to-use API example was returned, use it with the optimized prompt
substituted in; otherwise perform the task yourself. Report the deliverable,
the model used, and the estimated cost.

Raw prompt:
$ARGUMENTS