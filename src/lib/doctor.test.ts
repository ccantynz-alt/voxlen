import { describe, it, expect } from "vitest";
import { worstStatus, countIssues, summaryLine, type DoctorCheck } from "./doctor";

function check(status: DoctorCheck["status"], id = "x"): DoctorCheck {
  return {
    id,
    name: id,
    status,
    detail: "detail",
    fixHint: status === "ok" ? null : "fix it",
  };
}

describe("worstStatus", () => {
  it("returns ok for an empty list", () => {
    expect(worstStatus([])).toBe("ok");
  });

  it("returns ok when every check passes", () => {
    expect(worstStatus([check("ok"), check("ok")])).toBe("ok");
  });

  it("returns warn when the worst check is a warning", () => {
    expect(worstStatus([check("ok"), check("warn"), check("ok")])).toBe("warn");
  });

  it("returns fail whenever any check fails, regardless of order", () => {
    expect(worstStatus([check("warn"), check("fail"), check("ok")])).toBe("fail");
    expect(worstStatus([check("ok"), check("ok"), check("fail")])).toBe("fail");
  });
});

describe("countIssues", () => {
  it("counts only non-ok checks", () => {
    expect(countIssues([])).toBe(0);
    expect(countIssues([check("ok"), check("ok")])).toBe(0);
    expect(countIssues([check("ok"), check("warn"), check("fail")])).toBe(2);
  });
});

describe("summaryLine", () => {
  it("reports all systems operational when everything is ok", () => {
    expect(summaryLine([check("ok"), check("ok")])).toBe("All systems operational");
  });

  it("pluralizes issue counts correctly", () => {
    expect(summaryLine([check("warn"), check("ok")])).toBe("1 issue found");
    expect(summaryLine([check("warn"), check("fail")])).toBe("2 issues found");
  });
});
