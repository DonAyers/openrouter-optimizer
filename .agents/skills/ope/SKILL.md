---
name: ope
description: Optimize a prompt and return the improved prompt, changes, and before-and-after quality scores. Invoke with /ope.
---

Use the `prompt-optimizer` skill to improve the user's prompt. Return:

- The tightened prompt
- A concise list of changes made
- Before and after scores for clarity, determinism, output format, edge cases, scope, and conciseness

Do not execute the task unless the user explicitly asks for execution.

Apply this workflow to the user's current request.
