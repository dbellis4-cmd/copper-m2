// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryRow } from "@/lib/copper/inventory";
import {
  calculateCost,
  calculateCostInput,
  checkAvailability,
  checkAvailabilityInput,
  copperTools,
  getPrices,
  listProducts,
} from "@/lib/copper/assistant/tools";

// A stock list each test can change, or null when stock is "down".
let rows: InventoryRow[] | null = [];
vi.mock("@/lib/copper/inventory", () => ({
  readInventory: vi.fn(async () => structuredClone(rows)),
}));

const row = (
  product: string,
  color: string,
  units: number,
  next = "2026-12-01",
) => ({
  sku: `${product}-${color}`,
  product,
  color,
  units_in_stock: units,
  next_shipment: next,
});

beforeEach(() => {
  rows = [
    row("Copper Home", "Polished Copper", 240),
    row("Copper Home", "Patina Teal", 6),
    row("Copper Home", "Night Sky", 10),
    row("Copper Notes", "Brushed Copper", 9),
    row("Copper Notes", "Desert Sand", 1),
    row("Copper Notes", "Night Sky", 0, "2026-11-14"),
  ];
});

const cost = (input: unknown) => calculateCost(calculateCostInput.parse(input));

describe("calculate_cost", () => {
  it("prices Copper Home with Copper Plus, paid yearly, for 2 years at $307", () => {
    expect(
      cost({
        products: ["copper-home"],
        plan: "copper-plus",
        billing: "annual",
        years: 2,
      }),
    ).toEqual({
      lines: [
        { item: "Copper Home", usd: 149 },
        { item: "Copper Plus (annual, 2 years)", usd: 158 },
      ],
      totalUsd: 307,
    });
  });

  it("counts Copper Plus once for the whole household", () => {
    const result = cost({
      products: ["copper-home", "copper-home"],
      plan: "copper-plus",
      billing: "annual",
      years: 2,
    });
    expect(result.lines).toHaveLength(3);
    expect(result.totalUsd).toBe(456);
  });

  it("rounds monthly billing to cents", () => {
    const result = cost({
      products: [],
      plan: "copper-plus",
      billing: "monthly",
      years: 2,
    });
    expect(result).toEqual({
      lines: [{ item: "Copper Plus (monthly, 2 years)", usd: 191.76 }],
      totalUsd: 191.76,
    });
  });

  it("adds no line for the free plan", () => {
    const result = cost({
      products: ["copper-notes"],
      plan: "free",
      billing: "annual",
      years: 5,
    });
    expect(result).toEqual({
      lines: [{ item: "Copper Notes", usd: 129 }],
      totalUsd: 129,
    });
    expect(
      cost({ products: [], plan: "free", billing: "monthly", years: 1 }),
    ).toEqual({
      lines: [],
      totalUsd: 0,
    });
  });

  it("rejects input outside the contract, even when called directly", () => {
    const ok = {
      products: ["copper-home"],
      plan: "free",
      billing: "monthly",
      years: 1,
    };
    for (const bad of [
      { ...ok, products: ["copper-watch"] },
      { ...ok, products: Array(6).fill("copper-notes") },
      { ...ok, plan: "gold" },
      { ...ok, billing: "weekly" },
      { ...ok, years: 0 },
      { ...ok, years: 6 },
      { ...ok, years: 1.5 },
      { ...ok, years: "2" },
      { ...ok, discount: 50 },
      { products: ["copper-home"], plan: "free", billing: "monthly" },
    ]) {
      expect(
        calculateCostInput.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
    expect(() => calculateCost({ ...ok, years: 9 } as never)).toThrow();
  });
});

describe("get_products and get_prices", () => {
  it("lists each product's colors with no stock information", () => {
    const notes = listProducts().products.find((p) => p.id === "copper-notes");
    expect(notes).toEqual({
      id: "copper-notes",
      name: "Copper Notes",
      type: "AI clip-on recorder",
      priceUsd: 129,
      colors: ["Brushed Copper", "Desert Sand", "Night Sky"],
    });
    expect(JSON.stringify(listProducts())).not.toMatch(/stock|backordered/);
  });

  it("returns every product and plan price", () => {
    expect(getPrices()).toEqual({
      products: [
        { id: "copper-home", name: "Copper Home", priceUsd: 149 },
        { id: "copper-notes", name: "Copper Notes", priceUsd: 129 },
      ],
      plans: [
        { id: "free", name: "Free", monthlyUsd: 0, annualUsd: 0 },
        {
          id: "copper-plus",
          name: "Copper Plus",
          monthlyUsd: 7.99,
          annualUsd: 79,
        },
      ],
    });
  });
});

describe("check_availability", () => {
  it("labels stock at the 0, 1, 9 and 10 unit boundaries", async () => {
    expect(await checkAvailability({ product: "copper-notes" })).toEqual({
      status: "ok",
      product: "Copper Notes",
      colors: [
        { color: "Brushed Copper", stock: "low_stock", restockDate: null },
        { color: "Desert Sand", stock: "low_stock", restockDate: null },
        { color: "Night Sky", stock: "backordered", restockDate: "2026-11-14" },
      ],
    });
    const home = await checkAvailability({
      product: "copper-home",
      color: "Night Sky",
    });
    expect(home).toMatchObject({
      colors: [{ color: "Night Sky", stock: "in_stock" }],
    });
  });

  it("matches a color in any capitalization and answers in the catalog's", async () => {
    expect(
      await checkAvailability({
        product: "copper-home",
        color: "  pAtInA tEaL ",
      }),
    ).toEqual({
      status: "ok",
      product: "Copper Home",
      colors: [{ color: "Patina Teal", stock: "low_stock", restockDate: null }],
    });
  });

  it("only uses rows for the product asked about", async () => {
    const result = await checkAvailability({
      product: "copper-home",
      color: "Night Sky",
    });
    expect(result).toMatchObject({
      colors: [{ stock: "in_stock", restockDate: null }],
    });
  });

  it("reads the stock list every time it runs", async () => {
    await checkAvailability({ product: "copper-notes", color: "Night Sky" });
    rows!.find(
      (r) => r.product === "Copper Notes" && r.color === "Night Sky",
    )!.units_in_stock = 40;
    expect(
      await checkAvailability({ product: "copper-notes", color: "Night Sky" }),
    ).toMatchObject({
      colors: [{ color: "Night Sky", stock: "in_stock", restockDate: null }],
    });
  });

  it("leaves out a color with no stock row", async () => {
    rows = rows!.filter((r) => r.color !== "Desert Sand");
    const result = await checkAvailability({ product: "copper-notes" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.colors.map((c) => c.color)).toEqual([
      "Brushed Copper",
      "Night Sky",
    ]);
  });

  it("says Copper Notes doesn't come in Patina Teal, even when stock is down", async () => {
    const notAColor = {
      status: "not_a_color",
      product: "Copper Notes",
      color: "Patina Teal",
      colors: ["Brushed Copper", "Desert Sand", "Night Sky"],
    };
    expect(
      await checkAvailability({
        product: "copper-notes",
        color: "Patina Teal",
      }),
    ).toEqual(notAColor);
    rows = null;
    expect(
      await checkAvailability({
        product: "copper-notes",
        color: "Patina Teal",
      }),
    ).toEqual(notAColor);
  });

  it("gives no stock levels when stock can't be read", async () => {
    rows = null;
    const result = await checkAvailability({
      product: "copper-home",
      color: "Night Sky",
    });
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toMatch(
      /in_stock|low_stock|backordered/,
    );
  });

  it("only accepts a Copper product and an optional color", () => {
    expect(
      checkAvailabilityInput.safeParse({ product: "copper-notes" }).success,
    ).toBe(true);
    for (const bad of [
      {},
      { product: "copper-watch" },
      { product: "copper-home", color: 3 },
    ]) {
      expect(
        checkAvailabilityInput.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe("copperTools", () => {
  it("has the four tools, each described and runnable", async () => {
    expect(Object.keys(copperTools).sort()).toEqual([
      "calculate_cost",
      "check_availability",
      "get_prices",
      "get_products",
    ]);
    for (const tool of Object.values(copperTools)) {
      expect(tool.description).toMatch(/\w{4,}/);
    }
    const options = { toolCallId: "t1", messages: [] } as never;
    expect(
      await copperTools.calculate_cost.execute(
        {
          products: ["copper-home"],
          plan: "copper-plus",
          billing: "annual",
          years: 2,
        },
        options,
      ),
    ).toMatchObject({ totalUsd: 307 });
  });
});
