/**
 * Legal e-billing exports: LEDES 1998B and Clio-compatible CSV.
 *
 * LEDES 1998B is the pipe-delimited invoice format accepted by nearly
 * every e-billing platform. Records end with "[]" and lines are CRLF.
 * Only APPROVED entries belong in these exports — callers must filter.
 */

import type { Client, MatterEntry } from "@/stores/clients";

export interface LedesMeta {
  invoiceNumber: string;
  invoiceDate: Date;
  lawFirmId: string;
  timekeeperId: string;
  timekeeperName: string;
  timekeeperClassification: string; // e.g. "PT" partner, "AS" associate
}

const LEDES_HEADER =
  "LEDES1998B[]\r\n" +
  [
    "INVOICE_DATE",
    "INVOICE_NUMBER",
    "CLIENT_ID",
    "LAW_FIRM_MATTER_ID",
    "INVOICE_TOTAL",
    "BILLING_START_DATE",
    "BILLING_END_DATE",
    "INVOICE_DESCRIPTION",
    "LINE_ITEM_NUMBER",
    "EXP/FEE/INV_ADJ_TYPE",
    "LINE_ITEM_NUMBER_OF_UNITS",
    "LINE_ITEM_ADJUSTMENT_AMOUNT",
    "LINE_ITEM_TOTAL",
    "LINE_ITEM_DATE",
    "LINE_ITEM_TASK_CODE",
    "LINE_ITEM_EXPENSE_CODE",
    "LINE_ITEM_ACTIVITY_CODE",
    "TIMEKEEPER_ID",
    "LINE_ITEM_DESCRIPTION",
    "LAW_FIRM_ID",
    "LINE_ITEM_UNIT_COST",
    "TIMEKEEPER_NAME",
    "TIMEKEEPER_CLASSIFICATION",
    "CLIENT_MATTER_ID",
  ].join("|") + "[]";

function ledesDate(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** LEDES fields must not contain pipes or CR/LF. */
function ledesText(s: string): string {
  return s.replace(/[|\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

export function exportLedes1998B(
  client: Client,
  entries: MatterEntry[],
  meta: LedesMeta
): { content: string; filename: string; mimeType: string } {
  const approved = entries.filter((e) => e.status === "approved");
  const invoiceTotal = approved.reduce((s, e) => s + e.billableAmount, 0);
  const dates = approved.map((e) => e.date);
  const billingStart = dates.length ? Math.min(...dates) : meta.invoiceDate.getTime();
  const billingEnd = dates.length ? Math.max(...dates) : meta.invoiceDate.getTime();
  const matterId = client.matterNumber || client.id;

  const lines: string[] = [LEDES_HEADER];
  approved.forEach((e, i) => {
    const rate = e.rateAtTime ?? client.billableRate;
    const hours = rate > 0 ? e.billableAmount / rate : e.durationSeconds / 3600;
    lines.push(
      [
        ledesDate(meta.invoiceDate),
        ledesText(meta.invoiceNumber),
        ledesText(client.id),
        ledesText(matterId),
        invoiceTotal.toFixed(2),
        ledesDate(billingStart),
        ledesDate(billingEnd),
        ledesText(`Dictation services — ${client.name}`),
        String(i + 1),
        "F", // fee line item
        hours.toFixed(2),
        "0.00",
        e.billableAmount.toFixed(2),
        ledesDate(e.date),
        "", // task code (not captured)
        "", // expense code (fees only)
        ledesText(e.activityCode ?? ""),
        ledesText(meta.timekeeperId),
        ledesText(e.note || "Dictation session"),
        ledesText(meta.lawFirmId),
        rate.toFixed(2),
        ledesText(meta.timekeeperName),
        ledesText(meta.timekeeperClassification),
        ledesText(matterId),
      ].join("|") + "[]"
    );
  });

  const slug = client.name.toLowerCase().replace(/\s+/g, "-");
  return {
    content: lines.join("\r\n") + "\r\n",
    filename: `voxlen-ledes-${slug}-${ledesDate(meta.invoiceDate)}.txt`,
    mimeType: "text/plain",
  };
}

/**
 * Clio time-entry import CSV. Column set matches Clio's bulk time-entry
 * importer (Date / Matter / Description / Rate / Quantity in hours /
 * Activity Category / Type / Non-billable). Verify against a live Clio
 * import screen before marketing this as a certified integration.
 */
export function exportClioCsv(
  client: Client,
  entries: MatterEntry[]
): { content: string; filename: string; mimeType: string } {
  const approved = entries.filter((e) => e.status === "approved");
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows: string[] = [
    ["Date", "Matter", "Description", "Rate", "Quantity", "Activity Category", "Type", "Non-billable"].join(","),
  ];
  for (const e of approved) {
    const rate = e.rateAtTime ?? client.billableRate;
    const hours = rate > 0 ? e.billableAmount / rate : e.durationSeconds / 3600;
    const date = new Date(e.date);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    rows.push(
      [
        iso,
        q(client.matterNumber || client.name),
        q(e.note || "Dictation session"),
        rate.toFixed(2),
        hours.toFixed(1),
        q(e.activityCode ?? ""),
        "TimeEntry",
        "FALSE",
      ].join(",")
    );
  }
  const slug = client.name.toLowerCase().replace(/\s+/g, "-");
  const timestamp = new Date().toISOString().slice(0, 10);
  return {
    content: rows.join("\r\n"),
    filename: `voxlen-clio-${slug}-${timestamp}.csv`,
    mimeType: "text/csv",
  };
}
