import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Apple,
  Monitor,
  Shield,
  Zap,
  LogOut,
  Copy,
  Check,
  Crown,
  ExternalLink,
  Key,
  RefreshCw,
  UserPlus,
  Activity,
  Users,
  Tag,
  BarChart2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
} from "lucide-react";
import type { GoogleUser } from "../lib/auth";

const ADMIN_EMAIL = "ccantynz@gmail.com";
const GH_API_LATEST = "https://api.github.com/repos/ccantynz-alt/voxlen/releases/latest";
const GH_API_RELEASES = "https://api.github.com/repos/ccantynz-alt/voxlen/releases";
const GH_RELEASES_PAGE = "https://github.com/ccantynz-alt/voxlen/releases/latest";
const VOXLEN_BASE = "https://voxlen.ai";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}

interface GHRelease {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: ReleaseAsset[];
  prerelease: boolean;
  draft: boolean;
}

interface WaitlistEntry {
  email: string;
  platform: string;
  date: string;
  ip?: string | null;
}

interface HealthData {
  ok: boolean;
  env: Record<string, boolean>;
  timestamp: string;
}

interface EndpointStatus {
  url: string;
  label: string;
  status: "ok" | "error" | "loading";
  responseMs: number | null;
  code: number | null;
}

// ─── Platform definitions ────────────────────────────────────────────────────

const PLATFORMS = [
  {
    key: "mac-arm",
    label: "macOS (Apple Silicon)",
    sub: "M1 / M2 / M3 / M4",
    icon: "apple" as const,
    regex: /aarch64.*\.dmg$|arm64.*\.dmg$/i,
  },
  {
    key: "mac-intel",
    label: "macOS (Intel)",
    sub: "x86_64",
    icon: "apple" as const,
    regex: /x64.*\.dmg$|x86_64.*\.dmg$/i,
  },
  {
    key: "windows",
    label: "Windows",
    sub: "Windows 10 / 11 (x64)",
    icon: "monitor" as const,
    regex: /\.msi$|setup.*\.exe$/i,
  },
  {
    key: "linux",
    label: "Linux",
    sub: "AppImage (x86_64)",
    icon: "monitor" as const,
    regex: /\.AppImage$/i,
  },
];

// ─── Tiny helpers ────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
}

function fmtBytes(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ─── API key components ──────────────────────────────────────────────────────

interface GeneratedKey {
  token: string;
  expiresDate: string;
  plan: string;
  email: string;
}

function ConnectDesktopApp({ accessToken, onKeyReady }: { accessToken: string; onKeyReady?: (token: string) => void }) {
  const [apiKey, setApiKey] = useState<GeneratedKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setRegenerating(true);
    setGenError(null);
    try {
      const r = await fetch(`${VOXLEN_BASE}/api/generate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        const json = (await r.json()) as GeneratedKey;
        setApiKey(json);
        onKeyReady?.(json.token);
      } else {
        setGenError(`Failed to generate key (${r.status}). Please try again.`);
      }
    } catch {
      setGenError("Network error. Check your connection and try again.");
    }
    setLoading(false);
    setRegenerating(false);
  }, [accessToken]);

  useEffect(() => { generate(); }, [generate]);

  const displayKey = apiKey?.token ?? accessToken;
  const expiresMsg = apiKey
    ? `Valid until ${apiKey.expiresDate} · ${apiKey.plan} plan`
    : "Session token — expires in ~1 hour. Generate a key above for a persistent one.";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-brand-400" />
          <h2 className="font-bold">Your API Key</h2>
        </div>
        <button
          onClick={generate}
          disabled={regenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      <p className="text-zinc-500 text-sm mb-4">
        Paste this into <strong className="text-zinc-300">Voxlen Settings → Voxlen Account</strong>. All AI and transcription included — no other keys needed.
      </p>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-zinc-400">
        <span className="flex-1 truncate">{loading ? "Generating your key…" : displayKey}</span>
        {!loading && <CopyButton value={displayKey} />}
      </div>
      {genError && <p className="text-[11px] text-red-400 mt-2">{genError}</p>}
      {!genError && <p className="text-[11px] text-zinc-600 mt-2">{expiresMsg}</p>}
    </div>
  );
}

function AdminKeyIssuer({
  accessToken,
  onIssued,
}: {
  accessToken: string;
  onIssued: (key: GeneratedKey) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("pro");
  const [ttlDays, setTtlDays] = useState("30");
  const [result, setResult] = useState<GeneratedKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const issue = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(`${VOXLEN_BASE}/api/generate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: email, targetName: name || email, plan, ttlDays: parseInt(ttlDays) }),
      });
      const json = (await r.json()) as GeneratedKey & { error?: string };
      if (!r.ok) {
        setError(json.error ?? "Failed");
      } else {
        setResult(json);
        onIssued(json);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Email *</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="free_trial">Free Trial</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="professional">Professional</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Valid for (days)</label>
          <input
            type="number"
            value={ttlDays}
            onChange={(e) => setTtlDays(e.target.value)}
            min="1"
            max="3650"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>
      <button
        onClick={issue}
        disabled={loading || !email}
        className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Key"}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {result && (
        <div className="mt-2 p-3 rounded-xl bg-black/30 border border-amber-500/20">
          <p className="text-xs text-zinc-400 mb-1">
            Key for <strong className="text-white">{result.email}</strong> · {result.plan} · expires{" "}
            {result.expiresDate}
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
            <span className="flex-1 truncate">{result.token}</span>
            <CopyButton value={result.token} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin tabs ──────────────────────────────────────────────────────────────

type AdminTab = "overview" | "waitlist" | "keys" | "releases" | "diagnostics";

// Overview tab ----------------------------------------------------------------

function OverviewTab({ accessToken }: { accessToken: string }) {
  const [latestRelease, setLatestRelease] = useState<GHRelease | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(true);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { url: `${VOXLEN_BASE}/api/me`, label: "/api/me", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/grammar`, label: "/api/grammar", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/generate-key`, label: "/api/generate-key", status: "loading", responseMs: null, code: null },
  ]);

  useEffect(() => {
    fetch(GH_API_LATEST, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: GHRelease) => setLatestRelease(json))
      .catch(() => setLatestRelease(null))
      .finally(() => setReleaseLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${VOXLEN_BASE}/api/admin/waitlist`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { total?: number }) => setWaitlistCount(json.total ?? 0))
      .catch(() => setWaitlistCount(null))
      .finally(() => setWaitlistLoading(false));
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    const pingEndpoints = [
      { url: `${VOXLEN_BASE}/api/me`, label: "/api/me", method: "GET" },
      { url: `${VOXLEN_BASE}/api/grammar`, label: "/api/grammar", method: "POST" },
      { url: `${VOXLEN_BASE}/api/generate-key`, label: "/api/generate-key", method: "POST" },
    ];
    Promise.all(
      pingEndpoints.map(async (ep) => {
        const start = Date.now();
        try {
          const r = await fetch(ep.url, {
            method: ep.method,
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: ep.method === "POST" ? JSON.stringify({}) : undefined,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          const ms = Date.now() - start;
          setEndpoints((prev) =>
            prev.map((e) =>
              e.label === ep.label
                ? { ...e, status: r.status < 500 ? "ok" : "error", responseMs: ms, code: r.status }
                : e
            )
          );
        } catch (err) {
          if (controller.signal.aborted) return;
          const ms = Date.now() - start;
          setEndpoints((prev) =>
            prev.map((e) =>
              e.label === ep.label ? { ...e, status: "error", responseMs: ms, code: null } : e
            )
          );
        }
      })
    );
    return () => controller.abort();
  }, [accessToken]);

  const totalDownloads = latestRelease?.assets.reduce((s, a) => s + (a.download_count ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Latest Release"
          value={releaseLoading ? "…" : latestRelease?.tag_name ?? "None"}
          sub={latestRelease ? fmtDate(latestRelease.published_at) : "No release yet"}
          icon={<Tag className="h-5 w-5 text-blue-400" />}
          color="blue"
        />
        <MetricCard
          label="Total Downloads"
          value={releaseLoading ? "…" : fmt(totalDownloads)}
          sub="Latest release"
          icon={<Download className="h-5 w-5 text-green-400" />}
          color="green"
        />
        <MetricCard
          label="Waitlist"
          value={waitlistLoading ? "…" : waitlistCount !== null ? fmt(waitlistCount) : "—"}
          sub="Signups"
          icon={<Users className="h-5 w-5 text-purple-400" />}
          color="purple"
        />
      </div>

      {/* Asset breakdown */}
      {latestRelease && latestRelease.assets.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Asset Downloads — {latestRelease.tag_name}</h3>
          <div className="space-y-2">
            {latestRelease.assets.map((asset) => (
              <div key={asset.name} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                <span className="text-zinc-400 font-mono text-xs truncate flex-1 mr-4">{asset.name}</span>
                <span className="text-zinc-500 text-xs mr-4">{fmtBytes(asset.size)}</span>
                <span className="text-zinc-300 font-medium tabular-nums">{fmt(asset.download_count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Endpoint status */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Endpoint Status</h3>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointRow key={ep.label} ep={ep} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "amber";
}) {
  const borders: Record<string, string> = {
    blue: "border-blue-500/20",
    green: "border-green-500/20",
    purple: "border-purple-500/20",
    amber: "border-amber-500/20",
  };
  const bgs: Record<string, string> = {
    blue: "bg-blue-500/5",
    green: "bg-green-500/5",
    purple: "bg-purple-500/5",
    amber: "bg-amber-500/5",
  };
  return (
    <div className={`rounded-2xl border ${borders[color]} ${bgs[color]} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500 uppercase tracking-widest font-medium">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function EndpointRow({ ep }: { ep: EndpointStatus }) {
  const statusIcon =
    ep.status === "loading" ? (
      <Clock className="h-4 w-4 text-zinc-500 animate-pulse" />
    ) : ep.status === "ok" ? (
      <CheckCircle className="h-4 w-4 text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-red-400" />
    );

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
      {statusIcon}
      <span className="font-mono text-xs text-zinc-300 flex-1">{ep.label}</span>
      {ep.code !== null && (
        <span className={`text-xs font-medium ${ep.code < 500 ? "text-green-400" : "text-red-400"}`}>
          {ep.code}
        </span>
      )}
      {ep.responseMs !== null && (
        <span className="text-xs text-zinc-500 tabular-nums">{ep.responseMs}ms</span>
      )}
    </div>
  );
}

// Waitlist tab ----------------------------------------------------------------

function WaitlistTab({ accessToken }: { accessToken: string }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${VOXLEN_BASE}/api/admin/waitlist`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await r.json()) as { entries?: WaitlistEntry[]; error?: string };
      if (!r.ok) {
        setError(json.error ?? "Failed to load waitlist");
      } else {
        setEntries(json.entries ?? []);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const header = "email,platform,date\n";
    const rows = entries.map((e) => `${e.email},${e.platform},${e.date}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxlen-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Waitlist</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{entries.length} signups</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Loading waitlist…</div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          {error ? "Could not load entries" : "No signups yet"}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_140px] text-[11px] text-zinc-500 uppercase tracking-widest font-medium px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
            <span>Email</span>
            <span>Platform</span>
            <span>Signed up</span>
          </div>
          <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
            {entries.map((e, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_140px] px-4 py-2.5 text-sm hover:bg-white/[0.02]">
                <span className="text-zinc-300 truncate">{e.email}</span>
                <span className="text-zinc-500 text-xs self-center">{e.platform}</span>
                <span className="text-zinc-500 text-xs self-center">{fmtDate(e.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Keys tab --------------------------------------------------------------------

function KeysTab({ accessToken }: { accessToken: string }) {
  const [recentKeys, setRecentKeys] = useState<GeneratedKey[]>([]);

  const handleIssued = (key: GeneratedKey) => {
    setRecentKeys((prev) => [key, ...prev].slice(0, 5));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-white mb-1">Issue API Key</h3>
        <p className="text-xs text-zinc-500 mb-4">Generate a key for any user — bypasses self-service flow.</p>
        <AdminKeyIssuer accessToken={accessToken} onIssued={handleIssued} />
      </div>

      {recentKeys.length > 0 && (
        <div>
          <h3 className="font-semibold text-white mb-3">Recently Issued (this session)</h3>
          <div className="space-y-2">
            {recentKeys.map((k, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{k.email}</span>
                  <span className="text-xs text-zinc-500">{k.plan} · expires {k.expiresDate}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                  <span className="flex-1 truncate">{k.token}</span>
                  <CopyButton value={k.token} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Releases tab ----------------------------------------------------------------

function ReleasesTab() {
  const [releases, setReleases] = useState<GHRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch(GH_API_RELEASES, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: GHRelease[]) => setReleases(json))
      .catch(() => setReleases([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-zinc-500 text-sm">Loading releases…</div>;
  }

  if (releases.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm">
        No releases found.{" "}
        <a href={GH_RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
          View on GitHub
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {releases.map((rel) => {
        const totalDL = rel.assets.reduce((s, a) => s + (a.download_count ?? 0), 0);
        const isOpen = expanded === rel.id;
        return (
          <div key={rel.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              onClick={() => setExpanded(isOpen ? null : rel.id)}
            >
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-white text-sm">{rel.tag_name}</span>
                    {rel.prerelease && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        pre-release
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{fmtDate(rel.published_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-white">{fmt(totalDL)}</p>
                  <p className="text-xs text-zinc-500">downloads</p>
                </div>
                <a
                  href={rel.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Open on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {isOpen && rel.assets.length > 0 && (
              <div className="border-t border-white/5 px-5 py-3 space-y-1.5">
                {rel.assets.map((asset) => (
                  <div key={asset.name} className="flex items-center gap-3 text-sm py-1">
                    <a
                      href={asset.browser_download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate flex-1"
                    >
                      {asset.name}
                    </a>
                    <span className="text-zinc-600 text-xs shrink-0">{fmtBytes(asset.size)}</span>
                    <span className="text-zinc-300 text-xs font-medium tabular-nums shrink-0 w-12 text-right">
                      {fmt(asset.download_count)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {isOpen && rel.assets.length === 0 && (
              <div className="border-t border-white/5 px-5 py-3 text-zinc-500 text-sm">No assets attached.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Diagnostics tab -------------------------------------------------------------

function DiagnosticsTab({ accessToken }: { accessToken: string }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { url: `${VOXLEN_BASE}/api/me`, label: "/api/me", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/grammar`, label: "/api/grammar", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/generate-key`, label: "/api/generate-key", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/admin/waitlist`, label: "/api/admin/waitlist", status: "loading", responseMs: null, code: null },
    { url: `${VOXLEN_BASE}/api/admin/health`, label: "/api/admin/health", status: "loading", responseMs: null, code: null },
  ]);

  const runPings = useCallback(async () => {
    const pings = [
      { url: `${VOXLEN_BASE}/api/me`, label: "/api/me", method: "GET" },
      { url: `${VOXLEN_BASE}/api/grammar`, label: "/api/grammar", method: "POST" },
      { url: `${VOXLEN_BASE}/api/generate-key`, label: "/api/generate-key", method: "POST" },
      { url: `${VOXLEN_BASE}/api/admin/waitlist`, label: "/api/admin/waitlist", method: "GET" },
      { url: `${VOXLEN_BASE}/api/admin/health`, label: "/api/admin/health", method: "GET" },
    ];

    // reset all to loading
    setEndpoints((prev) => prev.map((e) => ({ ...e, status: "loading", responseMs: null, code: null })));

    for (const ep of pings) {
      const start = Date.now();
      try {
        const r = await fetch(ep.url, {
          method: ep.method,
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: ep.method === "POST" ? JSON.stringify({}) : undefined,
          signal: AbortSignal.timeout(6000),
        });
        const ms = Date.now() - start;
        setEndpoints((prev) =>
          prev.map((e) =>
            e.label === ep.label
              ? { ...e, status: r.status < 500 ? "ok" : "error", responseMs: ms, code: r.status }
              : e
          )
        );
      } catch {
        const ms = Date.now() - start;
        setEndpoints((prev) =>
          prev.map((e) =>
            e.label === ep.label ? { ...e, status: "error", responseMs: ms, code: null } : e
          )
        );
      }
    }
  }, [accessToken]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    try {
      const r = await fetch(`${VOXLEN_BASE}/api/admin/health`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await r.json()) as HealthData & { error?: string };
      if (!r.ok) {
        setHealthError(json.error ?? "Failed");
      } else {
        setHealth(json);
      }
    } catch {
      setHealthError("Network error — is the API reachable?");
    }
    setHealthLoading(false);
  }, [accessToken]);

  useEffect(() => {
    runPings();
    fetchHealth();
  }, [runPings, fetchHealth]);

  return (
    <div className="space-y-6">
      {/* Env vars */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Environment Variables</h3>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${healthLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {healthError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {healthError}
          </div>
        )}

        {healthLoading ? (
          <div className="py-6 text-center text-zinc-500 text-sm">Checking environment…</div>
        ) : health ? (
          <div className="space-y-2">
            {Object.entries(health.env).map(([key, set]) => (
              <div key={key} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                {set ? (
                  <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className="font-mono text-xs text-zinc-300 flex-1">{key}</span>
                <span className={`text-xs font-medium ${set ? "text-green-400" : "text-red-400"}`}>
                  {set ? "configured" : "missing"}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-zinc-600 pt-2">
              Last checked: {health.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "—"}
            </p>
          </div>
        ) : null}
      </div>

      {/* API ping */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">API Endpoint Health</h3>
          <button
            onClick={runPings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Activity className="h-3 w-3" />
            Re-ping all
          </button>
        </div>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointRow key={ep.label} ep={ep} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Admin panel (tabbed) ────────────────────────────────────────────────────

function AdminPanel({ accessToken }: { accessToken: string }) {
  const [tab, setTab] = useState<AdminTab>("overview");

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: "waitlist", label: "Waitlist", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "keys", label: "Keys", icon: <Key className="h-3.5 w-3.5" /> },
    { id: "releases", label: "Releases", icon: <Tag className="h-3.5 w-3.5" /> },
    { id: "diagnostics", label: "Diagnostics", icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-amber-500/10">
        <div className="flex items-center gap-1.5 mr-4 pb-3">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-amber-300 font-semibold text-sm">Admin</span>
        </div>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "text-amber-300 border-amber-400 bg-amber-500/5"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === "overview" && <OverviewTab accessToken={accessToken} />}
        {tab === "waitlist" && <WaitlistTab accessToken={accessToken} />}
        {tab === "keys" && <KeysTab accessToken={accessToken} />}
        {tab === "releases" && <ReleasesTab />}
        {tab === "diagnostics" && <DiagnosticsTab accessToken={accessToken} />}
      </div>
    </div>
  );
}

// ─── Getting started checklist ───────────────────────────────────────────────

function GettingStarted({ hasApiKey }: { hasApiKey: boolean }) {
  const steps = [
    { label: "Account created", done: true },
    { label: "Downloaded app", done: false },
    { label: "Pasted API key into Voxlen Settings", done: hasApiKey },
    { label: "First dictation", done: false },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">Getting Started</h2>
        <span className="text-xs text-zinc-500">{completed}/{steps.length} complete</span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 py-1">
            {step.done ? (
              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-600 shrink-0" />
            )}
            <span className={`text-sm ${step.done ? "text-zinc-300" : "text-zinc-500"}`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export function Dashboard({
  user,
  accessToken,
  onSignOut,
}: {
  user: GoogleUser;
  accessToken: string | null;
  onSignOut: () => void;
}) {
  const isAdmin = user.email === ADMIN_EMAIL;
  const [assets, setAssets] = useState<ReleaseAsset[] | null>(null);
  const [hasRelease, setHasRelease] = useState<boolean | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    fetch(GH_API_LATEST, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { assets?: ReleaseAsset[] }) => {
        if (Array.isArray(json.assets) && json.assets.length > 0) {
          setAssets(json.assets);
          setHasRelease(true);
        } else {
          setHasRelease(false);
        }
      })
      .catch(() => setHasRelease(false));
  }, []);

  const hrefFor = (regex: RegExp): string => {
    if (assets) {
      const match = assets.find((a) => regex.test(a.name));
      if (match) return match.browser_download_url;
    }
    return GH_RELEASES_PAGE;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Top bar */}
      <div className="border-b border-white/5 bg-[#0c0c0f]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">Voxlen</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400 text-sm">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm text-zinc-300 hidden sm:block">{user.email}</span>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome + plan badge */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="text-zinc-400 text-sm">
              {user.email}
              {" · "}
              <span className="text-zinc-500">Google account</span>
            </p>
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 font-semibold text-sm">Admin — Full Access</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600/10 border border-brand-600/30">
              <Shield className="h-4 w-4 text-brand-400" />
              <span className="text-brand-300 font-semibold text-sm">Free Plan</span>
            </div>
          )}
        </div>

        {/* Admin panel */}
        {isAdmin && accessToken && <AdminPanel accessToken={accessToken} />}

        {/* Connect Desktop App */}
        {accessToken && <ConnectDesktopApp accessToken={accessToken} onKeyReady={() => setHasApiKey(true)} />}

        {/* Getting started checklist (non-admin) */}
        {!isAdmin && <GettingStarted hasApiKey={hasApiKey} />}

        {/* Subscription (non-admin) */}
        {!isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-zinc-400" />
              <h2 className="font-bold">Subscription</h2>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-zinc-300 font-medium">Free Plan</p>
                <p className="text-zinc-500 text-sm mt-0.5">Upgrade to Pro or Professional to unlock grammar AI and unlimited dictation.</p>
              </div>
              <a
                href="/#pricing"
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                Upgrade
              </a>
            </div>
          </div>
        )}

        {/* Upgrade prompt (non-admin) */}
        {!isAdmin && (
          <div className="rounded-2xl border border-brand-600/20 bg-brand-600/5 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-brand-400" />
              <h2 className="font-bold text-brand-300">Unlock Full Access</h2>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              Upgrade to a Pro or Professional plan — Voxlen supplies all AI keys. No Deepgram or Anthropic accounts
              needed.
            </p>
            <a
              href="/#pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              View Plans
            </a>
          </div>
        )}

        {/* Downloads */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-zinc-400" />
            <h2 className="font-bold">Downloads</h2>
            {hasRelease === true && (
              <span className="ml-auto text-xs text-zinc-500">Latest release</span>
            )}
          </div>

          {hasRelease === false ? (
            <div className="text-center py-8 text-zinc-500">
              <p className="text-sm">No public release yet — builds are coming soon.</p>
              <a
                href={GH_RELEASES_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-brand-400 hover:text-brand-300"
              >
                Watch GitHub releases <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORMS.map((p) => {
                const Icon = p.icon === "apple" ? Apple : Monitor;
                const href = hasRelease ? hrefFor(p.regex) : GH_RELEASES_PAGE;
                return (
                  <a
                    key={p.key}
                    href={href}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-brand-600/20 transition-colors">
                      <Icon className="h-4.5 w-4.5 text-zinc-400 group-hover:text-brand-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{p.label}</p>
                      <p className="text-xs text-zinc-500">{p.sub}</p>
                    </div>
                    <Download className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 ml-auto shrink-0 transition-colors" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="font-bold mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-500">Email</span>
              <div className="flex items-center gap-1">
                <span className="text-zinc-300 font-mono text-xs">{user.email}</span>
                <CopyButton value={user.email} />
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-500">Name</span>
              <span className="text-zinc-300">{user.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-zinc-500">Plan</span>
              <span className={`font-medium text-sm ${isAdmin ? "text-amber-300" : "text-zinc-300"}`}>
                {isAdmin ? "Admin" : "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-500">Sign-in method</span>
              <span className="text-zinc-300">Google</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
