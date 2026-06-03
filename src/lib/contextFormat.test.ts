import { describe, it, expect } from "vitest";
import {
  applyContextFormat,
  getContextLabel,
  isLegalContext,
  isAccountingContext,
} from "./contextFormat";

describe("applyContextFormat — legal_contract", () => {
  it("converts 'clause X point Y' to 'Clause N.N'", () => {
    const out = applyContextFormat(
      "refer to clause one point two for details",
      { context: "legal_contract" }
    );
    expect(out).toContain("Clause 1.2");
  });

  it("converts schedule references", () => {
    const out = applyContextFormat("see schedule three", { context: "legal_contract" });
    expect(out).toContain("Schedule 3");
  });
});

describe("applyContextFormat — legal_case_note", () => {
  it("replaces 'attendance note' prefix with formal heading", () => {
    const out = applyContextFormat("attendance note: client called", { context: "legal_case_note" });
    expect(out).toContain("ATTENDANCE NOTE");
    expect(out).toContain("client called");
  });

  it("formats matter number", () => {
    const out = applyContextFormat("matter number 12345", { context: "legal_case_note" });
    expect(out).toContain("Matter No: 12345");
  });
});

describe("applyContextFormat — legal_court_filing", () => {
  it("converts 'versus' to 'v'", () => {
    const out = applyContextFormat("Smith versus Jones is the leading case", {
      context: "legal_court_filing",
    });
    expect(out).toContain("Smith v Jones");
  });

  it("capitalises plaintiff/defendant", () => {
    const out = applyContextFormat("the plaintiff filed a claim", {
      context: "legal_court_filing",
    });
    expect(out).toContain("Plaintiff");
  });
});

describe("applyContextFormat — legal_deposition", () => {
  it("prepends Q. for examiner speaker label", () => {
    const out = applyContextFormat("what is your name", {
      context: "legal_deposition",
      speakerLabel: "Counsel for Plaintiff",
    });
    expect(out).toBe("Q. What is your name");
  });

  it("prepends A. for witness speaker label", () => {
    const out = applyContextFormat("my name is John", {
      context: "legal_deposition",
      speakerLabel: "Witness",
    });
    expect(out).toBe("A. My name is John");
  });

  it("returns text unchanged when no speaker label", () => {
    const text = "my name is John";
    const out = applyContextFormat(text, { context: "legal_deposition" });
    expect(out).toBe(text);
  });
});

describe("applyContextFormat — accounting_tax", () => {
  it("converts word percent to number% for a standalone amount", () => {
    // The formatter converts a word amount directly preceding 'percent'
    const out = applyContextFormat("fifteen percent", { context: "accounting_tax" });
    expect(out).toContain("15%");
  });

  it("uppercases GST", () => {
    const out = applyContextFormat("add gst to the invoice", { context: "accounting_tax" });
    expect(out).toContain("GST");
  });

  it("uppercases PAYE", () => {
    const out = applyContextFormat("paye deductions apply", { context: "accounting_tax" });
    expect(out).toContain("PAYE");
  });
});

describe("applyContextFormat — accounting_audit", () => {
  it("converts 'finding one' to 'Finding 1:'", () => {
    const out = applyContextFormat("finding one the controls are adequate", {
      context: "accounting_audit",
    });
    expect(out).toContain("Finding 1:");
  });

  it("converts 'material weakness'", () => {
    const out = applyContextFormat("we identified a material weakness", {
      context: "accounting_audit",
    });
    expect(out).toContain("Material Weakness");
  });
});

describe("applyContextFormat — correspondence", () => {
  it("formats salutation correctly", () => {
    const out = applyContextFormat("dear mr smith i am writing", {
      context: "legal_correspondence",
    });
    expect(out).toContain("Dear Mr. Smith");
  });

  it("formats closing", () => {
    const out = applyContextFormat("yours sincerely", {
      context: "accounting_correspondence",
    });
    expect(out).toContain("Yours sincerely,");
  });
});

describe("applyContextFormat — passthrough contexts", () => {
  it("general context returns text unchanged", () => {
    const text = "just a normal sentence";
    expect(applyContextFormat(text, { context: "general" })).toBe(text);
  });

  it("legal_general context returns text unchanged", () => {
    const text = "some legal text";
    expect(applyContextFormat(text, { context: "legal_general" })).toBe(text);
  });

  it("accounting_general context returns text unchanged", () => {
    const text = "some accounting text";
    expect(applyContextFormat(text, { context: "accounting_general" })).toBe(text);
  });
});

describe("helper functions", () => {
  it("getContextLabel returns human-readable label", () => {
    expect(getContextLabel("legal_contract")).toBe("Legal — Contract");
    expect(getContextLabel("accounting_tax")).toBe("Accounting — Tax");
    expect(getContextLabel("general")).toBe("General");
  });

  it("isLegalContext returns true for legal_ contexts", () => {
    expect(isLegalContext("legal_contract")).toBe(true);
    expect(isLegalContext("legal_general")).toBe(true);
    expect(isLegalContext("accounting_tax")).toBe(false);
    expect(isLegalContext("general")).toBe(false);
  });

  it("isAccountingContext returns true for accounting_ contexts", () => {
    expect(isAccountingContext("accounting_audit")).toBe(true);
    expect(isAccountingContext("legal_contract")).toBe(false);
    expect(isAccountingContext("general")).toBe(false);
  });
});
