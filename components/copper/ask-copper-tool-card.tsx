"use client";

// Module 2: one tool call in an Ask Copper answer, drawn as a round trip:
// what Copper sent the app, then what came back (spec.md section 5, station 3).
// Always open, so a shopper sees the work without clicking anything.
import { cn } from "cn";
import { formatUsd } from "@/lib/copper/catalog";
import type { ToolStep } from "@/lib/copper/assistant/progress";
import { TOOL_LABELS } from "@/lib/copper/assistant/progress";
import type {
  Availability,
  CostBreakdown,
  Prices,
  ProductList,
} from "@/lib/copper/assistant/tools";
import { Spinner } from "@/components/ui/spinner";

const PRODUCT_NAMES: Record<string, string> = {
  "copper-home": "Copper Home",
  "copper-notes": "Copper Notes",
};
const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  "copper-plus": "Copper Plus",
};

const NO_INPUT: Record<string, string> = {
  get_prices: "Nothing, it just asked for the price list",
  get_products: "Nothing, it just asked what Copper sells",
};

type Row = [label: string, value: string];

/** What Copper sent, as labelled rows rather than raw JSON. */
function inputRows(name: string, input: unknown): Row[] {
  const value = (input ?? {}) as Record<string, unknown>;
  if (name === "calculate_cost") {
    const products = Array.isArray(value.products) ? value.products : [];
    return [
      [
        "Products",
        products.length
          ? products
              .map((id) => PRODUCT_NAMES[String(id)] ?? String(id))
              .join(", ")
          : "None",
      ],
      ["Plan", PLAN_NAMES[String(value.plan)] ?? String(value.plan ?? "")],
      ["Billing", String(value.billing ?? "")],
      ["Years", String(value.years ?? "")],
    ];
  }
  if (name === "check_availability") {
    return [
      [
        "Product",
        PRODUCT_NAMES[String(value.product)] ?? String(value.product ?? ""),
      ],
      ["Color", value.color ? String(value.color) : "Every color"],
    ];
  }
  return Object.entries(value).map(([key, v]) => [
    key,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
}

/** "2026-11-14" → "Nov 14, 2026", read as a calendar date, not a time. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function CostResult({ output }: { output: CostBreakdown }) {
  return (
    <div className="space-y-1">
      {output.lines.map((line, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span>{line.item}</span>
          <span className="tabular-nums">{formatUsd(line.usd)}</span>
        </div>
      ))}
      <div className="border-accent/30 mt-2 flex items-baseline justify-between gap-4 border-t pt-2">
        <span className="font-semibold">Total</span>
        <span className="text-primary text-xl font-bold tabular-nums">
          {formatUsd(output.totalUsd)}
        </span>
      </div>
    </div>
  );
}

function ProductsResult({ output }: { output: ProductList }) {
  return (
    <div className="space-y-3">
      {output.products.map((product) => (
        <div key={product.id}>
          <div className="flex justify-between gap-4 font-medium">
            <span>{product.name}</span>
            <span className="tabular-nums">{formatUsd(product.priceUsd)}</span>
          </div>
          <p className="text-muted-foreground text-xs">{product.type}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {product.colors.map((color) => (
              <Pill key={color} className="bg-accent/15 text-accent">
                {color}
              </Pill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PricesResult({ output }: { output: Prices }) {
  return (
    <div className="space-y-1">
      {output.products.map((product) => (
        <div key={product.id} className="flex justify-between gap-4">
          <span>{product.name}</span>
          <span className="tabular-nums">{formatUsd(product.priceUsd)}</span>
        </div>
      ))}
      {output.plans
        .filter((plan) => plan.monthlyUsd > 0 || plan.annualUsd > 0)
        .map((plan) => (
          <div key={plan.id} className="flex justify-between gap-4">
            <span>{plan.name}</span>
            <span className="tabular-nums">
              {formatUsd(plan.monthlyUsd)}/mo · {formatUsd(plan.annualUsd)}/yr
            </span>
          </div>
        ))}
    </div>
  );
}

function AvailabilityResult({ output }: { output: Availability }) {
  if (output.status === "unavailable") return <p>{output.message}</p>;
  if (output.status === "not_a_color") {
    return (
      <p>
        {output.product} doesn&apos;t come in {output.color}. It comes in{" "}
        {output.colors.join(", ")}.
      </p>
    );
  }
  if (output.colors.length === 0)
    return <p>No stock found for {output.product}.</p>;
  return (
    <div className="space-y-1.5">
      {output.colors.map((entry) => (
        <div
          key={entry.color}
          className="flex items-center justify-between gap-4"
        >
          <span>{entry.color}</span>
          {entry.stock === "in_stock" && (
            <Pill className="bg-accent text-primary-foreground">In stock</Pill>
          )}
          {entry.stock === "low_stock" && (
            <Pill className="bg-chart-4 text-foreground">Low stock</Pill>
          )}
          {entry.stock === "backordered" && (
            <Pill className="bg-chart-3 text-primary-foreground">
              Back-ordered
              {entry.restockDate
                ? ` until ${formatDate(entry.restockDate)}`
                : ""}
            </Pill>
          )}
        </div>
      ))}
    </div>
  );
}

function ToolResult({ step }: { step: ToolStep }) {
  if (step.state === "error") {
    return <p>The tool couldn&apos;t answer: {String(step.output)}</p>;
  }
  const output = step.output;
  if (output === undefined || output === null) return <p>Nothing came back.</p>;
  switch (step.name) {
    case "calculate_cost":
      return <CostResult output={output as CostBreakdown} />;
    case "get_products":
      return <ProductsResult output={output as ProductList} />;
    case "get_prices":
      return <PricesResult output={output as Prices} />;
    case "check_availability":
      return <AvailabilityResult output={output as Availability} />;
    default:
      return (
        <pre className="font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(output, null, 2)}
        </pre>
      );
  }
}

const SECTION_LABEL =
  "text-muted-foreground mb-1.5 text-[0.65rem] font-semibold tracking-widest uppercase";

export function ToolCallCard({
  step,
  index,
}: {
  step: ToolStep;
  index: number;
}) {
  const running = step.state === "calling";
  const inputKnown = step.input !== undefined;
  return (
    <div
      data-testid="tool-call"
      data-tool={step.name}
      className="bg-card overflow-hidden rounded-xl border text-sm shadow-xs"
    >
      <div className="bg-accent text-primary-foreground flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-mono font-bold">{step.name}()</span>
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]">
          tool {index}
        </span>
        <span className="ml-auto text-xs opacity-90">
          {TOOL_LABELS[step.name] ?? step.name}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className={SECTION_LABEL}>→ What Copper sent</p>
        {!inputKnown ? (
          <p className="text-muted-foreground italic">
            filling in the details…
          </p>
        ) : NO_INPUT[step.name] ? (
          <p className="text-muted-foreground">{NO_INPUT[step.name]}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {inputRows(step.name, step.input).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="bg-accent/10 border-t px-3 py-2.5">
        <p className={SECTION_LABEL}>← What came back</p>
        {running ? (
          <p className="text-muted-foreground flex items-center gap-2 italic">
            <Spinner className="size-3.5" />
            the app is running the code…
          </p>
        ) : (
          <ToolResult step={step} />
        )}
      </div>
    </div>
  );
}
