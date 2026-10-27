import { describe, it, expect } from "vitest";
import { formatCitations, type Jurisdiction } from "./citations";
import { applySmartFormat } from "./smartFormat";

const us = (t: string) => formatCitations(t, "us");
const uk = (t: string) => formatCitations(t, "uk");
const au = (t: string) => formatCitations(t, "australia");
const nz = (t: string) => formatCitations(t, "nz");
const ca = (t: string) => formatCitations(t, "canada");
const global = (t: string) => formatCitations(t, "global");

describe("formatCitations", () => {
  describe("case names — US (Bluebook)", () => {
    it("formats 'smith v jones'", () => {
      expect(us("smith v jones")).toBe("Smith v. Jones");
    });

    it("formats 'smith vee jones'", () => {
      expect(us("smith vee jones")).toBe("Smith v. Jones");
    });

    it("formats 'smith versus jones' at sentence start", () => {
      expect(us("smith versus jones")).toBe("Smith v. Jones");
    });

    it("formats 'smith vs jones'", () => {
      expect(us("smith vs jones")).toBe("Smith v. Jones");
    });

    it("formats a case name mid-sentence with bare v", () => {
      expect(us("the court held roe v wade controls here")).toBe(
        "the court held Roe v. Wade controls here"
      );
    });

    it("formats versus after a citation cue word", () => {
      expect(us("in smith versus jones the court held")).toBe(
        "in Smith v. Jones the court held"
      );
    });

    it("formats versus after sentence punctuation", () => {
      expect(us("we rely on precedent. smith versus jones is on point")).toBe(
        "we rely on precedent. Smith v. Jones is on point"
      );
    });

    it("handles multi-word capitalized parties", () => {
      expect(us("Planned Parenthood versus Casey")).toBe(
        "Planned Parenthood v. Casey"
      );
    });

    it("handles capitalized parties with internal connectors", () => {
      expect(us("see Board of Education v Rowley")).toBe(
        "see Board of Education v. Rowley"
      );
    });

    it("special-cases lowercase 'united states'", () => {
      expect(us("united states v nixon")).toBe("United States v. Nixon");
      expect(us("nixon v united states")).toBe("Nixon v. United States");
    });

    it("keeps single-letter capitalized parties (anonymized cases)", () => {
      expect(us("J v K")).toBe("J v. K");
    });
  });

  describe("case names — UK/AU/NZ/CA (no period)", () => {
    it("UK: 'smith v jones' → 'Smith v Jones'", () => {
      expect(uk("smith v jones")).toBe("Smith v Jones");
    });

    it("Australia", () => {
      expect(au("smith versus jones")).toBe("Smith v Jones");
    });

    it("New Zealand", () => {
      expect(nz("smith vee jones")).toBe("Smith v Jones");
    });

    it("Canada (McGill style, no period)", () => {
      expect(ca("smith v jones")).toBe("Smith v Jones");
    });

    it("global default uses the international 'v' (no period)", () => {
      expect(global("smith v jones")).toBe("Smith v Jones");
    });

    it("converts Bluebook 'v.' to OSCOLA 'v' for UK users", () => {
      expect(uk("Smith v. Jones")).toBe("Smith v Jones");
    });

    it("converts OSCOLA 'v' to Bluebook 'v.' for US users", () => {
      expect(us("Smith v Jones")).toBe("Smith v. Jones");
    });
  });

  describe("case names — conservatism (prose is never rewritten)", () => {
    it("leaves 'versus' comparisons in mid-sentence prose alone", () => {
      const t = "we compared speed versus accuracy in the benchmark";
      expect(us(t)).toBe(t);
      expect(uk(t)).toBe(t);
    });

    it("leaves 'the risk versus the reward' alone", () => {
      const t = "I weighed the risk versus the reward";
      expect(us(t)).toBe(t);
    });

    it("leaves 'versus' with stop-word parties alone even at sentence start", () => {
      const t = "this versus that";
      expect(us(t)).toBe(t);
    });

    it("does not treat a capital roman-numeral V as a connector", () => {
      expect(us("Title V funding was approved")).toBe(
        "Title V funding was approved"
      );
      expect(us("Article V of the constitution")).toBe(
        "Article V of the constitution"
      );
    });

    it("does not fire on structural words before a lowercase v", () => {
      const t = "see chapter v for details";
      expect(us(t)).toBe(t);
    });

    it("does not fire when the connector has no right-hand party", () => {
      const t = "the score was smith v";
      expect(us(t)).toBe(t);
    });

    it("does not fire across punctuation", () => {
      const t = "smith, v jones";
      expect(us(t)).toBe(t);
    });
  });

  describe("US reporter citations", () => {
    it("542 us 241 → 542 U.S. 241", () => {
      expect(us("542 us 241")).toBe("542 U.S. 241");
      expect(us("542 US 241")).toBe("542 U.S. 241");
      expect(us("542 u s 241")).toBe("542 U.S. 241");
    });

    it("125 s ct 2738 → 125 S. Ct. 2738", () => {
      expect(us("125 s ct 2738")).toBe("125 S. Ct. 2738");
    });

    it("F.3d with numeric and spoken series", () => {
      expect(us("891 f 3d 1093")).toBe("891 F.3d 1093");
      expect(us("891 f third 1093")).toBe("891 F.3d 1093");
      expect(us("100 f 2d 200")).toBe("100 F.2d 200");
      expect(us("15 f fourth 30")).toBe("15 F.4th 30");
    });

    it("456 f supp 3d 789 → 456 F. Supp. 3d 789", () => {
      expect(us("456 f supp 3d 789")).toBe("456 F. Supp. 3d 789");
      expect(us("456 f supp 789")).toBe("456 F. Supp. 789");
    });

    it("regional reporters", () => {
      expect(us("300 p 3d 100")).toBe("300 P.3d 100");
      expect(us("12 ne 3d 44")).toBe("12 N.E.3d 44");
      expect(us("12 n e 3d 44")).toBe("12 N.E.3d 44");
      expect(us("77 sw 3d 88")).toBe("77 S.W.3d 88");
      expect(us("5 a 3d 9")).toBe("5 A.3d 9");
      expect(us("140 so 3d 22")).toBe("140 So. 3d 22");
      expect(us("260 se 2d 84")).toBe("260 S.E.2d 84");
      expect(us("480 nw 2d 105")).toBe("480 N.W.2d 105");
    });

    it("reporters are self-identifying — formatted in any jurisdiction", () => {
      expect(uk("542 us 241")).toBe("542 U.S. 241");
    });

    it("full dictated citation", () => {
      expect(us("rasul v bush 542 us 241")).toBe("Rasul v. Bush 542 U.S. 241");
    });

    it("does NOT touch '542 US soldiers' (no trailing page number)", () => {
      const t = "we saw 542 US soldiers";
      expect(us(t)).toBe(t);
    });

    it("does NOT touch 'call us 24 7' (no leading volume number)", () => {
      const t = "call us 24 7";
      expect(us(t)).toBe(t);
    });

    it("does NOT touch a partial pattern like '542 us'", () => {
      const t = "the case reported at 542 us";
      expect(us(t)).toBe(t);
    });

    it("does NOT invent a series for a bare 'f'", () => {
      const t = "891 f 1093";
      expect(us(t)).toBe(t);
    });
  });

  describe("pincites", () => {
    it("'at page N' after a citation → ', N'", () => {
      expect(us("542 us 241 at page 245")).toBe("542 U.S. 241, 245");
    });

    it("'at N' after a citation → ', N'", () => {
      expect(us("542 us 241 at 245")).toBe("542 U.S. 241, 245");
    });

    it("works with other reporters", () => {
      expect(us("125 s ct 2738 at 2740")).toBe("125 S. Ct. 2738, 2740");
      expect(us("891 f 3d 1093 at page 1097")).toBe("891 F.3d 1093, 1097");
    });

    it("leaves 'at N' alone when no citation precedes it", () => {
      const t = "we met at 245 main street";
      expect(us(t)).toBe(t);
      expect(us("the hearing is at page 12 of the bundle")).toBe(
        "the hearing is at page 12 of the bundle"
      );
    });
  });

  describe("statutes", () => {
    it("42 usc section 1983 → 42 U.S.C. § 1983", () => {
      expect(us("42 usc section 1983")).toBe("42 U.S.C. § 1983");
    });

    it("42 usc 1983 → 42 U.S.C. § 1983", () => {
      expect(us("42 usc 1983")).toBe("42 U.S.C. § 1983");
      expect(us("42 u s c 1983")).toBe("42 U.S.C. § 1983");
    });

    it("handles subsections", () => {
      expect(us("11 usc section 362(a)")).toBe("11 U.S.C. § 362(a)");
    });

    it("U.S.C. is self-identifying — formatted in any jurisdiction", () => {
      expect(uk("42 usc 1983")).toBe("42 U.S.C. § 1983");
    });

    it("title 11 of the united states code → 11 U.S.C.", () => {
      expect(us("title 11 of the united states code")).toBe("11 U.S.C.");
    });

    it("'section 12 of the act': § for US, s for UK/AU/NZ/CA", () => {
      expect(us("section 12 of the act")).toBe("§ 12 of the act");
      expect(uk("section 12 of the act")).toBe("s 12 of the act");
      expect(au("section 12 of the act")).toBe("s 12 of the act");
      expect(nz("section 12 of the act")).toBe("s 12 of the act");
      expect(ca("section 12 of the act")).toBe("s 12 of the act");
    });

    it("'section 12 of the act' is left untouched for global (no assumable style)", () => {
      const t = "section 12 of the act";
      expect(global(t)).toBe(t);
    });

    it("leaves 'section' alone without clear statutory context", () => {
      const t = "the section 12 team met today";
      expect(us(t)).toBe(t);
      expect(uk("please review section 12 carefully")).toBe(
        "please review section 12 carefully"
      );
    });

    it("UK named act: 'section 6 of the human rights act 1998' → OSCOLA order", () => {
      expect(uk("section 6 of the human rights act 1998")).toBe(
        "Human Rights Act 1998, s 6"
      );
    });

    it("NZ named act uses the comma form", () => {
      expect(nz("section 9 of the fair trading act 1986")).toBe(
        "Fair Trading Act 1986, s 9"
      );
    });

    it("AU named act uses AGLC (no comma)", () => {
      expect(au("section 18 of the competition and consumer act 2010")).toBe(
        "Competition and Consumer Act 2010 s 18"
      );
    });

    it("US users' named-act dictation is left untouched (no Bluebook reorder guess)", () => {
      const t = "section 6 of the human rights act 1998";
      expect(us(t)).toBe(t.replace("section", "section")); // unchanged
      expect(us(t)).toBe(t);
    });
  });

  describe("neutral citations (UK/AU/NZ)", () => {
    it("2020 uksc 1 → [2020] UKSC 1", () => {
      expect(uk("2020 uksc 1")).toBe("[2020] UKSC 1");
    });

    it("2019 ewca civ 152 → [2019] EWCA Civ 152", () => {
      expect(uk("2019 ewca civ 152")).toBe("[2019] EWCA Civ 152");
    });

    it("2021 hca 12 → [2021] HCA 12", () => {
      expect(au("2021 hca 12")).toBe("[2021] HCA 12");
    });

    it("2022 nzsc 5 → [2022] NZSC 5", () => {
      expect(nz("2022 nzsc 5")).toBe("[2022] NZSC 5");
    });

    it("year-bracket reporters with a volume", () => {
      expect(uk("2020 2 ac 391")).toBe("[2020] 2 AC 391");
      expect(uk("2019 1 wlr 82")).toBe("[2019] 1 WLR 82");
      expect(uk("2018 2 all er 100")).toBe("[2018] 2 All ER 100");
    });

    it("year-bracket reporters without a volume", () => {
      expect(uk("1932 ac 562")).toBe("[1932] AC 562");
    });

    it("leaves plain years and numbers alone", () => {
      const t = "revenue in 2019 was 152 million";
      expect(uk(t)).toBe(t);
    });
  });

  describe("spoken symbols", () => {
    it("'section symbol' → §", () => {
      expect(us("see section symbol 12")).toBe("see § 12");
      expect(uk("see section symbol 12")).toBe("see § 12");
    });

    it("'paragraph symbol' → ¶", () => {
      expect(us("paragraph symbol 4 of the affidavit")).toBe(
        "¶ 4 of the affidavit"
      );
    });
  });

  describe("idempotency — formatting formatted text changes nothing", () => {
    const jurisdictions: Jurisdiction[] = ["us", "uk", "australia", "nz", "canada", "global"];
    const inputs = [
      "smith v jones",
      "smith versus jones",
      "united states v nixon",
      "542 us 241 at page 245",
      "125 s ct 2738",
      "891 f third 1093",
      "456 f supp 3d 789",
      "140 so 3d 22",
      "42 usc section 1983",
      "title 11 of the united states code",
      "section 6 of the human rights act 1998",
      "section 12 of the act",
      "2020 uksc 1",
      "2019 ewca civ 152",
      "2020 2 ac 391",
      "section symbol 12 and paragraph symbol 4",
      "we compared speed versus accuracy",
      "we saw 542 US soldiers",
    ];

    for (const j of jurisdictions) {
      it(`f(f(x)) === f(x) for jurisdiction "${j}"`, () => {
        for (const input of inputs) {
          const once = formatCitations(input, j);
          expect(formatCitations(once, j)).toBe(once);
        }
      });
    }

    it("already-formatted canonical citations pass through verbatim", () => {
      const formatted = [
        "Smith v. Jones, 542 U.S. 241, 245",
        "891 F.3d 1093",
        "456 F. Supp. 3d 789",
        "42 U.S.C. § 1983",
        "[2020] UKSC 1",
        "[2019] EWCA Civ 152",
        "[2020] 2 AC 391",
        "Human Rights Act 1998, s 6",
      ];
      for (const t of formatted) {
        expect(us(t)).toBe(t);
      }
      expect(uk("[2020] UKSC 1")).toBe("[2020] UKSC 1");
      expect(uk("Human Rights Act 1998, s 6")).toBe("Human Rights Act 1998, s 6");
    });
  });

  describe("no-op safety", () => {
    const untouched = [
      "please draft the engagement letter for tomorrow",
      "the meeting ran from two to four",
      "we saw 542 US soldiers",
      "call us 24 7",
      "the section on damages needs work",
      "he scored 42 points in the second half",
      "",
    ];
    for (const t of untouched) {
      it(`leaves ${JSON.stringify(t)} untouched`, () => {
        expect(us(t)).toBe(t);
        expect(uk(t)).toBe(t);
        expect(global(t)).toBe(t);
      });
    }
  });

  describe("integration with applySmartFormat", () => {
    it("'542 US 241' is citation-formatted, never currency-mangled", () => {
      expect(
        applySmartFormat("542 US 241", {
          legalCitations: true,
          legalCurrency: true,
          jurisdiction: "us",
        })
      ).toBe("542 U.S. 241");
    });

    it("citations and currency compose in one pass", () => {
      expect(
        applySmartFormat("smith v jones claims fifty thousand dollars", {
          legalCitations: true,
          legalCurrency: true,
          legalPhrases: true,
          jurisdiction: "us",
        })
      ).toBe("Smith v. Jones claims $50,000");
    });

    it("UK pipeline produces OSCOLA output", () => {
      expect(
        applySmartFormat("smith versus jones 2020 uksc 1", {
          legalCitations: true,
          legalCurrency: true,
          legalPhrases: true,
          jurisdiction: "uk",
        })
      ).toBe("Smith v Jones [2020] UKSC 1");
    });

    it("prose 'versus' survives the full legal pipeline untouched", () => {
      expect(
        applySmartFormat("we weighed cost versus benefit today", {
          legalCitations: true,
          legalCurrency: true,
          legalPhrases: true,
          jurisdiction: "uk",
        })
      ).toBe("we weighed cost versus benefit today");
    });

    it("citations are off by default (non-legal mode)", () => {
      expect(applySmartFormat("smith v jones")).toBe("smith v jones");
      expect(applySmartFormat("542 us 241")).toBe("542 us 241");
    });
  });
});
