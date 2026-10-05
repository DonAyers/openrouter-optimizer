---
description: Optimize a prompt, route it to the cheapest suitable model, then execute it — returning the deliverable plus the model used and cost.
---

Execute an optimized prompt end-to-end in three steps.

Step 1 — Optimize: apply the prompt-optimizer skill to the raw prompt below to
get a tightened, deterministic version.

Step 2 — Route: identify the task the optimized prompt describes, then call the
get_router_recommendation tool (if available) with that task and a budget
(default to the cheapest viable option). Capture the recommended router/model
and its curl_example.

Step 3 — Execute: run the optimized prompt against the recommended model. If a
curl_example was returned, use it with the optimized prompt substituted in;
otherwise perform the task yourself. Report the deliverable, the model used,
and the estimated cost.

Raw prompt:
$ARGUMENTS