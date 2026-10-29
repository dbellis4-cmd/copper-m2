# Module 2: Tools on vs. tools off

_Fictional — for educational use._

**Your name:** Dante Bellissimo

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

> Copper didn't show any thinking when tools were on. It went straight to the tool. The model I used thinks out loud less often than the course's default one. Copper did show its thinking with tools off, and I copied that into section 4.

- **What Copper sent** to the tool, and **what came back** (Q1, tools on):

> **`calculate_cost()`**, tool 1, "Working out the cost"
> **→ What Copper sent:** Products: Copper Home · Plan: Copper Plus · Billing: annual · Years: 2
> **← What came back:** Copper Home $149 · Copper Plus (annual, 2 years) $158 · **Total $307**
>
> Copper's reply: "That will be $307 total. That covers one Copper Home device and two years of the Copper Plus plan."

Did the model pick the right inputs? How would you know if it hadn't? (2–4 sentences)

> Yes. The question asked about one Copper Home with Copper Plus, paid yearly, for two years, and that is exactly what Copper sent. The $307 came from the tool, and Copper just repeated it. If Copper had sent the wrong details, like monthly billing or one year, I would see it in the card and the total would be wrong too. The reply would still sound sure of itself, so the card is the only way to catch a mistake like that.

## 3. Live stock

1. Open `lib/copper/data/inventory.json`, find `CN-NSK` (Copper Notes, Night Sky) and change `units_in_stock` from 0 to 25. Save.
2. Reload the page and ask Q3 again, with tools on.
3. Change it back to 0 when you're done.

What did Copper say this time? Did you change any code or instructions? (2–3 sentences)

> This time Copper said Night Sky was in stock and ready to ship, instead of back-ordered until November 14. I only changed one number in the stock list, from 0 to 25. I didn't touch any code or instructions. The answer changed because Copper checks the stock list every time someone asks. I set the number back to 0 when I was done.

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

> All five answers were wrong without tools. Copper didn't even know which company it worked for. Its thinking jumped between three different businesses before it settled on made-up prices and called them confirmed. Our prices and stock are kept in our own files, and the AI never saw them when it was trained. Stock also changes every day, so it could never just remember the right answer. When it doesn't know, it guesses something that sounds right. The guesses also stuck around, because in Q2 it reused the fake prices it made up in Q1. Even the warranty question got an invented lifetime warranty instead of a pointer to the Copper Crew.

## 5. Risk

What could still go wrong with Ask Copper, even with tools? What do the tools protect against, and what don't they? Who at Copper should be responsible for it?

> The tools make sure prices, colors and stock come from our own records. They can't stop Copper from adding things on its own. In Q2 it looked up the prices and then did the math itself instead of using the cost tool. It got the right answer, but nothing checked it. In the stock test the tool only said "in stock," and Copper added that we could ship it today. Nothing told it that. Copper could also send the wrong details to a tool or skip a tool completely. And if our price list or stock list is out of date, Copper will repeat the wrong answer with confidence. Elena Vargas, our VP of Customer Experience, should be responsible for making sure Ask Copper gives correct answers. Marcus Lee and the Copper Crew should handle the questions Copper sends their way, like warranty questions.

## 6. Reflection

What surprised you? What's one thing you'd change about Ask Copper next?

> I was surprised by how sure of itself Copper sounded without tools. In Q1 its thinking showed it was confused about which company it even was, but the answer still gave an exact price of $398 like it had looked it up. Without seeing the thinking, I would have had no idea it was guessing. I was also surprised that using tools was faster and cheaper. Each answer took about 2 seconds and cost about a tenth of a cent, while the tools-off Q1 took 15 seconds and cost almost a full cent. Next, I would have Copper use the cost tool for every price comparison so it never does math on its own.
