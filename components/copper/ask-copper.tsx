"use client";

// Module 2: Ask Copper, the floating shopping chat. It sends each question to
// the askCopper Server Action and draws the answer as it streams in: the tools
// Copper could use, its thinking, each tool call, then the reply
// (spec.md sections 4 and 5). Tools on and tools off are two separate chats.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import {
  ArrowUpIcon,
  BrainIcon,
  MessageCircleIcon,
  PackageIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import {
  type Progress,
  type ToolStep,
  TOOL_LABELS,
} from "@/lib/copper/assistant/progress";
import { ToolCallCard } from "@/components/copper/ask-copper-tool-card";

const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

const SORRY = "Sorry, I couldn't reach Copper just now. Please try again.";

type Turn = { id: number; question: string; progress: Progress };
type ChatKey = "on" | "off";

/** The conversation so far as the model sees it: questions and finished replies. */
function historyOf(turns: Turn[]): ChatMessage[] {
  return turns.flatMap((turn): ChatMessage[] =>
    turn.progress.status === "working"
      ? []
      : [
          { role: "user", content: turn.question },
          { role: "assistant", content: turn.progress.reply },
        ],
  );
}

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);

  // Open from the launcher, the header's #ask link, or a visit to /#ask.
  // Clicking the link when the address already ends in #ask fires no
  // hashchange, so listen for the click too.
  useEffect(() => {
    const openIfAsk = () => {
      if (window.location.hash === "#ask") setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link?.getAttribute("href")?.endsWith("#ask")) setOpen(true);
    };
    openIfAsk();
    window.addEventListener("hashchange", openIfAsk);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openIfAsk);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <>
      <Button
        data-testid="ask-copper-launcher"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-12 gap-2 rounded-full px-5 shadow-lg sm:right-6 sm:bottom-6"
      >
        <MessageCircleIcon className="size-5" />
        Ask Copper
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-testid="ask-copper"
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          {aiConfigured ? (
            <ChatPanel />
          ) : (
            <>
              <PanelHeader />
              <div className="bg-secondary flex-1 overflow-y-auto px-4">
                <SetupRequired service="ai" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PanelHeader({ children }: { children?: React.ReactNode }) {
  return (
    // The `dark` class gives the header Night Sky in both themes, like the footer.
    <div className="dark">
      <div className="bg-background text-foreground">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="bg-primary flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src="/assets/brand/copper-mascot.png"
              alt="Copper the robot, the Copper State Labs mascot"
              width={40}
              height={40}
              className="size-10 object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-foreground text-base font-semibold">
              Ask Copper
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              Prices, totals and stock, checked with tools.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <XIcon />
            </Button>
          </SheetClose>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChatPanel() {
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Record<ChatKey, Turn[]>>({
    on: [],
    off: [],
  });
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const bodyRef = useRef<HTMLDivElement>(null);

  const key: ChatKey = useTools ? "on" : "off";
  const turns = chats[key];
  const busy = turns.some((turn) => turn.progress.status === "working");

  // Keep the newest step in view as it streams in.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [chats, key]);

  function setTurn(chat: ChatKey, id: number, progress: Progress) {
    setChats((all) => ({
      ...all,
      [chat]: all[chat].map((turn) =>
        turn.id === id ? { ...turn, progress } : turn,
      ),
    }));
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const chat = key;
    const id = nextId.current++;
    // Each chat sends only its own history.
    const messages: ChatMessage[] = [
      ...historyOf(chats[chat]),
      { role: "user", content: text },
    ];
    setDraft("");
    setChats((all) => ({
      ...all,
      [chat]: [
        ...all[chat],
        {
          id,
          question: text,
          progress: { steps: [], reply: "", status: "working" },
        },
      ],
    }));

    let last: Progress | undefined;
    try {
      const { progress } = await askCopper({
        messages,
        useTools: chat === "on",
      });
      for await (const update of readLive(progress)) {
        last = update;
        setTurn(chat, id, update);
      }
      if (last?.status === "working")
        setTurn(chat, id, { ...last, status: "done" });
    } catch {
      setTurn(chat, id, {
        steps: last?.steps ?? [],
        reply: last?.reply || SORRY,
        status: "error",
      });
    }
  }

  return (
    <>
      <PanelHeader>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2">
          <div className="flex-1">
            <p className="text-sm font-medium">Use tools</p>
            <p className="text-muted-foreground text-xs">
              {useTools ? "Checks every answer" : "Model guesses alone"}
            </p>
          </div>
          <Switch
            aria-label="Use tools"
            checked={useTools}
            onCheckedChange={setUseTools}
          />
        </div>
      </PanelHeader>

      <div
        ref={bodyRef}
        className="bg-secondary flex-1 space-y-6 overflow-y-auto px-4 py-5"
      >
        {turns.length === 0 && (
          <div className="space-y-1 text-center">
            <p className="font-semibold">
              {useTools
                ? "Ask about prices, totals or stock."
                : "Tools are off."}
            </p>
            <p className="text-muted-foreground text-sm">
              {useTools
                ? "Copper checks every answer with its tools. Try one of these:"
                : "Copper will answer from memory alone. Try one of these:"}
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} toolsOn={key === "on"} />
        ))}
        {!busy && (
          <div className="space-y-2">
            {turns.length > 0 && (
              <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                Keep going
              </p>
            )}
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => ask(starter)}
                className="bg-card hover:border-primary w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
        className="bg-card flex items-center gap-2 border-t px-3 py-3"
      >
        <input
          aria-label="Your question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={useTools ? "Ask Copper…" : "Ask Copper (no tools)…"}
          className="bg-background focus-visible:ring-ring/50 h-10 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-3"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={busy || !draft.trim()}
          className="size-10 rounded-full"
        >
          <ArrowUpIcon />
        </Button>
      </form>
    </>
  );
}

function TurnView({ turn, toolsOn }: { turn: Turn; toolsOn: boolean }) {
  const { progress } = turn;
  const working = progress.status === "working";
  const toolSteps = progress.steps.filter(
    (s): s is ToolStep => s.type === "tool",
  );
  const used = new Set(toolSteps.map((s) => s.name));

  let now = "Reading your question…";
  if (!toolsOn && !progress.reply) now = "Answering from memory…";
  else if (progress.reply) now = "Writing the answer…";
  else if (progress.steps.length > 0) now = "Deciding what to do next…";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">
          {turn.question}
        </p>
      </div>

      <div className="relative space-y-4 pl-9">
        <div
          aria-hidden
          className={cn(
            "absolute top-3 bottom-3 left-[0.6875rem] w-0.5 rounded-full",
            toolsOn
              ? "from-primary via-accent to-accent bg-linear-to-b"
              : "bg-chart-3",
          )}
        />

        <Station
          icon={<PackageIcon />}
          nodeClass={toolsOn ? "bg-accent" : "bg-chart-3"}
          label={
            toolsOn ? "Tools Copper can use" : "Tools given to Copper: none"
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(TOOL_LABELS).map((name) => (
              <span
                key={name}
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-xs",
                  !toolsOn
                    ? "text-muted-foreground line-through"
                    : used.has(name)
                      ? "bg-accent text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {name}
              </span>
            ))}
          </div>
          {!toolsOn && (
            <p className="text-muted-foreground mt-1.5 text-xs">
              Copper has to answer from memory alone.
            </p>
          )}
        </Station>

        {progress.steps.map((step, i) => {
          if (step.type === "thinking") {
            return (
              <Station
                key={i}
                icon={<BrainIcon />}
                nodeClass={toolsOn ? "bg-primary" : "bg-chart-3"}
                label="Copper is thinking"
              >
                <div
                  data-testid="thinking"
                  className="text-muted-foreground border-l-2 pl-3 text-sm italic"
                >
                  <MessageResponse>{step.text}</MessageResponse>
                </div>
              </Station>
            );
          }
          return (
            <Station
              key={step.id}
              icon={<WrenchIcon />}
              nodeClass="bg-accent"
              label={
                step.state === "calling"
                  ? "Copper is calling a tool"
                  : "Copper called a tool"
              }
            >
              <ToolCallCard step={step} index={toolSteps.indexOf(step) + 1} />
            </Station>
          );
        })}

        {working && (
          <div className="relative">
            <span className="bg-card ring-secondary absolute top-0 -left-9 flex size-6 items-center justify-center gap-0.5 rounded-full ring-4">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="bg-primary size-1 animate-bounce rounded-full"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            <p className="text-muted-foreground pt-0.5 text-sm">{now}</p>
          </div>
        )}
      </div>

      {(progress.reply || !working) && (
        <div className="bg-card rounded-2xl rounded-tl-sm border px-4 py-3 text-sm shadow-xs">
          <p className="text-primary mb-1 text-xs font-semibold">Copper</p>
          {!toolsOn && (
            <div className="border-chart-3 bg-chart-3/10 mb-2 rounded-lg border px-3 py-2 text-xs">
              <p className="flex items-center gap-1.5 font-semibold">
                <TriangleAlertIcon className="text-chart-3 size-3.5" />
                Answered without tools: may be made up
              </p>
              <p className="text-muted-foreground mt-1">
                With tools off, Copper can&apos;t see today&apos;s prices or
                stock. The AI only has what it learned in training, so it fills
                the gaps with guesses that sound right. That&apos;s a
                hallucination.
              </p>
            </div>
          )}
          <MessageResponse>{progress.reply}</MessageResponse>
          {working && (
            <span
              aria-hidden
              className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-text-bottom"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Station({
  icon,
  nodeClass,
  label,
  children,
}: {
  icon: React.ReactNode;
  nodeClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        className={cn(
          "text-primary-foreground ring-secondary absolute top-0 -left-9 flex size-6 items-center justify-center rounded-full ring-4 [&_svg]:size-3.5",
          nodeClass,
        )}
      >
        {icon}
      </span>
      <p className="text-muted-foreground mb-1.5 pt-1 text-[0.65rem] font-semibold tracking-widest uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
