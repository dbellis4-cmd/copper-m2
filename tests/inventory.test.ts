// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readInventory, type InventoryRow } from "@/lib/copper/inventory";

// A fake Supabase client: each test sets what the inventory query returns,
// or sets `client` to null for "Supabase isn't set up".
type Result = { data: InventoryRow[] | null; error: { message: string } | null };
let result: Result | (() => never);
const from = vi.fn();
let client: { from: typeof from } | null;

vi.mock("@/lib/supabase/server", () => ({
  createStatelessClient: () => client,
}));

const ROWS: InventoryRow[] = [
  {
    sku: "CH-POL",
    product: "Copper Home",
    color: "Polished Copper",
    units_in_stock: 240,
    next_shipment: "2026-11-20",
  },
  {
    sku: "CN-NSK",
    product: "Copper Notes",
    color: "Night Sky",
    units_in_stock: 0,
    next_shipment: "2026-11-14",
  },
];

beforeEach(() => {
  result = { data: structuredClone(ROWS), error: null };
  from.mockReset();
  from.mockImplementation(() => ({
    select: () => ({
      order: async () => (typeof result === "function" ? result() : result),
    }),
  }));
  client = { from };
});

describe("readInventory", () => {
  it("returns every row of the Supabase inventory table", async () => {
    expect(await readInventory()).toEqual(ROWS);
    expect(from).toHaveBeenCalledWith("inventory");
  });

  it("reads the table fresh on every call", async () => {
    await readInventory();
    result = { data: [{ ...ROWS[1], units_in_stock: 40 }], error: null };
    expect(await readInventory()).toEqual([{ ...ROWS[1], units_in_stock: 40 }]);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("returns null when Supabase isn't set up", async () => {
    client = null;
    expect(await readInventory()).toBeNull();
  });

  it("returns null when the query fails", async () => {
    result = { data: null, error: { message: "relation does not exist" } };
    expect(await readInventory()).toBeNull();
  });

  it("returns null when Supabase can't be reached", async () => {
    result = () => {
      throw new Error("fetch failed");
    };
    expect(await readInventory()).toBeNull();
  });
});
