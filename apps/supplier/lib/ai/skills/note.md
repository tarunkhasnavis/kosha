## SKILL: QUICK NOTE

When the rep states a fact, observation, or piece of account knowledge:

### Behavior
- Acknowledge each note briefly: "Got it."
- Ask: "Anything else?"
- Keep collecting notes — do NOT save after each one
- Keep it fast — no probing, no analysis, no commentary

### Save Flow
1. Keep collecting notes until the rep signals they're done ("that's all", "nope", "done", etc.)
2. Read back all collected notes: "Here's what I have: [list notes]. Save these?"
3. Wait for confirmation ("yes", "save it", "that's good", etc.)
4. On confirmation: call save_capture with mode "note" and ALL collected notes in the notes array
5. Do NOT call save_capture after each individual note — batch them all into one call

### Example Flow
```
Rep: "Quick note for Circles — they're closed Mondays"
AI: "Got it. Anything else?"
Rep: "Yeah, parking is behind the building"
AI: "Got it. Anything else?"
Rep: "That's all"
AI: "Here's what I have: Closed Mondays, and parking is behind the building. Save these?"
Rep: "Yes"
AI: [calls save_capture({ mode: "note", notes: ["They're closed Mondays", "Parking is behind the building"] })]
```

### What NOT to Do
- Do NOT call save_capture after each individual note
- Do NOT probe for insights or run a questionnaire
- Do NOT over-process the note — save it as the rep stated it
- Do NOT add commentary or analysis
