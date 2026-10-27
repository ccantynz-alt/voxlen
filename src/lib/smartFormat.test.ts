import { describe, it, expect } from "vitest";
import { applySmartFormat } from "./smartFormat";

describe("applySmartFormat", () => {
  describe("emails", () => {
    it("converts 'name at host dot tld' to an email", () => {
      expect(applySmartFormat("send to alice at example dot com today")).toBe(
        "send to alice@example.com today"
      );
    });

    it("handles multi-segment domains", () => {
      expect(
        applySmartFormat("hello bob at mail dot example dot co dot uk")
      ).toBe("hello bob@mail.example.co.uk");
    });

    it("leaves standalone 'at' alone when not email-shaped", () => {
      expect(applySmartFormat("meet at the office")).toBe(
        "meet at the office"
      );
    });
  });

  describe("urls", () => {
    it("collapses 'w w w' to 'www' and joins 'dot' separators", () => {
      expect(applySmartFormat("visit w w w dot voxlen dot ai")).toBe(
        "visit www.voxlen.ai"
      );
    });

    it("expands spoken scheme", () => {
      expect(
        applySmartFormat("go to https colon slash slash voxlen dot ai")
      ).toBe("go to https://voxlen.ai");
    });
  });

  describe("social", () => {
    it("expands 'hashtag foo' to '#foo'", () => {
      expect(applySmartFormat("tag as hashtag productivity please")).toBe(
        "tag as #productivity please"
      );
    });

    it("expands 'at username alice' to '@alice'", () => {
      expect(applySmartFormat("message at username alice now")).toBe(
        "message @alice now"
      );
    });
  });

  describe("digit runs", () => {
    it("collapses a run of spoken digits into a numeric block", () => {
      expect(applySmartFormat("reference two one three four five")).toBe(
        "reference 21345"
      );
    });

    it("leaves short runs alone (< 3 digits)", () => {
      expect(applySmartFormat("see page two")).toBe("see page two");
    });

    it("treats 'oh' as zero inside digit runs", () => {
      expect(applySmartFormat("dial oh two one five nine")).toBe(
        "dial 02159"
      );
    });
  });

  describe("markdown leaders", () => {
    it("turns 'heading one' into '# '", () => {
      expect(applySmartFormat("heading one introduction")).toBe(
        "# introduction"
      );
    });

    it("turns 'heading two' into '## '", () => {
      expect(applySmartFormat("heading two overview")).toBe("## overview");
    });

    it("turns 'bullet point' into '- '", () => {
      expect(applySmartFormat("bullet point first item")).toBe(
        "- first item"
      );
    });

    it("turns 'block quote' into '> '", () => {
      expect(applySmartFormat("block quote this is important")).toBe(
        "> this is important"
      );
    });
  });

  describe("inline markdown wrappers", () => {
    it("wraps 'bold ... end bold' in **", () => {
      expect(applySmartFormat("this is bold critical end bold point")).toBe(
        "this is **critical** point"
      );
    });

    it("wraps 'italic ... end italic' in *", () => {
      expect(applySmartFormat("italic emphasis end italic here")).toBe(
        "*emphasis* here"
      );
    });

    it("wraps 'code ... end code' in backticks", () => {
      expect(applySmartFormat("run code npm test end code now")).toBe(
        "run `npm test` now"
      );
    });
  });

  describe("options", () => {
    it("can disable individual transforms", () => {
      expect(
        applySmartFormat("alice at example dot com", { emails: false })
      ).toContain("at example");
    });
  });

  describe("legal phrases", () => {
    it("preserves inter alia", () => {
      expect(applySmartFormat("the contract inter alia requires notice", { legalPhrases: true })).toContain("inter alia");
    });

    it("formats contra proferentem", () => {
      expect(applySmartFormat("the rule of contra proferentem applies", { legalPhrases: true })).toContain("contra proferentem");
    });

    it("formats force majeure", () => {
      expect(applySmartFormat("this is a force majeure event", { legalPhrases: true })).toContain("force majeure");
    });

    it("formats pari passu", () => {
      expect(applySmartFormat("paid pari passu with other creditors", { legalPhrases: true })).toContain("pari passu");
    });

    it("formats sine die", () => {
      expect(applySmartFormat("adjourned sine die pending resolution", { legalPhrases: true })).toContain("sine die");
    });
  });

  describe("accounting phrases", () => {
    it("uppercases EBITDA", () => {
      expect(applySmartFormat("the ebitda was strong this year", { legalPhrases: true })).toContain("EBITDA");
    });

    it("uppercases HMRC", () => {
      expect(applySmartFormat("submitted to hmrc on time", { legalPhrases: true })).toContain("HMRC");
    });

    it("formats P&L", () => {
      expect(applySmartFormat("reviewed the profit and loss statement", { legalPhrases: true })).toContain("P&L");
    });

    it("uppercases VAT", () => {
      expect(applySmartFormat("the vat return is due", { legalPhrases: true })).toContain("VAT");
    });

    it("uppercases GAAP", () => {
      expect(applySmartFormat("prepared under gaap standards", { legalPhrases: true })).toContain("GAAP");
    });
  });

  describe("legal currency", () => {
    it("converts spoken number words with a currency phrase (audit failure case 1)", () => {
      expect(
        applySmartFormat("the sum of fifty thousand pounds sterling shall be paid", {
          legalCurrency: true,
        })
      ).toBe("the sum of £50,000 shall be paid");
    });

    it("converts digit amounts with commas (audit failure case 2)", () => {
      expect(
        applySmartFormat("pay 50,000 pounds sterling now", { legalCurrency: true })
      ).toBe("pay £50,000 now");
    });

    it("converts plain dollars", () => {
      expect(applySmartFormat("50,000 dollars", { legalCurrency: true })).toBe(
        "$50,000"
      );
    });

    it("converts bare pounds and euros", () => {
      expect(applySmartFormat("owes two hundred pounds", { legalCurrency: true })).toBe(
        "owes £200"
      );
      expect(applySmartFormat("a fee of ninety euros", { legalCurrency: true })).toBe(
        "a fee of €90"
      );
    });

    it("handles hundred/thousand/million combos with 'and' connectors", () => {
      expect(
        applySmartFormat("one hundred and twenty five dollars", { legalCurrency: true })
      ).toBe("$125");
      expect(
        applySmartFormat("damages of 3.5 million euros", { legalCurrency: true })
      ).toBe("damages of €3,500,000");
      expect(
        applySmartFormat("two hundred and fifty thousand dollars", { legalCurrency: true })
      ).toBe("$250,000");
    });

    it("maps regional dollar variants to their symbols", () => {
      expect(
        applySmartFormat("ten thousand australian dollars", { legalCurrency: true })
      ).toBe("A$10,000");
      expect(
        applySmartFormat("five hundred new zealand dollars", { legalCurrency: true })
      ).toBe("NZ$500");
      expect(applySmartFormat("sixty canadian dollars", { legalCurrency: true })).toBe(
        "C$60"
      );
    });

    it("preserves decimal digit amounts", () => {
      expect(applySmartFormat("1,234.56 dollars", { legalCurrency: true })).toBe(
        "$1,234.56"
      );
    });

    it("leaves currency mentions without an amount unchanged", () => {
      expect(
        applySmartFormat("we discussed pounds sterling at length", { legalCurrency: true })
      ).toBe("we discussed pounds sterling at length");
      expect(
        applySmartFormat("the dollars were counted", { legalCurrency: true })
      ).toBe("the dollars were counted");
    });

    it("never swallows surrounding prose into the amount", () => {
      expect(
        applySmartFormat("the amount payable in euros is unknown", { legalCurrency: true })
      ).toBe("the amount payable in euros is unknown");
    });

    it("is off by default", () => {
      expect(applySmartFormat("fifty thousand pounds sterling")).toBe(
        "fifty thousand pounds sterling"
      );
    });
  });

  describe("edge cases", () => {
    it("returns empty string unchanged", () => {
      expect(applySmartFormat("")).toBe("");
    });

    it("is idempotent on already-formatted text", () => {
      const input = "email me at alice@example.com";
      expect(applySmartFormat(input)).toBe(input);
    });
  });
});
