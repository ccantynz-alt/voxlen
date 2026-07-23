import { describe, it, expect } from "vitest";
import { exportLedes1998B, exportClioCsv } from "./exportLedes";
import type { Client, MatterEntry } from "@/stores/clients";

const client: Client = {
  id: "c1",
  name: "Smith & Co",
  matterNumber: "M-001",
  billableRate: 400,
  color: "#fff",
  archived: false,
  createdAt: 0,
};

const meta = {
  invoiceNumber: "INV-001",
  invoiceDate: new Date("2026-07-01T12:00:00"),
  lawFirmId: "12-3456789",
  timekeeperId: "CC01",
  timekeeperName: "C. Canty",
  timekeeperClassification: "PT",
};

function entry(overrides: Partial<MatterEntry> = {}): MatterEntry {
  return {
    id: "e1",
    clientId: "c1",
    date: new Date("2026-06-15T10:00:00").getTime(),
    durationSeconds: 720,
    wordCount: 300,
    billableAmount: 80, // 0.2h @ 400
    rateAtTime: 400,
    note: "Drafted correspondence re discovery",
    status: "approved",
    source: "session",
    activityCode: "A103",
    ...overrides,
  };
}

describe("exportLedes1998B", () => {
  it("emits the LEDES1998B header, field header and one record per approved entry", () => {
    const { content, filename, mimeType } = exportLedes1998B(client, [entry()], meta);
    const lines = content.trimEnd().split("\r\n");
    expect(lines[0]).toBe("LEDES1998B[]");
    expect(lines[1].startsWith("INVOICE_DATE|INVOICE_NUMBER|")).toBe(true);
    expect(lines[1].endsWith("[]")).toBe(true);
    expect(lines).toHaveLength(3);
    expect(filename).toContain("ledes");
    expect(mimeType).toBe("text/plain");
  });

  it("each record has 24 pipe-delimited fields and [] terminator", () => {
    const { content } = exportLedes1998B(client, [entry()], meta);
    const record = content.trimEnd().split("\r\n")[2];
    expect(record.endsWith("[]")).toBe(true);
    const fields = record.slice(0, -2).split("|");
    expect(fields).toHaveLength(24);
    expect(fields[0]).toBe("20260701"); // invoice date YYYYMMDD
    expect(fields[9]).toBe("F"); // fee line
    expect(fields[10]).toBe("0.20"); // hours
    expect(fields[12]).toBe("80.00"); // line total
    expect(fields[13]).toBe("20260615"); // line item date
    expect(fields[16]).toBe("A103"); // activity code
    expect(fields[20]).toBe("400.00"); // unit cost
  });

  it("excludes draft entries", () => {
    const { content } = exportLedes1998B(
      client,
      [entry(), entry({ id: "e2", status: "draft" })],
      meta
    );
    expect(content.trimEnd().split("\r\n")).toHaveLength(3); // header x2 + 1 record
  });

  it("strips pipes and newlines from free-text fields", () => {
    const { content } = exportLedes1998B(
      client,
      [entry({ note: "bad|note\r\nwith breaks" })],
      meta
    );
    const record = content.trimEnd().split("\r\n")[2];
    expect(record.slice(0, -2).split("|")).toHaveLength(24);
    expect(record).toContain("bad note with breaks");
  });
});

describe("exportClioCsv", () => {
  it("emits Clio import columns with hours quantity at 1dp", () => {
    const { content } = exportClioCsv(client, [entry()]);
    const [header, row] = content.split("\r\n");
    expect(header).toBe("Date,Matter,Description,Rate,Quantity,Activity Category,Type,Non-billable");
    expect(row).toContain("2026-06-15");
    expect(row).toContain('"M-001"');
    expect(row).toContain("0.2");
    expect(row).toContain("TimeEntry");
  });

  it("quotes descriptions containing commas", () => {
    const { content } = exportClioCsv(client, [entry({ note: "Draft, review" })]);
    expect(content).toContain('"Draft, review"');
  });

  it("excludes drafts", () => {
    const { content } = exportClioCsv(client, [entry({ status: "draft" })]);
    expect(content.split("\r\n")).toHaveLength(1); // header only
  });
});
