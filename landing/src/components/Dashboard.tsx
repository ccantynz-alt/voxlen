import { useState, useEffect } from "react";
import {
  Download,
  Apple,
  Monitor,
  Shield,
  Zap,
  Key,
  LogOut,
  Copy,
  Check,
  Crown,
  ExternalLink,
} from "lucide-react";
import type { GoogleUser } from "../lib/auth";

const ADMIN_EMAIL = "ccantynz@gmail.com";
const GH_API_LATEST = "https://api.github.com/repos/ccantynz-alt/voxlen/releases/latest";
const GH_RELEASES_PAGE = "https://github.com/ccantynz-alt/voxlen/releases/latest";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

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

export function Dashboard({ user, onSignOut }: { user: GoogleUser; onSignOut: () => void }) {
  const isAdmin = user.email === ADMIN_EMAIL;
  const [assets, setAssets] = useState<ReleaseAsset[] | null>(null);
  const [hasRelease, setHasRelease] = useState<boolean | null>(null);

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
            <div className="w-8 h-8 rounded-lg bg-marcoreid-600 flex items-center justify-center">
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
            <p className="text-zinc-400 text-sm">Your Voxlen account</p>
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 font-semibold text-sm">Admin — Full Access</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-marcoreid-600/10 border border-marcoreid-600/30">
              <Shield className="h-4 w-4 text-marcoreid-400" />
              <span className="text-marcoreid-300 font-semibold text-sm">Free Plan</span>
            </div>
          )}
        </div>

        {/* Admin access card */}
        {isAdmin && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-amber-400" />
              <h2 className="font-bold text-amber-300">Admin Access</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Privileges</p>
                {[
                  "Full product access — no API key required",
                  "Unlimited dictation sessions",
                  "All AI grammar correction (Deepgram + Claude)",
                  "All export formats (RTF, TXT, MD, JSON, SRT)",
                  "All voice commands + clause library",
                  "Unlimited client/matter billing tracking",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-zinc-300">
                    <Check className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Quick links</p>
                <a
                  href="https://app.voxlen.ai"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Voxlen App
                </a>
                <a
                  href="https://github.com/ccantynz-alt/voxlen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub Repository
                </a>
              </div>
            </div>
          </div>
        )}

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
                <p className="text-zinc-500 text-sm mt-0.5">Add an API key to unlock grammar AI, or upgrade for managed access.</p>
              </div>
              <a
                href="/#pricing"
                className="px-4 py-2 rounded-lg bg-marcoreid-600 text-white text-sm font-semibold hover:bg-marcoreid-700 transition-colors"
              >
                Upgrade
              </a>
            </div>
          </div>
        )}

        {/* API key (non-admin) */}
        {!isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-5 w-5 text-zinc-400" />
              <h2 className="font-bold">API Keys</h2>
            </div>
            <p className="text-zinc-500 text-sm mb-4">
              Enter your own Deepgram and Anthropic keys in the desktop app Settings panel, or upgrade for managed keys (no setup needed).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <a
                href="https://console.deepgram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Get Deepgram key (free tier)
              </a>
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Get Anthropic key (Claude)
              </a>
            </div>
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
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-marcoreid-400 hover:text-marcoreid-300"
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
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-marcoreid-600/20 transition-colors">
                      <Icon className="h-4.5 w-4.5 text-zinc-400 group-hover:text-marcoreid-400 transition-colors" />
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
