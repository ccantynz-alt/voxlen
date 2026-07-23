/**
 * UTBMS (Uniform Task-Based Management System) activity codes — the
 * A-series used on legal time entries and required by LEDES e-billing.
 */

export interface ActivityCode {
  code: string;
  label: string;
}

export const ACTIVITY_CODES: ActivityCode[] = [
  { code: "A101", label: "Plan and prepare for" },
  { code: "A102", label: "Research" },
  { code: "A103", label: "Draft/revise" },
  { code: "A104", label: "Review/analyze" },
  { code: "A105", label: "Communicate (in firm)" },
  { code: "A106", label: "Communicate (with client)" },
  { code: "A107", label: "Communicate (other outside counsel)" },
  { code: "A108", label: "Communicate (other external)" },
  { code: "A109", label: "Appear for/attend" },
  { code: "A110", label: "Manage data/files" },
  { code: "A111", label: "Other" },
  { code: "A112", label: "Billing" },
  { code: "A113", label: "Deposition preparation" },
  { code: "A114", label: "Travel" },
];
