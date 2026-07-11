import { describe, it, expect } from "vitest";
import {
  roundBillableSeconds,
  computeBillableAmount,
  resolveRate,
  draftNarrative,
} from "./billing";
import type { Client } from "@/stores/clients";

function client(billableRate: number): Client {
  return {
    id: "c1",
    name: "Acme Corp",
    billableRate,
    color: "#fff",
    archived: false,
    createdAt: 0,
  };
}

describe("roundBillableSeconds", () => {
  it("rounds UP to the 0.1hr increment (legal convention)", () => {
    expect(roundBillableSeconds(7 * 60, 0.1, 0.1)).toBe(0.2); // 7 min → 0.2, not 0.116
    expect(roundBillableSeconds(61, 0.1, 0.1)).toBe(0.1);
    expect(roundBillableSeconds(19 * 60, 0.25, 0)).toBe(0.5);
  });

  it("does not round up when exactly on the increment boundary", () => {
    expect(roundBillableSeconds(6 * 60, 0.1, 0.1)).toBe(0.1);
    expect(roundBillableSeconds(12 * 60, 0.1, 0.1)).toBe(0.2);
    expect(roundBillableSeconds(15 * 60, 0.25, 0)).toBe(0.25);
    expect(roundBillableSeconds(3600, 0.1, 0.1)).toBe(1);
  });

  it("enforces the minimum billable increment", () => {
    expect(roundBillableSeconds(1, 0.1, 0.1)).toBe(0.1);
    expect(roundBillableSeconds(30, 0, 0.1)).toBe(0.1);
  });

  it("passes raw hours through when increment is 0", () => {
    expect(roundBillableSeconds(1800, 0, 0)).toBe(0.5);
    expect(roundBillableSeconds(420, 0, 0)).toBeCloseTo(0.1167, 3);
  });

  it("returns 0 for non-positive durations", () => {
    expect(roundBillableSeconds(0, 0.1, 0.1)).toBe(0);
    expect(roundBillableSeconds(-5, 0.1, 0.1)).toBe(0);
  });
});

describe("computeBillableAmount", () => {
  it("computes amount from rounded hours", () => {
    const r = computeBillableAmount(7 * 60, 350, { incrementHours: 0.1, minimumHours: 0.1 });
    expect(r.hours).toBe(0.2);
    expect(r.amount).toBe(70);
    expect(r.rounded).toBe(true);
  });

  it("flags rounded=false when duration is exactly on grid", () => {
    const r = computeBillableAmount(6 * 60, 500, { incrementHours: 0.1, minimumHours: 0.1 });
    expect(r.hours).toBe(0.1);
    expect(r.amount).toBe(50);
    expect(r.rounded).toBe(false);
  });

  it("yields $0 amount at rate 0 (caller must warn via resolveRate)", () => {
    const r = computeBillableAmount(600, 0, { incrementHours: 0.1, minimumHours: 0.1 });
    expect(r.amount).toBe(0);
    expect(r.hours).toBeGreaterThan(0);
  });
});

describe("resolveRate", () => {
  it("prefers the client rate when set", () => {
    expect(resolveRate(client(450), 350)).toEqual({ rate: 450, source: "client" });
  });

  it("falls back to the default rate when client rate is 0", () => {
    expect(resolveRate(client(0), 350)).toEqual({ rate: 350, source: "default" });
  });

  it("returns source 'none' when both resolve to 0", () => {
    expect(resolveRate(client(0), 0)).toEqual({ rate: 0, source: "none" });
    expect(resolveRate(undefined, 0)).toEqual({ rate: 0, source: "none" });
  });

  it("uses default when no client is given", () => {
    expect(resolveRate(undefined, 200)).toEqual({ rate: 200, source: "default" });
  });
});

describe("draftNarrative", () => {
  it("takes the first sentence", () => {
    expect(draftNarrative("Drafted letter to opposing counsel. Then reviewed discovery."))
      .toBe("Drafted letter to opposing counsel.");
  });

  it("takes the first line when no sentence terminator", () => {
    expect(draftNarrative("Attendance note re settlement call\nmore detail here"))
      .toBe("Attendance note re settlement call");
  });

  it("truncates long narratives with an ellipsis", () => {
    const long = "word ".repeat(60).trim();
    const out = draftNarrative(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith("…")).toBe(true);
  });

  it("falls back for empty text", () => {
    expect(draftNarrative("   ")).toBe("Dictation session");
  });

  it("does not treat decimals as sentence boundaries", () => {
    expect(draftNarrative("Fee is 1.5 hours at the agreed rate. Next item."))
      .toBe("Fee is 1.5 hours at the agreed rate.");
  });
});
