---
name: op
description: Optimize a prompt, get an OpenRouter routing recommendation, and carry out the task using the recommended configuration when possible. Invoke with /op for router-aware execution.
---

Execute the user's request in three stages:

1. Optimize the request using the `prompt-optimizer` skill when the request is ambiguous or would benefit from a tighter prompt.
2. Call the `get_router_recommendation` tool from the `openrouter-optimizer` MCP server. Pass the task, relevant files, language, framework, project type, budget, and token estimate when known.
3. Use the recommendation to guide execution. Report the recommended router, configuration, reasoning, and estimated cost. If the recommendation includes a directly usable API example and the user has authorized execution through the configured environment, use it; otherwise complete the task with the current Zed agent and clearly state that the recommendation was advisory.

Do not claim that Zed's active model or provider was changed unless that actually happened. The MCP server recommends routing; it does not automatically switch the Zed session's model.

Apply this workflow to the user's current request.
