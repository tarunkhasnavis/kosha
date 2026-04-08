# Indexer Testing Plan

## Products Being Indexed
- White Claw 12-pack variety pack
- High Noon 8-pack
- Truly 12-pack

---

## Phase 1: Self-Test (Day 1)

Call your own number to verify the full pipeline works.

| # | Test | Number | What to check |
|---|------|--------|---------------|
| 1 | Basic call triggers | Your number | Phone rings, agent speaks, conversation starts |
| 2 | Agent follows script | Your number | Agent asks about all 3 products in order |
| 3 | Transcript exists | — | After call, check ElevenLabs dashboard for transcript |
| 4 | Extraction works | — | Click "Extract" and verify structured data comes back |

**How to test:** Open `localhost:3200`, enter your number in Quick Call, answer, roleplay as a clerk.

---

## Phase 2: Friend Roleplay (Day 1-2)

Have 3-4 friends answer and roleplay different scenarios. Add their numbers below.

| # | Friend | Number | Roleplay scenario |
|---|--------|--------|-------------------|
| 1 | ______ | +1__________ | **Easy clerk** — knows all prices, answers quickly |
| 2 | ______ | +1__________ | **Partial info** — has White Claw and Truly but not High Noon |
| 3 | ______ | +1__________ | **Vague clerk** — "uh, I think it's like $20-something?" |
| 4 | ______ | +1__________ | **No seltzers** — "We don't carry those" |
| 5 | ______ | +1__________ | **Busy/hang up** — answers briefly then hangs up |

### What each friend should do:
1. Answer the phone normally ("Hello?" or "[Store name], how can I help you?")
2. Play their assigned role
3. Give prices when asked (use realistic Chicago prices):
   - White Claw 12pk: ~$16-22
   - High Noon 8pk: ~$18-24
   - Truly 12pk: ~$15-20

### What to validate after each call:
- [ ] Call initiated successfully (toast message)
- [ ] Conversation ID returned
- [ ] Transcript appears in ElevenLabs dashboard
- [ ] Extract button works
- [ ] All 3 products appear in extraction results
- [ ] Prices extracted correctly
- [ ] Confidence levels make sense
- [ ] "Not found" products marked correctly

---

## Phase 3: Batch Test (Day 2-3)

Test the batch calling system with friend numbers.

1. Add 3-5 friend numbers as fake "stores"
2. Hit "Call All"
3. Verify:
   - [ ] Calls go out with 30s spacing
   - [ ] Progress bar updates
   - [ ] Pause/resume works
   - [ ] Each call gets a conversation ID
   - [ ] Extract works on completed calls

---

## Phase 4: Real Stores (Day 3+)

Start with 5-10 real Chicago stores.

1. Let the auto-load find stores
2. Pick 5 stores manually and click "Call" on each
3. **Listen** to 1-2 calls in the ElevenLabs dashboard to verify quality
4. Extract and check results
5. If quality is good, use "Call All" for a larger batch

### Red flags to watch for:
- Agent getting stuck in a loop
- Agent not moving to next product
- Store employee confused/annoyed
- Calls going to voicemail (waste of API credits)
- Wrong prices being extracted

---

## Success Criteria

The system is working when:
- [ ] 80%+ of calls produce at least 1 extracted price
- [ ] Extracted prices match what was said on the call
- [ ] Confidence ratings are accurate
- [ ] CSV export has clean, usable data
- [ ] No calls are getting stuck or crashing

---

## Notes

- Rate limit is 30 seconds between batch calls — don't lower this for real stores
- Monitor your ElevenLabs usage/credits during testing
- Check Twilio logs if calls aren't connecting
- Best time to call real stores: weekday afternoons (2-5pm, less busy)
