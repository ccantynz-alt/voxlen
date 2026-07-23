import { describe, expect, it } from "vitest";
import { buildPacket, canTransition, parsePacket, parseStatus } from "./reviewPacket";

const record = {
  id: "session", started_at_ms: 1, ended_at_ms: 2, duration_ms: 1, word_count: 1,
  language: "en", segments: [{ id: "s", text: "hello", corrected_text: null, confidence: 1,
    language: "en", timestamp_ms: 1, grammar_applied: false }],
};

describe("review packets", () => {
  it("roundtrips packet and status", () => {
    const packet = buildPacket(record, "Smith & Co", "M-1", "Lawyer");
    expect(parsePacket(JSON.stringify(packet))).toEqual({ ok: true, value: packet });
    const status = { schemaVersion: 1, status: "pending_review" as const, updatedAt: packet.createdAt, updatedBy: "Lawyer" };
    expect(parseStatus(JSON.stringify(status))).toEqual({ ok: true, value: status });
  });
  it("rejects malformed JSON", () => expect(parsePacket("{")).toMatchObject({ ok: false, error: { kind: "malformed" } }));
  it("identifies a newer schema", () => expect(parseStatus('{"schemaVersion":2}')).toMatchObject({ ok: false, error: { kind: "newer-version" } }));
  it("enforces the transition matrix", () => {
    const states = ["pending_review", "in_review", "finalized"] as const;
    expect(states.map((from) => states.map((to) => canTransition(from, to)))).toEqual([
      [false, true, false], [false, false, true], [false, false, false],
    ]);
  });
});
