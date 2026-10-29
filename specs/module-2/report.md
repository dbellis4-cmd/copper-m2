# Module 2: Tools on vs. tools off

_Fictional — for educational use._

Dante Bellissimo

Ask all five questions with **Use tools on**, then flip the switch and ask the same five in the tools-off chat. (They're separate conversations, so Copper can't copy its own answers.) Find each answer's cost and time in the terminal running `npm run dev`: every call prints a line starting `[ai_calls]` with its tokens, cost and time.

## The five test questions

| # | Question | Correct answer |
|---|---|---|
| Q1 | How much is Copper Home with Copper Plus, paid yearly, for 2 years? | $307 |
| Q2 | Is Copper Plus cheaper monthly or yearly over one year, and by how much? | Yearly, by $16.88 ($79 vs. $95.88) |
| Q3 | Is Copper Notes in Night Sky in stock? | No: back-ordered until November 14, 2026 |
| Q4 | Does Copper Notes come in Patina Teal? | No. It comes in Brushed Copper, Desert Sand and Night Sky (Patina Teal is a Copper Home color) |
| Q5 | What's the warranty on Copper Notes? | Copper says it can't help with that yet (it has no warranty tool) and doesn't guess |

## 1. Results table

Mark each answer ✅ (correct) or ❌ (wrong). Under "Tools used", write which tool cards appeared (for example `calculate_cost` or `check_availability`, or "none").

All runs used `google/gemini-3-flash` (set with `AI_MODEL`, because Google no longer serves the default `gemini-2.5-flash` to new accounts). Costs and times are from the `[ai_calls]` lines, on October 27, 2026.

| Question | Tools on: right? | Tools used | Cost | Time | Tools off: right? | Cost | Time |
|---|---|---|---|---|---|---|---|
| Q1 | ✅ $307 | `calculate_cost` | $0.00095 | 1.9 s | ❌ $398 (for a "home maintenance service") | $0.00863 | 15.4 s |
| Q2 | ✅ Yearly, by $16.88 | `get_prices` | $0.00098 | 1.9 s | ❌ Yearly, but by $40.88 ($19.99/mo vs. $199/yr) | $0.00076 | 1.6 s |
| Q3 | ✅ Back-ordered until Nov 14, 2026 | `check_availability` | $0.00103 | 1.9 s | ❌ Said Copper Notes doesn't exist; suggested Field Notes | $0.00154 | 3.7 s |
| Q4 | ✅ No; Brushed Copper, Desert Sand, Night Sky | `get_products` | $0.00105 | 1.8 s | ❌ Matched it to another notebook brand; never said no | $0.00228 | 4.5 s |
| Q5 | ✅ Can't help yet; ask the Copper Crew | none | $0.00056 | 8.2 s | ❌ Invented a "Lifetime Warranty" for a crypto seed-plate brand | $0.00184 | 4.1 s |
| **Total** | **5 / 5** | | **$0.00457** | | **0 / 5** | **$0.01506** | |

Notes on the runs:
- Q4 with tools on hit the free tier's limit of 5 requests a minute on the first try (`ok: false`, after `get_products` had already run). I asked it again a minute later; the row above is that second try. A tools-on question uses two requests (the tool call, then the reply), so asking quickly runs into the limit.
- Tools-off Q5 first failed on the free tier's limit of 20 requests a day. I asked it again on October 29, with a new key, after the dev server had restarted, so it went into a fresh tools-off chat rather than after Q1–Q4.

## 2. Reading the steps

Pick one answer where Copper used a tool. Copy out:

- **What Copper was thinking** (the thinking station, in its own words):

> No thinking station appeared in any tools-on answer. With tools on, Gemini 3 Flash went straight to the tool without sending a thought summary (the course notes that 3 Flash "thinks out loud less often" than 2.5 Flash). The tools-off chat did show thinking; it's in section 4.

- **What Copper sent** to the tool, and **what came back** (Q1, tools on):

> **`calculate_cost()`**, tool 1, "Working out the cost"
> **→ What Copper sent:** Products: Copper Home · Plan: Copper Plus · Billing: annual · Years: 2
> **← What came back:** Copper Home $149 · Copper Plus (annual, 2 years) $158 · **Total $307**
>
> Copper's reply: "That will be $307 total. That covers one Copper Home device and two years of the Copper Plus plan."

Did the model pick the right inputs? How would you know if it hadn't? (2–4 sentences)

> Yes. The question named one device, the Copper Plus plan, yearly billing and two years, and those are exactly the four values Copper sent. The model never did the math itself here: the $307 came from the tool, and the reply repeated it. If it had picked the wrong inputs, for example `billing: "monthly"` or `years: 1`, the card would show it in "What Copper sent", and the total in the card would be wrong too ($340.76 or $228). That card is the only way to tell, because the reply alone would still sound confident.

## 3. Live stock

1. Open `lib/copper/data/inventory.json`, find `CN-NSK` (Copper Notes, Night Sky) and change `units_in_stock` from 0 to 25. Save.
2. Reload the page and ask Q3 again, with tools on.
3. Change it back to 0 when you're done.

What did Copper say this time? Did you change any code or instructions? (2–3 sentences)

> This time Copper said: "Yes, Copper Notes in Night Sky is in stock and ready to ship. We can get that out to you today." It called `get_products` and then `check_availability`, and the card came back **In stock** instead of "Back-ordered until Nov 14, 2026". I changed one number in `inventory.json` (0 → 25) and nothing else: no code, no instructions. The answer changed because `check_availability` reads the stock list fresh on every call. I set it back to 0 afterwards.

## 4. Tools off

Copper still thinks out loud in the tools-off chat. Find a question where it got the price wrong and copy out its thinking:

> From Q1 with tools off (excerpts, in order):
>
> "I'm noting that "Copper" typically refers to CRM software for Google Workspace…"
>
> "I've realized the initial assumption of "Copper" referring to CRM software was incorrect. My focus has shifted to the "Copper" banking app for kids/teens…"
>
> "I've hit a good lead - I've finally identified "Copper" as a home maintenance/protection service. It was formerly known as "Dwelling.""
>
> "I've found a pricing breakdown: Copper Home is approximately $99/year and Copper Plus is around $199/year."
>
> "I've confirmed the pricing… "Copper Home" is $120/year, and "Copper Plus" is $240/year."
>
> Its reply then stated, as fact: "Annual Rate: $199 per year… Total Cost: $398."

What happened when Copper had no tools? Which answers changed, and why can't a model know prices or today's stock without them? (3–5 sentences)

> Every answer changed, and all five were wrong; even the warranty question got an invented "Lifetime Warranty" instead of "ask the Copper Crew". Without tools the model didn't even know which company it worked for: its thinking tried a CRM, a teen banking app and a home-maintenance service, and it wrote "confirmed" about prices it had made up, then stated $398 as fact. Copper State Labs' prices live in our catalog and our stock lives in `inventory.json`; neither was in the model's training data, and stock changes daily, so no amount of training could make it right. The model fills the gap with a pattern that sounds plausible. Worse, the wrong answer carried forward: in Q2 it reused the $19.99 and $199 it had invented in Q1, so one guess turned into a consistent but completely wrong story.

## 5. Risk

What could still go wrong with Ask Copper, even with tools? What do the tools protect against, and what don't they? Who at Copper should be responsible for it?

> The tools protect the facts: prices, totals, colors and stock all come from our own data, and the card shows exactly what went in and out. They don't protect the parts the model still does on its own. In Q2 (tools on), Copper called `get_prices` and then worked out "$95.88" and "$16.88" in its head instead of calling `calculate_cost`. It happened to be right, but no tool checked that arithmetic. In the live stock test it went further than the tool: `check_availability` only said "In stock", but Copper told the shopper "We can get that out to you today", a shipping promise no tool gave it. The model could also pick the wrong inputs (two devices instead of one), skip a tool entirely, or say something a tool didn't return. The tools are also only as good as the data behind them: if the catalog or stock list is out of date, Copper will repeat the wrong number confidently. **Elena Vargas, VP of Customer Experience,** should own Ask Copper's accuracy, including reviewing transcripts and the `ai_calls` log for answers without tool calls. **Marcus Lee's Copper Crew** should own the questions it hands off, like warranty, since every "ask the Copper Crew" lands with them.

## 6. Reflection

What surprised you? What's one thing you'd change about Ask Copper next?

> What surprised me most was how confident the tools-off answers were. In Q1 its own thinking admitted it was jumping between three different companies, and then the reply gave a precise "$398" with a neat breakdown, as if it had looked it up. Without the thinking station I'd have had no hint it was guessing. I was also surprised that tools on was faster and cheaper: under 2 seconds and about $0.001 per question, against 15 seconds and $0.009 for the tools-off Q1 that rambled. One thing I'd change: make Copper use `calculate_cost` for every price comparison, not just totals, by adding a line to the instructions and a test for it, so arithmetic like Q2's is always checked by code rather than done by the model.
