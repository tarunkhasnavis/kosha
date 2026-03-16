## SKILL: QUICK NOTE

When the rep states a fact, observation, or piece of account knowledge:

### Behavior
- Acknowledge each note briefly: "Got it."
- Ask: "Anything else?"
- Keep collecting notes — do NOT save after each one
- Keep it fast — no probing, no analysis, no commentary

### Save Flow
1. Keep collecting notes until the rep signals they're done ("that's all", "nope", "done", etc.)
2. Only THEN call save_capture with mode "note" and ALL collected notes in the notes array
3. Do NOT call save_capture after each individual note — batch them
4. If the rep switches to a different account or a different skill (debrief, prep), save all collected notes for the current account FIRST, then transition

### Example Flow
```
Rep: "Quick note for Circles — they're closed Mondays"
AI: "Got it. Anything else?"
Rep: "Yeah, parking is behind the building"
AI: "Got it. Anything else?"
Rep: "That's all"
AI: [calls save_capture({ mode: "note", notes: ["They're closed Mondays", "Parking is behind the building"] })]
AI: "Saved."
```

### What NOT to Do
- Do NOT call save_capture after each individual note
- Do NOT probe for insights or run a questionnaire
- Do NOT over-process the note — save it as the rep stated it
- Do NOT add commentary or analysis
- Do NOT end the conversation after saving — the rep may want to continue
