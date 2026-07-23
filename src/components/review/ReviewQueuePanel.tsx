import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardCheck, RefreshCw, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useReviewStore, type ReviewSummary } from "@/stores/review";
import { useSettingsStore } from "@/stores/settings";
import { buildSessionDocx, uint8ToBase64 } from "@/lib/autoDoc";
import { canTransition, type ReviewStatus } from "@/lib/reviewPacket";
import { toast } from "@/components/ui/Toast";

const textB64 = (value: unknown) => uint8ToBase64(new TextEncoder().encode(JSON.stringify(value, null, 2)));
const decodeText = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
const labels: Record<string, string> = { pending_review: "Pending", in_review: "In review", finalized: "Finalized" };

export function ReviewQueuePanel() {
  const { packets, unreadableCount, loading, error, refresh } = useReviewStore();
  const [filter, setFilter] = useState("pending_review"); const [selected, setSelected] = useState<ReviewSummary | null>(null);
  useEffect(() => { void refresh(); const id = setInterval(refresh, 30_000); const focus = () => void refresh(); window.addEventListener("focus", focus);
    return () => { clearInterval(id); window.removeEventListener("focus", focus); }; }, [refresh]);
  const shown = useMemo(() => packets.filter((p) => (p.status?.status || p.fallback.status) === filter), [packets, filter]);
  if (selected) return <ReviewDetail summary={selected} onBack={() => { setSelected(null); void refresh(); }} />;
  return <div className="flex flex-col h-full p-6 gap-4">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center"><ClipboardCheck className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold text-surface-950">Review queue</h2><p className="text-xs text-surface-600">Secretary queue synced through your firm folder</p></div></div>
      <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="flex gap-1 border-b border-surface-300/50">{["pending_review", "in_review", "finalized"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-2 text-xs border-b-2 ${filter === s ? "border-brass-400 text-surface-950" : "border-transparent text-surface-600"}`}>{labels[s]}</button>)}</div>
    {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400"><AlertTriangle className="inline h-4 w-4 mr-2" />Shared folder unavailable: {error} <button className="underline ml-2" onClick={() => void refresh()}>Retry</button></div>}
    {unreadableCount > 0 && <p className="text-xs text-amber-500">{unreadableCount} unreadable packet{unreadableCount === 1 ? "" : "s"} skipped.</p>}
    <div className="flex-1 overflow-y-auto space-y-2">{!error && !loading && shown.length === 0 && <div className="py-16 text-center text-sm text-surface-600">No {labels[filter].toLowerCase()} packets.</div>}
      {shown.map((item) => { const p = item.packet; const s = item.status; const created = p?.createdAt || item.fallback.createdAt; const age = created ? Math.max(0, Math.floor((Date.now() - Date.parse(created)) / 86_400_000)) : 0;
        return <button key={item.dir} disabled={item.newerVersion} onClick={() => setSelected(item)} className="w-full text-left rounded-xl border border-surface-300/50 bg-surface-100 p-4 disabled:opacity-60">
          <div className="flex justify-between"><span className="font-medium text-sm text-surface-950">{p?.client.name || item.fallback.client}</span><span className="text-[10px] text-surface-600">{labels[s?.status || item.fallback.status] || item.fallback.status}</span></div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-surface-600"><span>{created ? new Date(created).toLocaleDateString() : "Unknown date"}</span><span>{p?.session.word_count == null ? "Word count unavailable" : `${p.session.word_count} words`}</span><span>{age === 0 ? "Today" : `${age}d ago`}</span><span>From {p?.sender || item.fallback.sender}</span><span className="col-span-2">Updated by {s?.updatedBy || item.fallback.updatedBy}</span></div>
          {item.newerVersion && <p className="mt-2 text-xs text-amber-500">Update Voxlen to open this newer packet.</p>}
        </button>; })}</div>
  </div>;
}

function ReviewDetail({ summary, onBack }: { summary: ReviewSummary; onBack: () => void }) {
  const packet = summary.packet!; const [status, setStatus] = useState(summary.status!);
  const [edits, setEdits] = useState(() => packet.session.segments.map((s) => s.corrected_text || s.text)); const [busy, setBusy] = useState(false);
  const editsChanged = useRef(false);
  const root = useSettingsStore((s) => s.reviewSharedFolderPath); const displayName = useSettingsStore((s) => s.reviewDisplayName).trim() || "Voxlen user";
  useEffect(() => { void invoke<string>("read_review_file", { root, dir: summary.dir, name: "edited.json" }).then((b64) => {
    const parsed = JSON.parse(decodeText(b64));
    if (parsed?.schemaVersion === 1 && Array.isArray(parsed.segments) && !editsChanged.current) {
      setEdits(packet.session.segments.map((segment, i) => i < parsed.segments.length ? String(parsed.segments[i]) : segment.corrected_text || segment.text));
    }
  }).catch(() => {}); }, [root, summary.dir]);
  const write = useCallback((name: string, value: unknown | Uint8Array) => invoke("write_review_file", { root, dir: summary.dir, name,
    contentsB64: value instanceof Uint8Array ? uint8ToBase64(value) : textB64(value) }), [root, summary.dir]);
  const updateStatus = async (next: ReviewStatus["status"]) => { if (!canTransition(status.status, next)) return; setBusy(true); try { const value: ReviewStatus = { schemaVersion: 1, status: next, updatedAt: new Date().toISOString(), updatedBy: displayName }; await write("status.json", value); setStatus(value); } catch (e) { toast(`Review update failed: ${String(e)}`, "error"); } finally { setBusy(false); } };
  const save = async () => { setBusy(true); try { await write("edited.json", { schemaVersion: 1, segments: edits }); toast("Edits saved", "success"); } catch (e) { toast(`Could not save edits: ${String(e)}`, "error"); } finally { setBusy(false); } };
  const finalize = async () => { if (!canTransition(status.status, "finalized")) return; setBusy(true); try {
    await write("edited.json", { schemaVersion: 1, segments: edits }); const segments = packet.session.segments.map((s, i) => ({ ...s, corrected_text: edits[i] }));
    const wordCount = edits.join(" ").split(/\s+/).filter(Boolean).length; const doc = await buildSessionDocx({ segments, clientName: packet.client.name, matterLabel: packet.client.matterNumber, startedAtMs: packet.session.started_at_ms, durationMs: packet.session.duration_ms, wordCount, title: "Voxlen Transcript" });
    await write("final.docx", doc); const value: ReviewStatus = { schemaVersion: 1, status: "finalized", updatedAt: new Date().toISOString(), updatedBy: displayName }; await write("status.json", value); setStatus(value); toast("Review finalized", "success");
  } catch (e) { toast(`Finalize failed: ${String(e)}`, "error"); } finally { setBusy(false); } };
  return <div className="flex flex-col h-full p-6 gap-4"><div className="flex items-center justify-between"><div><button onClick={onBack} className="text-xs text-surface-600 mb-2"><ArrowLeft className="inline h-3 w-3 mr-1" />Queue</button><h2 className="text-lg font-semibold">{packet.client.name}</h2><p className="text-xs text-surface-600">{packet.client.matterNumber || "No matter number"} | {labels[status.status]} | updated by {status.updatedBy}</p></div><div className="flex gap-2">{canTransition(status.status, "in_review") && <Button size="sm" onClick={() => void updateStatus("in_review")} disabled={busy}>Start review</Button>}{status.status === "in_review" && <Button variant="secondary" size="sm" onClick={() => void save()} disabled={busy}>Save edits</Button>}{canTransition(status.status, "finalized") && <Button size="sm" onClick={() => void finalize()} disabled={busy}>Finalize</Button>}</div></div>
    <p className="text-[11px] text-surface-600">The original document may still be syncing. Finalize regenerates the Word document from these segments.</p>
    <div className="flex-1 overflow-y-auto space-y-3">{edits.map((text, i) => <textarea key={packet.session.segments[i].id} value={text} disabled={status.status === "finalized"} onChange={(e) => { editsChanged.current = true; setEdits((all) => all.map((v, j) => j === i ? e.target.value : v)); }} className="w-full min-h-24 rounded-lg border border-surface-300/60 bg-surface-100 p-3 text-sm text-surface-900 focus:outline-none focus:border-brass-400 disabled:opacity-70" />)}</div>
  </div>;
}
