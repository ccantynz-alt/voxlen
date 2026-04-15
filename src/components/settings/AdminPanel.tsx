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
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-xl",
              allGranted
                ? "bg-green-500/10"
                : "bg-amber-500/10"
            )}
          >
            {allGranted ? (
              <ShieldCheck className="h-6 w-6 text-green-400" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-950">
              Admin & Permissions
            </h2>
            <p className="text-xs text-surface-600">
              {loading
                ? "Checking permissions..."
                : `${grantedCount}/${totalCount} permissions granted`}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={checkPermissions}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Admin status banner */}
      {status && (
        <div
          className={cn(
            "rounded-xl p-4 border",
            status.is_admin
              ? "bg-green-500/5 border-green-500/20"
              : "bg-amber-500/5 border-amber-500/20"
          )}
        >
          <div className="flex items-center gap-3">
            <Shield
              className={cn(
                "h-5 w-5",
                status.is_admin ? "text-green-400" : "text-amber-400"
              )}
            />
            <div>
              <p className="text-sm font-medium text-surface-900">
                {status.is_admin
                  ? "Admin Access Granted"
                  : "Limited Access"}
              </p>
              <p className="text-xs text-surface-600 mt-0.5">
                {status.is_admin
                  ? "You have full administrator privileges on this system."
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
        <h3 className="text-sm font-semibold text-surface-950 mb-3">
          System Permissions
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-surface-100 animate-pulse"
              />
            ))}
          </div>
        ) : (
          permissions.map((perm) => {
            const Icon = PERMISSION_ICONS[perm.key] || Monitor;
            return (
              <div
                key={perm.key}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300/50"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg",
                    perm.granted ? "bg-green-500/10" : "bg-red-500/10"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      perm.granted ? "text-green-400" : "text-red-400"
                    )}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-900">
                    {perm.name}
                  </p>
                  <p className="text-xs text-surface-600">{perm.description}</p>
                </div>
                {perm.granted ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Missing dependencies */}
      {status && status.missing_dependencies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-surface-950 mb-3">
            Missing Dependencies
          </h3>
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-2">
            {status.missing_dependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-sm text-surface-800">{dep}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {status && status.suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-surface-950 mb-3">
            How to Fix
          </h3>
          <div className="space-y-2">
            {status.suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface-200/50"
              >
                <ExternalLink className="h-4 w-4 text-voxlen-400 mt-0.5 shrink-0" />
                <p className="text-xs text-surface-800">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request permissions button */}
      {status && !allGranted && (
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={requestPermissions}
            disabled={requesting}
          >
            {requesting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {requesting
              ? "Requesting..."
              : "Request Missing Permissions"}
          </Button>
        </div>
      )}
    </div>
  );
}
