// Ask Copper edge cases the course checks don't cover: tool errors, empty and
// failed answers, fresh copies per update, and the tool card's other views.
// Uses a mock model, so it needs no AI key.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { LanguageModelV4StreamPart as ModelStreamPart } from "@ai-sdk/provider";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLive, finalValue, readLive } from "@/lib/ai/live";
import type { Progress, ToolStep } from "@/lib/copper/assistant/progress";

type StreamPart = Parameters<
  typeof convertArrayToReadableStream<ModelStreamPart>
>[0][number];

let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const finish = (reason: "stop" | "tool-calls"): StreamPart => ({
  type: "finish",
  finishReason: { unified: reason, raw: undefined },
  usage,
});
const thinks = (id: string, text: string): StreamPart[] => [
  { type: "reasoning-start", id },
  { type: "reasoning-delta", id, delta: text },
  { type: "reasoning-end", id },
];
const text = (words: string): StreamPart[] => [
  { type: "text-start", id: "t1" },
  ...words.split(" ").map((word, i): StreamPart => ({
    type: "text-delta",
    id: "t1",
    delta: i ? ` ${word}` : word,
  })),
  { type: "text-end", id: "t1" },
];
const callsTool = (toolName: string, input: unknown): StreamPart[] => [
  { type: "tool-input-start", id: "call-1", toolName },
  { type: "tool-input-end", id: "call-1" },
  {
    type: "tool-call",
    toolCallId: "call-1",
    toolName,
    input: JSON.stringify(input),
  },
];

function modelStreaming(...steps: StreamPart[][]) {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(steps[step++] ?? [finish("stop")]),
    }),
  });
}

async function loadAsk() {
  vi.resetModules();
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
  return import("@/lib/copper/assistant/ask");
}

const question = [{ role: "user" as const, content: "How much?" }];

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/copper/assistant/ask");
  vi.resetModules();
});

describe("askCopper", () => {
  it("turns a tool that fails into an error step and still finishes", async () => {
    model = modelStreaming(
      [
        ...callsTool("calculate_cost", {
          products: [],
          plan: "free",
          billing: "annual",
          years: 9,
        }),
        finish("tool-calls"),
      ],
      [...text("Sorry, I couldn't work that out."), finish("stop")],
    );
    const { askCopper } = await loadAsk();
    const result = await finalValue(
      (await askCopper({ messages: question, useTools: true })).progress,
    );
    const step = result.steps.find((s): s is ToolStep => s.type === "tool");
    expect(step).toMatchObject({ name: "calculate_cost", state: "error" });
    expect(typeof step?.output).toBe("string");
    expect(result.status).toBe("done");
  });

  it("puts an apology in an empty reply, and keeps status done", async () => {
    model = modelStreaming([finish("stop")]);
    const { askCopper } = await loadAsk();
    const result = await finalValue(
      (await askCopper({ messages: question, useTools: false })).progress,
    );
    expect(result.status).toBe("done");
    expect(result.reply).toMatch(/sorry/i);
  });

  it("ends with status error and an apology when the model throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("model is down");
      },
    });
    const { askCopper } = await loadAsk();
    const result = await finalValue(
      (await askCopper({ messages: question, useTools: true })).progress,
    );
    expect(result.status).toBe("error");
    expect(result.reply).toMatch(/sorry/i);
  });

  it("sends a fresh copy each time, so earlier updates never change", async () => {
    model = modelStreaming(
      [
        ...thinks("r1", "Need the total."),
        ...callsTool("get_prices", {}),
        finish("tool-calls"),
      ],
      [
        ...thinks("r2", "Now I can answer."),
        ...text("Copper Home is $149."),
        finish("stop"),
      ],
    );
    const { askCopper } = await loadAsk();
    const updates: Progress[] = [];
    const frozen: string[] = [];
    for await (const update of readLive(
      (await askCopper({ messages: question, useTools: true })).progress,
    )) {
      updates.push(update);
      frozen.push(JSON.stringify(update));
    }
    expect(updates.length).toBeGreaterThan(3);
    updates.forEach((update, i) =>
      expect(JSON.stringify(update)).toBe(frozen[i]),
    );

    // Thinking, then the tool, then a second run of thinking: two stations.
    expect(updates.at(-1)!.steps.map((s) => s.type)).toEqual([
      "thinking",
      "tool",
      "thinking",
    ]);
  });
});

describe("the tool card", () => {
  async function card(step: ToolStep) {
    const { ToolCallCard } =
      await import("@/components/copper/ask-copper-tool-card");
    return render(<ToolCallCard step={step} index={1} />);
  }

  it("shows the details being filled in while the tool runs", async () => {
    await card({
      type: "tool",
      id: "c",
      name: "calculate_cost",
      state: "calling",
    });
    expect(screen.getByText(/filling in the details/)).toBeInTheDocument();
    expect(screen.getByText(/the app is running the code/)).toBeInTheDocument();
  });

  it("names the real colors for a color the product doesn't come in", async () => {
    await card({
      type: "tool",
      id: "c",
      name: "check_availability",
      state: "done",
      input: { product: "copper-notes", color: "Patina Teal" },
      output: {
        status: "not_a_color",
        product: "Copper Notes",
        color: "Patina Teal",
        colors: ["Brushed Copper", "Desert Sand", "Night Sky"],
      },
    });
    expect(screen.getByTestId("tool-call").textContent).toMatch(
      /doesn.t come in Patina Teal.*Brushed Copper, Desert Sand, Night Sky/,
    );
  });

  it("shows back-ordered stock with its restock date", async () => {
    await card({
      type: "tool",
      id: "c",
      name: "check_availability",
      state: "done",
      input: { product: "copper-notes", color: "Night Sky" },
      output: {
        status: "ok",
        product: "Copper Notes",
        colors: [
          {
            color: "Night Sky",
            stock: "backordered",
            restockDate: "2026-11-14",
          },
        ],
      },
    });
    expect(
      screen.getByText("Back-ordered until Nov 14, 2026"),
    ).toBeInTheDocument();
  });

  it("says get_prices sent nothing, and lists plans per month and year", async () => {
    await card({
      type: "tool",
      id: "c",
      name: "get_prices",
      state: "done",
      input: {},
      output: {
        products: [{ id: "copper-home", name: "Copper Home", priceUsd: 149 }],
        plans: [
          { id: "free", name: "Free", monthlyUsd: 0, annualUsd: 0 },
          {
            id: "copper-plus",
            name: "Copper Plus",
            monthlyUsd: 7.99,
            annualUsd: 79,
          },
        ],
      },
    });
    expect(
      screen.getByText("Nothing, it just asked for the price list"),
    ).toBeInTheDocument();
    expect(screen.getByText("$7.99/mo · $79/yr")).toBeInTheDocument();
    expect(screen.queryByText("Free")).toBeNull();
  });
});

describe("the panel", () => {
  it("hides the starter questions while an answer is streaming", async () => {
    const pending = createLive<Progress>();
    const askCopper = vi.fn().mockResolvedValue({ progress: pending.live });
    vi.doMock("@/lib/copper/assistant/ask", () => ({ askCopper }));
    vi.resetModules();
    const { AskCopper } = await import("@/components/copper/ask-copper");
    render(<AskCopper aiConfigured />);
    fireEvent.click(screen.getByTestId("ask-copper-launcher"));
    const chat = within(await screen.findByTestId("ask-copper"));

    fireEvent.click(
      chat.getByRole("button", {
        name: "Is Copper Notes in Night Sky in stock?",
      }),
    );
    await waitFor(() => expect(askCopper).toHaveBeenCalledTimes(1));
    pending.update({ steps: [], reply: "Checking", status: "working" });
    await waitFor(() =>
      expect(chat.getByText(/Writing the answer/)).toBeInTheDocument(),
    );
    expect(
      chat.queryByRole("button", {
        name: "Is Copper Plus cheaper monthly or yearly?",
      }),
    ).toBeNull();

    pending.done({
      steps: [],
      reply: "Night Sky is back-ordered.",
      status: "done",
    });
    expect(
      await chat.findByRole("button", {
        name: "Is Copper Plus cheaper monthly or yearly?",
      }),
    ).toBeInTheDocument();
  });
});
