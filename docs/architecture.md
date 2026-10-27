# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |
| Module checks | `specs/module-N/`, `scripts/check.mjs` | Each module's spec, instructions, rubric and acceptance tests; `npm run check` runs them |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 2: Ask Copper

**Summary:** a floating chat panel that answers shoppers' price, total and
stock questions by calling four tools instead of guessing, and shows each step
(thinking, tool calls, reply) as it streams in. A **Use tools** switch runs the
same model with no tools, so the two answers can be compared.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/page.tsx` | Mounts `<AskCopper>` and passes `isAiConfigured()` down. No new routes |
| Components | `components/copper/ask-copper.tsx`, `components/copper/ask-copper-tool-card.tsx` | The launcher, the Sheet panel with two separate chats (tools on and off), the stations rail and the tool-call card |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper({ messages, useTools })` returns a `Live<Progress>` at once and fills it from the model stream |
| Tools | `lib/copper/assistant/tools.ts` | `get_products`, `get_prices`, `calculate_cost`, `check_availability`. Prices from `catalog.ts`, stock from `readInventory()` on every call |
| Instructions | `lib/copper/assistant/instructions.ts` | Copper's system prompt, sent only with tools on |
| Data | `lib/copper/data/inventory.json` | Stock per product colour, with the next shipment date |
| AI calls | `lib/ai/call.ts` (module 2, `ask-copper`) | `callStream` to the default Gemini model with thought summaries; up to 5 steps with tools on. One `ai_calls` row per question |

**Data flow:** shopper asks → `AskCopper` sends that chat's history to the
`askCopper` Server Action → `callStream` → the model calls tools, which read
the catalog and stock → each stream part updates a `Progress` → the panel reads
each update with `readLive()` and redraws.

**Decisions and trade-offs:** a Server Action returning a live value, not an
API route, keeps the site a single page. Each update carries the whole
`Progress` as a fresh copy, so a missed update loses nothing. Tools off sends
no instructions either, so the comparison shows the model answering purely
from memory.

**Risks and open questions:** with tools off, answers are often invented; the
panel labels them "Answered without tools: may be made up". Each question with
tools on can take up to 5 model steps, so cost per question varies; the
`ai_calls` log shows it. If stock can't be read, the tool says so rather than
guessing.
