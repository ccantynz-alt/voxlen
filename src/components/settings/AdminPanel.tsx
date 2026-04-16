import { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Monitor,
  Keyboard,
  Clipboard,
  Mic,
  Bell,
  Power,
  FileText,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface PermissionState {
  granted: boolean;
  name: string;
  description: string;
}

interface PermissionStatus {
  text_injection: PermissionState;
  clipboard: PermissionState;
  audio_capture: PermissionState;
  notifications: PermissionState;
  autostart: PermissionState;
  platform: string;
  is_admin: boolean;
  missing_dependencies: string[];
  suggestions: string[];
}

const PERMISSION_ICONS: Record<string, React.ElementType> = {
  text_injection: Keyboard,
  clipboard: Clipboard,
  audio_capture: Mic,
  notifications: Bell,
  autostart: Power,
};

export function AdminPanel() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const checkPermissions = async () => {
    setLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<PermissionStatus>("check_permissions");
      setStatus(result);
    } catch {
      // Demo/fallback status for when not running in Tauri
      setStatus({
        text_injection: {
          granted: false,
          name: "Text Injection",
          description: "Type text into other applications",
        },
        clipboard: {
          granted: true,
          name: "Clipboard",
          description: "Clipboard access for copy/paste",
        },
        audio_capture: {
          granted: true,
          name: "Microphone",
          description: "Audio capture for voice dictation",
        },
        notifications: {
          granted: true,
          name: "Notifications",
          description: "Desktop notification support",
        },
        autostart: {
          granted: false,
          name: "Launch at Login",
          description: "Auto-start when you log in",
        },
        platform: "browser",
        is_admin: false,
        missing_dependencies: ["Tauri runtime (running in browser mode)"],
        suggestions: [
          "Build and run as a native desktop app for full functionality",
          "Install the Tauri development dependencies for your platform",
        ],
      });
    }
    setLoading(false);
  };

  const requestPermissions = async () => {
    setRequesting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("request_admin_permissions");
      // Re-check after requesting
      await checkPermissions();
    } catch {
      // Not in Tauri
    }
    setRequesting(false);
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const permissions = status
    ? [
        { key: "text_injection", ...status.text_injection },
        { key: "clipboard", ...status.clipboard },
        { key: "audio_capture", ...status.audio_capture },
        { key: "notifications", ...status.notifications },
        { key: "autostart", ...status.autostart },
      ]
    : [];

  const grantedCount = permissions.filter((p) => p.granted).length;
  const totalCount = permissions.length;
  const allGranted = grantedCount === totalCount;

  return (
    <div className="flex flex-col h-full p-8 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-md shadow-elevation shadow-inset-hairline",
              allGranted
                ? "bg-gradient-to-br from-marcoreid-700 to-marcoreid-900"
                : "bg-gradient-to-br from-marcoreid-800 to-marcoreid-950"
            )}
          >
            {allGranted ? (
              <ShieldCheck className="h-4 w-4 text-brass-300" strokeWidth={2} />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" strokeWidth={2} />
            )}
          </div>
          <div>
            <h2 className="font-display text-[22px] font-medium tracking-tight-display text-surface-950 leading-tight">
              Permissions <span className="italic text-brass-500">&amp; access</span>
            </h2>
            <p className="text-[11px] text-surface-600 mt-0.5 leading-snug font-mono tabular-nums">
              {loading
                ? "Checking…"
                : `${grantedCount} of ${totalCount} granted`}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={checkPermissions}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} strokeWidth={1.75} />
          Refresh
        </Button>
      </div>

      <div className="divider-brass" />

      {/* Admin status banner */}
      {status && (
        <div
          className={cn(
            "rounded-md p-4 border shadow-inset-hairline",
            status.is_admin
              ? "bg-brass-400/8 border-brass-400/25"
              : "bg-amber-500/8 border-amber-500/25"
          )}
        >
          <div className="flex items-center gap-3">
            <Shield
              className={cn(
                "h-4 w-4",
                status.is_admin ? "text-brass-500" : "text-amber-500"
              )}
              strokeWidth={1.75}
            />
            <div>
              <p className="text-[13px] font-medium text-surface-900 tracking-tight">
                {status.is_admin
                  ? "Administrator access"
                  : "Limited access"}
              </p>
              <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">
                {status.is_admin
                  ? "Full administrator privileges on this system."
                  : "Some features may require elevated permissions."}
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant={status.is_admin ? "success" : "warning"}>
                {status.platform.charAt(0).toUpperCase() + status.platform.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Permissions list */}
      <div className="space-y-2">
        <h3 className="label-caps mb-3 block">
          System permissions
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-md bg-surface-100/60 animate-pulse-soft"
              />
            ))}
          </div>
        ) : (
          permissions.map((perm) => {
            const Icon = PERMISSION_ICONS[perm.key] || Monitor;
            return (
              <div
                key={perm.key}
                className="flex items-center gap-4 p-4 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-md",
                    perm.granted ? "bg-brass-400/10 border border-brass-400/25" : "bg-red-500/10 border border-red-500/25"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      perm.granted ? "text-brass-500" : "text-red-500"
                    )}
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-surface-900 tracking-tight">
                    {perm.name}
                  </p>
                  <p className="text-[11px] text-surface-600 leading-snug mt-0.5">{perm.description}</p>
                </div>
                {perm.granted ? (
                  <CheckCircle className="h-4 w-4 text-brass-500" strokeWidth={1.75} />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" strokeWidth={1.75} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Missing dependencies */}
      {status && status.missing_dependencies.length > 0 && (
        <div className="space-y-2">
          <h3 className="label-caps mb-3 block">
            Missing dependencies
          </h3>
          <div className="rounded-md bg-red-500/8 border border-red-500/25 shadow-inset-hairline p-4 space-y-2">
            {status.missing_dependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" strokeWidth={1.75} />
                <span className="text-[12px] text-surface-800 font-mono">{dep}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {status && status.suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="label-caps mb-3 block">
            How to resolve
          </h3>
          <div className="space-y-2">
            {status.suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline"
              >
                <ExternalLink className="h-3.5 w-3.5 text-brass-500 mt-0.5 shrink-0" strokeWidth={1.75} />
                <p className="text-[12px] text-surface-800 leading-relaxed">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal pack */}
      <div className="space-y-2">
        <h3 className="label-caps mb-3 block">
          Legal &amp; compliance
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Licence (EULA)", path: "EULA.md", icon: Scale },
            { label: "Terms of Service", path: "TERMS.md", icon: FileText },
            { label: "Privacy Policy", path: "PRIVACY_POLICY.md", icon: Shield },
            { label: "Acceptable Use", path: "ACCEPTABLE_USE.md", icon: FileText },
            { label: "Data Processing (DPA)", path: "DPA.md", icon: FileText },
            { label: "Third-party notices", path: "THIRD_PARTY_NOTICES.md", icon: FileText },
          ].map((doc) => {
            const Icon = doc.icon;
            return (
              <button
                key={doc.path}
                type="button"
                onClick={() =>
                  window.open(
                    `https://github.com/ccantynz-alt/voxlen/blob/main/legal/${doc.path}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline hover:bg-surface-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-brass-500 shrink-0" strokeWidth={1.75} />
                  <span className="text-[12px] text-surface-900 truncate">{doc.label}</span>
                </div>
                <ExternalLink className="h-3 w-3 text-surface-600 shrink-0" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] text-surface-600 leading-snug mt-2 italic font-display">
          Governed by the laws of New Zealand. Questions: legal@marcoreid.com.
        </p>
      </div>

      {/* Request permissions button */}
      {status && !allGranted && (
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={requestPermissions}
            disabled={requesting}
          >
            {requesting ? (
              <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            )}
            {requesting
              ? "Requesting…"
              : "Request missing permissions"}
          </Button>
        </div>
      )}
    </div>
  );
}
