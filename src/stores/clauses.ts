import { create } from "zustand";

export interface Clause {
  id: string;
  title: string;
  category: "contract" | "liability" | "ip" | "employment" | "gdpr" | "accounting" | "general";
  voiceTrigger: string; // what you say to insert it
  text: string;
  tags: string[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  voiceTrigger: string;
  sections: string[]; // section headings to auto-insert
  defaultStyle: string;
}

interface ClauseStore {
  clauses: Clause[];
  templates: DocumentTemplate[];
  recentlyUsed: string[]; // clause IDs
  customClauseIds: string[]; // IDs of user-added clauses
  addClause: (clause: Clause) => void;
  removeClause: (id: string) => void;
  updateClause: (id: string, updates: Partial<Omit<Clause, "id">>) => void;
  markUsed: (id: string) => void;
  findByTrigger: (text: string) => Clause | undefined;
  findTemplatByTrigger: (text: string) => DocumentTemplate | undefined;
}

const BUILT_IN_CLAUSES: Clause[] = [
  {
    id: "indemnity-standard",
    title: "Standard Indemnity",
    category: "liability",
    voiceTrigger: "insert indemnity clause",
    text: "Each party (the \"Indemnifying Party\") shall indemnify, defend, and hold harmless the other party and its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to the Indemnifying Party's breach of this Agreement or negligent or wilful acts or omissions.",
    tags: ["indemnity", "liability", "standard"],
  },
  {
    id: "limitation-liability",
    title: "Limitation of Liability",
    category: "liability",
    voiceTrigger: "insert limitation of liability",
    text: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, BUSINESS, OR GOODWILL, HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
    tags: ["limitation", "liability", "damages"],
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    category: "contract",
    voiceTrigger: "insert confidentiality clause",
    text: "Each party agrees to hold in strict confidence all Confidential Information of the other party and not to disclose such Confidential Information to any third party without the prior written consent of the disclosing party. This obligation shall survive termination of this Agreement for a period of five (5) years.",
    tags: ["confidentiality", "nda", "disclosure"],
  },
  {
    id: "governing-law-england",
    title: "Governing Law (England & Wales)",
    category: "contract",
    voiceTrigger: "insert governing law England",
    text: "This Agreement shall be governed by and construed in accordance with the laws of England and Wales. The parties irrevocably submit to the exclusive jurisdiction of the courts of England and Wales to settle any dispute arising out of or in connection with this Agreement.",
    tags: ["jurisdiction", "governing law", "england"],
  },
  {
    id: "governing-law-australia",
    title: "Governing Law (Australia)",
    category: "contract",
    voiceTrigger: "insert governing law Australia",
    text: "This Agreement is governed by the laws of New South Wales, Australia. The parties submit to the non-exclusive jurisdiction of the courts of New South Wales and any courts of appeal therefrom.",
    tags: ["jurisdiction", "governing law", "australia"],
  },
  {
    id: "governing-law-us",
    title: "Governing Law (New York)",
    category: "contract",
    voiceTrigger: "insert governing law New York",
    text: "This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions. Any disputes shall be resolved exclusively in the state or federal courts located in New York County, New York.",
    tags: ["jurisdiction", "governing law", "new york"],
  },
  {
    id: "force-majeure",
    title: "Force Majeure",
    category: "contract",
    voiceTrigger: "insert force majeure",
    text: "Neither party shall be liable for any failure or delay in performance under this Agreement to the extent caused by circumstances beyond such party's reasonable control, including acts of God, natural disasters, pandemic, war, terrorism, strikes, or governmental action, provided that the affected party promptly notifies the other party and uses reasonable efforts to mitigate the impact.",
    tags: ["force majeure", "performance", "delay"],
  },
  {
    id: "ip-assignment",
    title: "IP Assignment",
    category: "ip",
    voiceTrigger: "insert IP assignment",
    text: "The Contractor hereby irrevocably assigns to the Client all right, title, and interest in and to all Intellectual Property Rights in the Work Product, including all patents, copyrights, trade secrets, and other proprietary rights, whether now known or hereafter recognised in any jurisdiction worldwide.",
    tags: ["ip", "intellectual property", "assignment"],
  },
  {
    id: "gdpr-processing",
    title: "GDPR Data Processing",
    category: "gdpr",
    voiceTrigger: "insert GDPR data processing clause",
    text: "To the extent that either party processes personal data on behalf of the other in connection with this Agreement, it shall do so only in accordance with the other party's documented instructions and in compliance with the UK GDPR and Data Protection Act 2018. Each party shall implement appropriate technical and organisational measures to protect personal data against unauthorised or unlawful processing.",
    tags: ["gdpr", "data protection", "personal data"],
  },
  {
    id: "entire-agreement",
    title: "Entire Agreement",
    category: "general",
    voiceTrigger: "insert entire agreement",
    text: "This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior and contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written, between the parties.",
    tags: ["entire agreement", "merger", "integration"],
  },
  {
    id: "severability",
    title: "Severability",
    category: "general",
    voiceTrigger: "insert severability",
    text: "If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.",
    tags: ["severability", "validity"],
  },
  {
    id: "assignment-prohibition",
    title: "No Assignment",
    category: "contract",
    voiceTrigger: "insert no assignment clause",
    text: "Neither party may assign, transfer, delegate, or subcontract any of its rights or obligations under this Agreement without the prior written consent of the other party, which shall not be unreasonably withheld, conditioned, or delayed.",
    tags: ["assignment", "transfer"],
  },
  {
    id: "accounting-engagement",
    title: "Accounting Engagement Terms",
    category: "accounting",
    voiceTrigger: "insert engagement terms",
    text: "Our engagement is limited to the services described in this letter. We will not audit or verify the information you provide us and cannot be held responsible for the accuracy of financial statements or tax returns prepared on the basis of incomplete or inaccurate information supplied by you.",
    tags: ["accounting", "engagement", "disclaimer"],
  },
  {
    id: "accounting-liability-cap",
    title: "Accountant Liability Cap",
    category: "accounting",
    voiceTrigger: "insert accountant liability cap",
    text: "Our liability to you under or in connection with this engagement letter, whether in contract, tort (including negligence), breach of statutory duty, or otherwise, is limited to an amount equal to the fees paid by you to us in the twelve (12) months immediately preceding the event giving rise to the claim.",
    tags: ["accounting", "liability", "cap"],
  },
  {
    id: "without-prejudice",
    title: "Without Prejudice",
    category: "general",
    voiceTrigger: "insert without prejudice",
    text: "WITHOUT PREJUDICE AND SUBJECT TO CONTRACT",
    tags: ["without prejudice", "settlement", "negotiation"],
  },
  {
    id: "arbitration-clause",
    title: "Arbitration Clause",
    category: "contract",
    voiceTrigger: "insert arbitration clause",
    text: "Any dispute, controversy, or claim arising out of or relating to this Agreement, or the breach, termination, or invalidity thereof, shall be finally settled by arbitration in accordance with the rules of the relevant arbitration body in the governing jurisdiction. The arbitral tribunal shall consist of one arbitrator. The language of the arbitration shall be English. The decision of the arbitrator shall be final and binding on the parties.",
    tags: ["arbitration", "dispute resolution", "adr"],
  },
  {
    id: "dispute-resolution",
    title: "Dispute Resolution",
    category: "contract",
    voiceTrigger: "insert dispute resolution clause",
    text: "In the event of any dispute, controversy, or claim arising out of or relating to this Agreement, the parties shall first attempt in good faith to resolve the dispute through negotiation for a period of not less than 30 days. If the dispute cannot be resolved by negotiation, either party may refer the matter to mediation before resorting to litigation or arbitration.",
    tags: ["dispute resolution", "mediation", "negotiation"],
  },
  {
    id: "warranty-disclaimer",
    title: "Warranty Disclaimer",
    category: "liability",
    voiceTrigger: "insert warranty disclaimer",
    text: "EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, THE SERVICES AND ALL MATERIALS PROVIDED HEREUNDER ARE PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. EACH PARTY SPECIFICALLY DISCLAIMS ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
    tags: ["warranty", "disclaimer", "as is"],
  },
  {
    id: "governing-law-nz",
    title: "Governing Law (New Zealand)",
    category: "contract",
    voiceTrigger: "insert governing law new zealand",
    text: "This Agreement shall be governed by and construed in accordance with the laws of New Zealand. The parties submit to the exclusive jurisdiction of the courts of New Zealand.",
    tags: ["governing law", "new zealand", "jurisdiction"],
  },
  {
    id: "governing-law-canada",
    title: "Governing Law (Ontario, Canada)",
    category: "contract",
    voiceTrigger: "insert governing law ontario",
    text: "This Agreement shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein. The parties submit to the exclusive jurisdiction of the courts of Ontario.",
    tags: ["governing law", "canada", "ontario", "jurisdiction"],
  },
  {
    id: "payment-terms",
    title: "Payment Terms",
    category: "contract",
    voiceTrigger: "insert payment terms",
    text: "All invoices are due and payable within thirty (30) days of the invoice date. Any amounts not paid within thirty (30) days of the due date shall bear interest at the rate of 1.5% per month (18% per annum), or the maximum rate permitted by applicable law, whichever is lower, from the due date until the date of payment.",
    tags: ["payment", "invoice", "interest"],
  },
  {
    id: "termination-for-cause",
    title: "Termination for Cause",
    category: "contract",
    voiceTrigger: "insert termination for cause",
    text: "Either party may terminate this Agreement immediately upon written notice if the other party: (a) materially breaches this Agreement and fails to cure such breach within thirty (30) days after receiving written notice of the breach; (b) becomes insolvent, makes an assignment for the benefit of creditors, or becomes subject to bankruptcy, receivership, or similar proceedings; or (c) ceases to carry on business.",
    tags: ["termination", "breach", "cause"],
  },
];

const BUILT_IN_TEMPLATES: DocumentTemplate[] = [
  {
    id: "service-agreement",
    name: "Service Agreement",
    voiceTrigger: "new service agreement",
    sections: ["Parties", "Services", "Fees and Payment", "Term and Termination", "Confidentiality", "Intellectual Property", "Limitation of Liability", "Governing Law", "General"],
    defaultStyle: "professional",
  },
  {
    id: "nda",
    name: "Non-Disclosure Agreement",
    voiceTrigger: "new NDA",
    sections: ["Parties", "Definition of Confidential Information", "Obligations of Confidentiality", "Permitted Disclosures", "Term", "Return of Information", "Governing Law"],
    defaultStyle: "professional",
  },
  {
    id: "engagement-letter",
    name: "Engagement Letter",
    voiceTrigger: "new engagement letter",
    sections: ["Introduction", "Scope of Services", "Our Responsibilities", "Your Responsibilities", "Fees", "Confidentiality", "Limitation of Liability", "Acceptance"],
    defaultStyle: "professional",
  },
  {
    id: "attendance-note",
    name: "Attendance Note",
    voiceTrigger: "new attendance note",
    sections: ["Date and Time", "Parties Present", "Matter", "Discussion", "Action Points", "Next Steps"],
    defaultStyle: "professional",
  },
  {
    id: "legal-memo",
    name: "Legal Memorandum",
    voiceTrigger: "new legal memo",
    sections: ["To", "From", "Date", "Re", "Summary", "Background", "Analysis", "Conclusion", "Recommendations"],
    defaultStyle: "academic",
  },
];

export const useClauseStore = create<ClauseStore>((set, get) => ({
  clauses: BUILT_IN_CLAUSES,
  templates: BUILT_IN_TEMPLATES,
  recentlyUsed: [],
  customClauseIds: [],

  addClause: (clause) => {
    set((state) => ({
      clauses: [...state.clauses, clause],
      customClauseIds: [...state.customClauseIds, clause.id],
    }));
    persistCustomClauses(get());
  },

  removeClause: (id) => {
    set((state) => ({
      clauses: state.clauses.filter((c) => c.id !== id),
      customClauseIds: state.customClauseIds.filter((x) => x !== id),
    }));
    persistCustomClauses(get());
  },

  updateClause: (id, updates) => {
    set((state) => ({
      clauses: state.clauses.map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
    persistCustomClauses(get());
  },

  markUsed: (id) => {
    set((state) => ({
      recentlyUsed: [id, ...state.recentlyUsed.filter((x) => x !== id)].slice(0, 10),
    }));
    persistCustomClauses(get());
  },

  findByTrigger: (text: string) => {
    const lower = text.toLowerCase();
    return get().clauses.find(
      (c) =>
        lower.includes(c.voiceTrigger.toLowerCase()) ||
        lower === c.voiceTrigger.toLowerCase()
    );
  },

  findTemplatByTrigger: (text: string) => {
    const lower = text.toLowerCase();
    return get().templates.find(
      (t) =>
        lower.includes(t.voiceTrigger.toLowerCase()) ||
        lower === t.voiceTrigger.toLowerCase()
    );
  },
}));

function persistCustomClauses(state: ClauseStore): void {
  const customClauses = state.clauses.filter((c) => state.customClauseIds.includes(c.id));
  (async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("clauses.json");
      await store.set("custom_clauses", customClauses);
      await store.save();
    } catch {
      try {
        localStorage.setItem("voxlen_custom_clauses", JSON.stringify(customClauses));
      } catch {
        // ignore
      }
    }
  })();
}

export async function loadCustomClauses(): Promise<void> {
  try {
    let saved: Clause[] | null = null;
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("clauses.json");
      saved = (await store.get<Clause[]>("custom_clauses")) ?? null;
    } catch {
      const raw = localStorage.getItem("voxlen_custom_clauses");
      if (raw) saved = JSON.parse(raw) as Clause[];
    }
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const ids = saved.map((c) => c.id);
      useClauseStore.setState((state) => ({
        clauses: [
          ...state.clauses.filter((c) => !ids.includes(c.id)),
          ...saved!,
        ],
        customClauseIds: ids,
      }));
    }
  } catch {
    // ignore
  }
}
