import { useState, useMemo } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Users,
  Plus,
  Pencil,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Calendar,
  BarChart3,
  Settings,
  Trash2,
  ExternalLink,
  RefreshCw,
  Grid3X3,
  ChevronLeft,
  UserPlus,
  Clock,
  UserX,
  ShieldOff,
  Download,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Agent Detail Panel ──────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  national_id: "National ID (بطاقة الرقم القومي)",
  qualification: "Qualification Certificate (شهادة المؤهل / بيان قيد)",
  cv: "CV",
  personal_photos: "Personal Photos (2–6 صور شخصية)",
  military_status: "Military Status (موقف التجنيد - للذكور)",
  insurance_status: "Insurance Status (موقف التأمينات)",
  criminal_record: "Criminal Record (فيش جنائي)",
};

function AgentDetailDialog({ agent, onClose }: { agent: WorkforceAgent; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: docs = [] } = trpc.documents.listByAgent.useQuery({ traineeCode: agent.traineeCode });
  const { data: allPayments = [] } = trpc.paymentMethods.listAll.useQuery();
  const payments = (allPayments as Array<{ traineeCode?: string } & Record<string, unknown>>).filter(p => p.traineeCode === agent.traineeCode);
  const [activeSection, setActiveSection] = useState<"docs" | "payments">("docs");
  const [docComment, setDocComment] = useState<Record<number, string>>({});
  const [payComment, setPayComment] = useState<Record<number, string>>({});

  const reviewDoc = trpc.documents.review.useMutation({
    onSuccess: () => { utils.documents.listByAgent.invalidate({ traineeCode: agent.traineeCode }); toast.success("Document updated"); },
    onError: (e: { message: string }) => toast.error(getErrorMessage(e)),
  });
  const addPaymentComment = trpc.paymentMethods.addComment.useMutation({
    onSuccess: () => { utils.paymentMethods.listAll.invalidate(); toast.success("Comment added"); },
    onError: (e: { message: string }) => toast.error(getErrorMessage(e)),
  });

  // Separation state
  const [resignDialog, setResignDialog] = useState(false);
  const [terminateDialog, setTerminateDialog] = useState(false);
  const [separationReason, setSeparationReason] = useState("");
  // Reset password state
  const [resetPwDialog, setResetPwDialog] = useState(false);
  const [newPwResult, setNewPwResult] = useState<{ traineeCode: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const resetPassword = trpc.agent.resetPassword.useMutation({
    onSuccess: (data) => { setNewPwResult(data); },
    onError: (e: { message: string }) => toast.error(getErrorMessage(e)),
  });
  function copyPassword() {
    if (!newPwResult) return;
    navigator.clipboard.writeText(newPwResult.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const resignOnSpot = trpc.separation.resignOnSpot.useMutation({
    onSuccess: () => {
      toast.success("Agent marked as resigned. Portal access revoked and candidate blacklisted.");
      setResignDialog(false);
      setSeparationReason("");
      onClose();
    },
    onError: (e: { message: string }) => toast.error(getErrorMessage(e)),
  });

  const terminateAgent = trpc.separation.terminate.useMutation({
    onSuccess: () => {
      toast.success("Agent terminated. Portal access revoked.");
      setTerminateDialog(false);
      setSeparationReason("");
      onClose();
    },
    onError: (e: { message: string }) => toast.error(getErrorMessage(e)),
  });

  type Doc = { id: number; docType: string; fileUrl: string; status: string; adminComment?: string | null; uploadedAt: Date | number | string };
  type Payment = { id: number; method: string; provider?: string | null; accountNumber?: string | null; phoneNumber?: string | null; accountHolderName?: string | null; bankName?: string | null; isPreferred: boolean; adminComment?: string | null; status: string };

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {agent.fullName} {agent.alias ? `(${agent.alias})` : ""} — {agent.traineeCode}
          </DialogTitle>
        </DialogHeader>
        {/* Separation action buttons — only show if agent is still active/inactive */}
        {agent.agentStatus !== "resigned" && agent.agentStatus !== "terminated" && (
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { setSeparationReason(""); setResignDialog(true); }}
            >
              <UserX className="h-3.5 w-3.5" /> Mark Resigned (On Spot)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={() => { setSeparationReason(""); setTerminateDialog(true); }}
            >
              <ShieldOff className="h-3.5 w-3.5" /> Terminate Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => { setNewPwResult(null); setCopied(false); setResetPwDialog(true); }}
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </Button>
          </div>
        )}
        <div className="flex gap-1 border-b mb-4">
          {(["docs", "payments"] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSection === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {s === "docs" ? "Documents" : "Payment Methods"}
            </button>
          ))}
        </div>

        {activeSection === "docs" && (
          <div className="space-y-3">
            {(docs as Doc[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet</p>
            ) : (docs as Doc[]).map(doc => (
              <div key={doc.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-sm">{DOC_LABELS[doc.docType] ?? doc.docType}</div>
                    <div className="text-xs text-muted-foreground">{new Date(doc.uploadedAt as number).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${STATUS_COLORS[doc.status] ?? ""}`} variant="outline">{doc.status}</Badge>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  </div>
                </div>
                {doc.adminComment && <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2">Comment: {doc.adminComment}</p>}
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add comment (optional)..."
                    value={docComment[doc.id] ?? ""}
                    onChange={e => setDocComment(c => ({ ...c, [doc.id]: e.target.value }))}
                  />
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => reviewDoc.mutate({ id: doc.id, status: "approved", adminComment: docComment[doc.id] || undefined })} disabled={reviewDoc.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => reviewDoc.mutate({ id: doc.id, status: "rejected", adminComment: docComment[doc.id] || undefined })} disabled={reviewDoc.isPending}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "payments" && (
          <div className="space-y-3">
            {(payments as Payment[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No payment methods added yet</p>
            ) : (payments as Payment[]).map(pay => (
              <div key={pay.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {pay.method === "wallet" ? "Wallet" : "Bank Account"}
                      {pay.provider && <span className="text-xs text-muted-foreground">({pay.provider})</span>}
                      {pay.isPreferred && <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200" variant="outline">Preferred</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {pay.method === "wallet" && pay.phoneNumber && <span>Phone: {pay.phoneNumber}</span>}
                      {pay.method === "bank" && (
                        <span>{pay.bankName}{pay.accountNumber ? ` · Acc: ${pay.accountNumber}` : ""}{pay.phoneNumber ? ` · Phone: ${pay.phoneNumber}` : ""}</span>
                      )}
                      {pay.accountHolderName && <span className="ml-2">Name: {pay.accountHolderName}</span>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[pay.status] ?? ""}`} variant="outline">{pay.status}</Badge>
                </div>
                {pay.adminComment && <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2">Comment: {pay.adminComment}</p>}
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add comment (optional)..."
                    value={payComment[pay.id] ?? ""}
                    onChange={e => setPayComment(c => ({ ...c, [pay.id]: e.target.value }))}
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => addPaymentComment.mutate({ id: pay.id, comment: payComment[pay.id] || "" })} disabled={addPaymentComment.isPending || !payComment[pay.id]}>Save Comment</Button>
                </div>
              </div>
            ))}
          </div>
        )}
       </DialogContent>
    </Dialog>

    {/* Resign On Spot Confirmation Dialog */}
    {/* These extra dialogs are siblings of the main dialog, inside the fragment */}
    <Dialog open={resignDialog} onOpenChange={setResignDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <UserX className="h-4 w-4" /> Mark as Resigned (On Spot)
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          This will immediately mark <strong>{agent.fullName}</strong> as resigned, revoke their portal access, and blacklist their candidate profile. This action cannot be undone.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Reason (required)</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
            placeholder="Enter reason for on-spot resignation..."
            value={separationReason}
            onChange={e => setSeparationReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setResignDialog(false)}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={!separationReason.trim() || resignOnSpot.isPending}
            onClick={() => resignOnSpot.mutate({ agentCode: agent.traineeCode, reason: separationReason.trim() })}
          >
            Confirm Resignation
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Terminate Agent Confirmation Dialog */}
    <Dialog open={terminateDialog} onOpenChange={setTerminateDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <ShieldOff className="h-4 w-4" /> Terminate Agent
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          This will immediately terminate <strong>{agent.fullName}</strong> and revoke their portal access. This action cannot be undone.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Reason (required)</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
            placeholder="Enter reason for termination..."
            value={separationReason}
            onChange={e => setSeparationReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setTerminateDialog(false)}>Cancel</Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            disabled={!separationReason.trim() || terminateAgent.isPending}
            onClick={() => terminateAgent.mutate({ agentCode: agent.traineeCode, reason: separationReason.trim() })}
          >
            Confirm Termination
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {/* Reset Password Dialog */}
    <Dialog open={resetPwDialog} onOpenChange={(o) => { setResetPwDialog(o); if (!o) setNewPwResult(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Portal Password</DialogTitle>
        </DialogHeader>
        {!newPwResult ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will generate a new random password for <strong>{agent.fullName}</strong> ({agent.traineeCode}). The agent will be required to change it on next login.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setResetPwDialog(false)}>Cancel</Button>
              <Button
                onClick={() => resetPassword.mutate({ candidateId: agent.candidateId, traineeCode: agent.traineeCode })}
                disabled={resetPassword.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {resetPassword.isPending ? "Generating..." : "Generate New Password"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ✓ Password reset successfully. Share the credentials below with the agent.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agent ID</span>
                <span className="font-mono font-medium">{newPwResult.traineeCode}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">New Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">{newPwResult.password}</span>
                  <button onClick={copyPassword} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The agent must change this password on their next login.</p>
            <Button className="w-full" onClick={() => { setResetPwDialog(false); setNewPwResult(null); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Campaign = {
  id: number;
  name: string;
  minHeadcount: number;
  workDays: "all" | "weekdays";
  notes?: string | null;
};

type WorkforceAgent = {
  id: number;
  traineeCode: string;
  candidateId: number;
  campaignId?: number | null;
  campaignName?: string | null;
  fullName: string;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  shiftHours?: string | null;
  teamLeader?: string | null;
  offDay1?: number | null;
  offDay2?: number | null;
  joinDate?: number | null;
  isActive: boolean;
  crdts?: string | null;
  agentStatus?: string | null;
  dialerCredentials?: string | null;
  nestingStatus?: "nesting" | "active" | "senior" | null;
};

type ForecastDay = {
  date: string;
  dayOfWeek: number;
  scheduled: number;
  approvedLeaves: number;
  projected: number;
};

const EMPTY_CAMPAIGN = { name: "", minHeadcount: "20", workDays: "all" as "all" | "weekdays", notes: "" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function getWeekDates(weekOffset: number): string[] {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
function getMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().slice(0, 10);
  });
}
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
type MultiBreakEntries = Record<string, Array<{ start: string; end: string }>>;
type BreakScheduleTabProps = {
  campaigns: Campaign[];
  agents: WorkforceAgent[];
  breakCampaignId: number | null;
  setBreakCampaignId: (id: number | null) => void;
  breakAgentCode: string | null;
  setBreakAgentCode: (code: string | null) => void;
  breakWeekOffset: number;
  setBreakWeekOffset: (offset: number) => void;
  breakEntries: MultiBreakEntries;
  setBreakEntries: (entries: MultiBreakEntries) => void;
  quickFillStart: string;
  setQuickFillStart: (v: string) => void;
  quickFillEnd: string;
  setQuickFillEnd: (v: string) => void;
  upsertBreaks: ReturnType<typeof trpc.breakSchedule.upsert.useMutation>;
};
function BreakScheduleTab({
  campaigns, agents, breakCampaignId, setBreakCampaignId,
  breakAgentCode, setBreakAgentCode, breakWeekOffset, setBreakWeekOffset,
  breakEntries, setBreakEntries, quickFillStart, setQuickFillStart,
  quickFillEnd, setQuickFillEnd, upsertBreaks,
}: BreakScheduleTabProps) {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [monthYear, setMonthYear] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const weekDates = getWeekDates(breakWeekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const [monthY, monthM] = monthYear.split("-").map(Number);
  const monthDates = getMonthDates(monthY, monthM - 1);
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];
  const activeDates = viewMode === "weekly" ? weekDates : monthDates;
  const activeStart = viewMode === "weekly" ? weekStart : monthStart;
  const activeEnd = viewMode === "weekly" ? weekEnd : monthEnd;
  const campaignAgents = breakCampaignId
    ? agents.filter(a => a.campaignId === breakCampaignId && a.isActive)
    : [];
  const { data: existingBreaks = [] } = trpc.breakSchedule.getByAgent.useQuery(
    { agentCode: breakAgentCode!, startDate: activeStart, endDate: activeEnd },
    { enabled: !!breakAgentCode }
  );
  const [synced, setSynced] = useState<string | null>(null);
  const syncKey = `${breakAgentCode}-${activeStart}-${viewMode}`;
  if (synced !== syncKey) {
    setSynced(syncKey);
    const merged: MultiBreakEntries = {};
    for (const b of existingBreaks as Array<{ date: string; breakStart: string; breakEnd: string }>) {
      if (!merged[b.date]) merged[b.date] = [];
      merged[b.date].push({ start: b.breakStart, end: b.breakEnd });
    }
    setBreakEntries(merged);
  }
  const addBreakToDay = (date: string) => {
    const existing = breakEntries[date] ?? [];
    setBreakEntries({ ...breakEntries, [date]: [...existing, { start: "", end: "" }] });
  };
  const updateSlot = (date: string, idx: number, field: "start" | "end", value: string) => {
    const slots = [...(breakEntries[date] ?? [])];
    slots[idx] = { ...slots[idx], [field]: value };
    setBreakEntries({ ...breakEntries, [date]: slots });
  };
  const removeSlot = (date: string, idx: number) => {
    const slots = (breakEntries[date] ?? []).filter((_, i) => i !== idx);
    const updated = { ...breakEntries };
    if (slots.length === 0) delete updated[date];
    else updated[date] = slots;
    setBreakEntries(updated);
  };
  const handleQuickFill = () => {
    const updated = { ...breakEntries };
    for (const date of activeDates) {
      updated[date] = [...(updated[date] ?? []), { start: quickFillStart, end: quickFillEnd }];
    }
    setBreakEntries(updated);
  };
  const handleSave = () => {
    if (!breakAgentCode) return;
    const entries = activeDates.map(date => ({
      agentCode: breakAgentCode,
      date,
      slots: (breakEntries[date] ?? [])
        .filter(s => s.start && s.end)
        .map(s => ({ breakStart: s.start, breakEnd: s.end })),
    }));
    upsertBreaks.mutate({ entries });
  };
  const weekLabel = (() => {
    const s = new Date(weekDates[0] + "T00:00:00");
    const e = new Date(weekDates[6] + "T00:00:00");
    return s.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " - " + e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();
  const monthLabel = new Date(monthY, monthM - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const totalSlots = Object.values(breakEntries).reduce((acc, slots) => acc + slots.length, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
          <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[180px]"
            value={breakCampaignId ?? ""}
            onChange={e => { setBreakCampaignId(e.target.value ? Number(e.target.value) : null); setBreakAgentCode(null); setBreakEntries({}); }}>
            <option value="">Select campaign...</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
          <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[200px]"
            value={breakAgentCode ?? ""}
            onChange={e => { setBreakAgentCode(e.target.value || null); setBreakEntries({}); }}
            disabled={!breakCampaignId}>
            <option value="">{breakCampaignId ? "Select agent..." : "Select campaign first"}</option>
            {campaignAgents.map(a => <option key={a.traineeCode} value={a.traineeCode}>{a.fullName} ({a.traineeCode})</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "weekly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => { setViewMode("weekly"); setBreakEntries({}); setSynced(null); }}>Weekly</button>
            <button className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "monthly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => { setViewMode("monthly"); setBreakEntries({}); setSynced(null); }}>Monthly</button>
          </div>
          {viewMode === "weekly" ? (
            <>
              <button className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                onClick={() => { setBreakWeekOffset(breakWeekOffset - 1); setBreakEntries({}); setSynced(null); }}>
                <ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
              <button className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                onClick={() => { setBreakWeekOffset(breakWeekOffset + 1); setBreakEntries({}); setSynced(null); }}>
                <ChevronRight className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <button className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                onClick={() => { const d = new Date(monthY, monthM - 2); setMonthYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setBreakEntries({}); setSynced(null); }}>
                <ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-medium min-w-[160px] text-center">{monthLabel}</span>
              <button className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                onClick={() => { const d = new Date(monthY, monthM); setMonthYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setBreakEntries({}); setSynced(null); }}>
                <ChevronRight className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </div>
      {!breakAgentCode ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a campaign and agent to manage their break schedule</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border p-4 bg-muted/30">
            <p className="text-sm font-medium mb-1">Quick Fill</p>
            <p className="text-xs text-muted-foreground mb-3">Add one break slot to all {activeDates.length} days at once. Existing breaks are preserved.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Break Start</label>
                <input type="time" className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={quickFillStart} onChange={e => setQuickFillStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Break End</label>
                <input type="time" className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={quickFillEnd} onChange={e => setQuickFillEnd(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={handleQuickFill} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Add to All Days
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {activeDates.map((date, dayIdx) => {
              const slots = breakEntries[date] ?? [];
              return (
                <div key={date} className="rounded-xl border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                    <span className="text-sm font-semibold">{formatDateLabel(date)}</span>
                    <button className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors" onClick={() => addBreakToDay(date)}>
                      <span className="text-base leading-none">+</span> Add Break
                    </button>
                  </div>
                  {slots.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic">No breaks scheduled</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-8">#</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Start</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">End</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Preview</th>
                          <th className="px-4 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((slot, slotIdx) => (
                          <tr key={slotIdx} className="border-b last:border-0">
                            <td className="px-4 py-2 text-xs text-muted-foreground">{slotIdx + 1}</td>
                            <td className="px-4 py-2">
                              <input type="time" className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm" value={slot.start} onChange={e => updateSlot(date, slotIdx, "start", e.target.value)} />
                            </td>
                            <td className="px-4 py-2">
                              <input type="time" className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm" value={slot.end} onChange={e => updateSlot(date, slotIdx, "end", e.target.value)} />
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {slot.start && slot.end ? `${to12h(slot.start)} - ${to12h(slot.end)}` : ""}
                            </td>
                            <td className="px-4 py-2">
                              <button className="text-red-500 hover:text-red-700 transition-colors" onClick={() => removeSlot(date, slotIdx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={upsertBreaks.isPending} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {upsertBreaks.isPending ? "Saving..." : `Save Break Schedule${totalSlots > 0 ? ` (${totalSlots} slot${totalSlots !== 1 ? "s" : ""})` : ""}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Operations() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"agents" | "campaigns" | "forecast" | "plan" | "breaks">("agents");
  // Break schedule state
  const [breakCampaignId, setBreakCampaignId] = useState<number | null>(null);
  const [breakAgentCode, setBreakAgentCode] = useState<string | null>(null);
  const [breakWeekOffset, setBreakWeekOffset] = useState(0);
  const [breakEntries, setBreakEntries] = useState<MultiBreakEntries>({});
  const [quickFillStart, setQuickFillStart] = useState("14:00");
  const [quickFillEnd, setQuickFillEnd] = useState("14:30");
  const upsertBreaks = trpc.breakSchedule.upsert.useMutation({
    onSuccess: () => { toast.success("Break schedule saved"); utils.breakSchedule.getByAgent.invalidate(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const [, navigate] = useLocation();
  const [planCampaignId, setPlanCampaignId] = useState<number | null>(null);
  const [planWeekOffset, setPlanWeekOffset] = useState(0);
  const { data: operationPlan, isLoading: loadingPlan } = trpc.campaigns.getOperationPlan.useQuery(
    { campaignId: planCampaignId!, weekOffset: planWeekOffset },
    { enabled: planCampaignId !== null }
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");

  // Data
  const { data: campaigns = [], isLoading: loadingCampaigns } = trpc.campaigns.list.useQuery();
  const { data: agents = [], isLoading: loadingAgents } = trpc.workforce.list.useQuery({
    campaignId: selectedCampaignId === "all" ? undefined : selectedCampaignId,
  });
  const [forecastCampaignId, setForecastCampaignId] = useState<number | null>(null);
  const { data: forecast = [], isLoading: loadingForecast } = trpc.campaigns.headcountForecast.useQuery(
    { campaignId: forecastCampaignId! },
    { enabled: forecastCampaignId !== null }
  );

  // Campaign CRUD
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign created"); setCampaignDialog(false); setCampaignForm(EMPTY_CAMPAIGN); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign updated"); setCampaignDialog(false); setEditingCampaign(null); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign deleted"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Agent edit
  const [editDialog, setEditDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<WorkforceAgent | null>(null);
  type EditForm = {
    fullName?: string; alias?: string; email?: string; phone?: string;
    campaignId?: string; shiftHours?: string; teamLeader?: string;
    offDay1?: string; offDay2?: string; joinDateStr?: string; isActive?: boolean;
    crdts?: string;
  };
  const [editForm, setEditForm] = useState<EditForm>({});
  const updateAgent = trpc.workforce.update.useMutation({
    onSuccess: () => { utils.workforce.list.invalidate(); toast.success("Agent updated"); setEditDialog(false); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Add Agent to Operations
  const [addAgentDialog, setAddAgentDialog] = useState(false);
  // Export modal state
  const EXPORT_COLUMNS = [
    { key: "traineeCode", label: "Agent Code" },
    { key: "fullName", label: "Full Name" },
    { key: "alias", label: "Alias" },
    { key: "crdts", label: "CRDTS" },
    { key: "campaignName", label: "Campaign" },
    { key: "shiftHours", label: "Shift Hours" },
    { key: "teamLeader", label: "Team Leader" },
    { key: "offDay1", label: "Off Day 1" },
    { key: "offDay2", label: "Off Day 2" },
    { key: "joinDate", label: "Join Date" },
    { key: "agentStatus", label: "Status" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "dialerCredentials", label: "Dialer Credentials" },
  ] as const;
  type ExportColumnKey = typeof EXPORT_COLUMNS[number]["key"];
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportCols, setSelectedExportCols] = useState<Set<ExportColumnKey>>(
    new Set(["fullName", "alias", "crdts"] as ExportColumnKey[])
  );
  function toggleExportCol(key: ExportColumnKey) {
    setSelectedExportCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function getAgentFieldValue(a: WorkforceAgent, key: ExportColumnKey): string {
    switch (key) {
      case "traineeCode": return a.traineeCode;
      case "fullName": return a.fullName;
      case "alias": return a.alias ?? "";
      case "crdts": return a.crdts ?? "";
      case "campaignName": return a.campaignName ?? "";
      case "shiftHours": return a.shiftHours ?? "";
      case "teamLeader": return a.teamLeader ?? "";
      case "offDay1": return a.offDay1 != null ? DAYS[a.offDay1] : "";
      case "offDay2": return a.offDay2 != null ? DAYS[a.offDay2] : "";
      case "joinDate": return a.joinDate ? new Date(a.joinDate).toLocaleDateString("en-US") : "";
      case "agentStatus": return a.agentStatus ?? "active";
      case "phone": return a.phone ?? "";
      case "email": return a.email ?? "";
      case "dialerCredentials": return a.dialerCredentials ?? "";
      default: return "";
    }
  }
  function runExport() {
    if (filteredAgents.length === 0) { toast.error("No agents to export"); return; }
    if (selectedExportCols.size === 0) { toast.error("Select at least one column"); return; }
    const orderedCols = EXPORT_COLUMNS.filter(c => selectedExportCols.has(c.key));
    const headers = orderedCols.map(c => c.label);
    const rows = (filteredAgents as WorkforceAgent[]).map(a => orderedCols.map(c => getAgentFieldValue(a, c.key)));
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url; a2.download = `agents-${new Date().toISOString().slice(0,10)}.csv`; a2.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredAgents.length} agents (${orderedCols.length} columns)`);
    setShowExportModal(false);
  }

  type AddAgentForm = { candidateId: string; traineeCode: string; fullName: string; alias: string; campaignId: string; shiftHours: string; teamLeader: string; offDay1: string; offDay2: string; dialerCredentials: string; };
  const EMPTY_ADD_FORM: AddAgentForm = { candidateId: '', traineeCode: '', fullName: '', alias: '', campaignId: '', shiftHours: '', teamLeader: '', offDay1: '', offDay2: '', dialerCredentials: '' };
  const [addAgentForm, setAddAgentForm] = useState<AddAgentForm>(EMPTY_ADD_FORM);
  const { data: eligibleCandidates = [] } = trpc.workforce.getEligibleCandidates.useQuery(undefined, { enabled: addAgentDialog });
  const createWorkforceAgent = trpc.workforce.create.useMutation({
    onSuccess: () => {
      utils.workforce.list.invalidate();
      toast.success('Agent added to Operations');
      setAddAgentDialog(false);
      setAddAgentForm(EMPTY_ADD_FORM);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  // Bulk Generate Credentials
  const [bulkCredDialog, setBulkCredDialog] = useState(false);
  const [bulkCredResults, setBulkCredResults] = useState<Array<{ fullName: string; traineeCode: string; password: string }>>([]);
  const bulkGenerateCreds = trpc.workforce.bulkGenerateCredentials.useMutation({
    onSuccess: (data) => {
      setBulkCredResults(data.credentials);
      toast.success(`Generated credentials for ${data.generated} agent(s)`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const downloadCredentialsCSV = () => {
    const header = "Agent Name,Agent Code,Password";
    const rows = bulkCredResults.map(r => `"${r.fullName}","${r.traineeCode}","${r.password}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tanis_agent_credentials.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Overtime alert
  const [overtimeDialog, setOvertimeDialog] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeCampaignId, setOvertimeCampaignId] = useState<number | null>(null);
  const [overtimeMessage, setOvertimeMessage] = useState("");
  const sendOvertimeAlert = trpc.campaigns.sendOvertimeAlert.useMutation({
    onSuccess: (data) => { toast.success(`Overtime alert sent to ${data.sent} agents`); setOvertimeDialog(false); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uniqueTLs = useMemo(() => {
    const tls = new Set<string>();
    (agents as WorkforceAgent[]).forEach(a => { if (a.teamLeader) tls.add(a.teamLeader); });
    return Array.from(tls).sort();
  }, [agents]);

  const filteredAgents = (agents as WorkforceAgent[]).filter(a => {
    const matchesSearch = a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.traineeCode.toLowerCase().includes(search.toLowerCase()) ||
      (a.alias ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTL = tlFilter === "all" || a.teamLeader === tlFilter;
    return matchesSearch && matchesTL;
  });

  const openEditAgent = (agent: WorkforceAgent) => {
    setEditingAgent(agent);
    setEditForm({
      fullName: agent.fullName ?? "",
      alias: agent.alias ?? "",
      email: agent.email ?? "",
      phone: agent.phone ?? "",
      campaignId: agent.campaignId?.toString() ?? "",
      shiftHours: agent.shiftHours ?? "",
      teamLeader: agent.teamLeader ?? "",
      offDay1: agent.offDay1?.toString() ?? "",
      offDay2: agent.offDay2?.toString() ?? "",
      joinDateStr: agent.joinDate ? new Date(agent.joinDate).toISOString().slice(0, 10) : "",
      isActive: agent.isActive,
      crdts: agent.crdts ?? "",
    });
    setEditDialog(true);
  };

  const handleSaveAgent = () => {
    if (!editingAgent) return;
    updateAgent.mutate({
      traineeCode: editingAgent.traineeCode,
      fullName: editForm.fullName || undefined,
      alias: editForm.alias || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      campaignId: editForm.campaignId ? Number(editForm.campaignId) : undefined,
      shiftHours: editForm.shiftHours || undefined,
      teamLeader: editForm.teamLeader || undefined,
      offDay1: editForm.offDay1 !== "" && editForm.offDay1 !== undefined ? Number(editForm.offDay1) : undefined,
      offDay2: editForm.offDay2 !== "" && editForm.offDay2 !== undefined ? Number(editForm.offDay2) : undefined,
      joinDate: editForm.joinDateStr ? new Date(editForm.joinDateStr).getTime() : undefined,
      isActive: editForm.isActive,
      crdts: editForm.crdts || undefined,
    });
  };

  const handleSaveCampaign = () => {
    if (!campaignForm.name.trim()) { toast.error("Campaign name required"); return; }
    if (editingCampaign) {
      updateCampaign.mutate({ id: editingCampaign.id, name: campaignForm.name.trim(), minHeadcount: Number(campaignForm.minHeadcount), workDays: campaignForm.workDays, notes: campaignForm.notes || undefined });
    } else {
      createCampaign.mutate({ name: campaignForm.name.trim(), minHeadcount: Number(campaignForm.minHeadcount), workDays: campaignForm.workDays, notes: campaignForm.notes || undefined });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage active workforce agents, campaigns, and headcount coverage
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => setOvertimeDialog(true)}
          >
            <Bell className="h-4 w-4" /> Overtime Alert
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditingCampaign(null);
              setCampaignForm(EMPTY_CAMPAIGN);
              setCampaignDialog(true);
            }}
          >
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Campaign summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedCampaignId === "all" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"}`}
          onClick={() => setSelectedCampaignId("all")}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">All Campaigns</span>
          </div>
          <div className="text-2xl font-bold">{(agents as WorkforceAgent[]).filter(a => a.isActive).length}</div>
          <div className="text-xs text-muted-foreground">active agents</div>
        </div>
        {(campaigns as Campaign[]).map(c => {
          const count = (agents as WorkforceAgent[]).filter(a => a.campaignId === c.id && a.isActive).length;
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedCampaignId === c.id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"}`}
              onClick={() => setSelectedCampaignId(c.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground truncate">{c.name}</span>
                <button
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground"
                  onClick={e => { e.stopPropagation(); setEditingCampaign(c); setCampaignForm({ name: c.name, minHeadcount: c.minHeadcount.toString(), workDays: c.workDays, notes: c.notes ?? "" }); setCampaignDialog(true); }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`text-xs font-medium ${count >= c.minHeadcount ? "text-emerald-600" : "text-amber-600"}`}>
                  {count >= c.minHeadcount ? <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> : <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                  min {c.minHeadcount}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[
          { id: "agents", label: "Agents", icon: Users },
          { id: "campaigns", label: "Campaigns", icon: Settings },
          { id: "forecast", label: "Headcount Forecast", icon: BarChart3 },
          { id: "plan", label: "Operation Plan", icon: Grid3X3 },
          { id: "breaks", label: "Break Schedule", icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID, or alias..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {uniqueTLs.length > 0 && (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={tlFilter}
                onChange={e => setTlFilter(e.target.value)}
              >
                <option value="all">All Team Leaders</option>
                {uniqueTLs.map(tl => <option key={tl} value={tl}>{tl}</option>)}
              </select>
            )}
            <span className="text-sm text-muted-foreground">{filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowExportModal(true)}>
                <Download className="h-3.5 w-3.5" /> Export...
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setBulkCredResults([]); setBulkCredDialog(true); }}>
                <RefreshCw className="h-3.5 w-3.5" /> Generate Credentials
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setAddAgentDialog(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add Agent
              </Button>
            </div>
          </div>

          {loadingAgents ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No agents found</p>
              <p className="text-sm mt-1">Transfer agents from Training once they pass mock call</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">CRDTS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Campaign</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Team Leader</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Off Days</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Join Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAgents.map(agent => (
                    <tr key={agent.traineeCode} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/operations/agents/${agent.traineeCode}`)}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{agent.fullName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{agent.traineeCode}</span>
                          {agent.alias && <span className="text-xs text-muted-foreground">({agent.alias})</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {agent.crdts ? (
                          <button
                            className="font-mono text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded cursor-pointer border border-transparent hover:border-border transition-colors"
                            title="Click to copy CRDTS"
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(String(agent.crdts)); toast.success("CRDTS copied!"); }}
                          >
                            {agent.crdts}
                          </button>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {agent.campaignName ? (
                          <Badge variant="outline" className="text-xs">{agent.campaignName}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{agent.teamLeader ?? "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex gap-1">
                          {agent.offDay1 !== null && agent.offDay1 !== undefined && (
                            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">{DAY_NAMES[agent.offDay1]}</span>
                          )}
                          {agent.offDay2 !== null && agent.offDay2 !== undefined && (
                            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">{DAY_NAMES[agent.offDay2]}</span>
                          )}
                          {(agent.offDay1 === null || agent.offDay1 === undefined) && (agent.offDay2 === null || agent.offDay2 === undefined) && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {agent.joinDate ? new Date(agent.joinDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {agent.agentStatus === "resigned" ? (
                            <Badge className="text-xs bg-red-100 text-red-700 border-red-200" variant="outline">Resigned</Badge>
                          ) : agent.agentStatus === "terminated" ? (
                            <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200" variant="outline">Terminated</Badge>
                          ) : agent.isActive ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Active</Badge>
                          ) : (
                            <Badge className="text-xs bg-muted text-muted-foreground" variant="outline">Inactive</Badge>
                          )}
                          {(() => {
                            if (agent.agentStatus === "resigned" || agent.agentStatus === "terminated") return null;
                            if (agent.joinDate) {
                              const daysSince = Math.floor((Date.now() - agent.joinDate) / 86400000);
                              if (daysSince <= 14) {
                                const daysLeft = 14 - daysSince;
                                return (
                                  <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300">
                                    🐣 Nesting ({daysLeft}d)
                                  </Badge>
                                );
                              }
                            }
                            if (agent.nestingStatus === "senior") {
                              return (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Senior</Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEditAgent(agent); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <div className="space-y-3">
          {loadingCampaigns ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
          ) : (campaigns as Campaign[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Settings className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No campaigns yet</p>
              <Button className="mt-4 gap-1.5" onClick={() => { setEditingCampaign(null); setCampaignForm(EMPTY_CAMPAIGN); setCampaignDialog(true); }}>
                <Plus className="h-4 w-4" /> Create First Campaign
              </Button>
            </div>
          ) : (
            (campaigns as Campaign[]).map(c => {
              const agentCount = (agents as WorkforceAgent[]).filter(a => a.campaignId === c.id && a.isActive).length;
              return (
                <div key={c.id} className="rounded-xl border p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{c.name}</span>
                      <Badge variant="outline" className="text-xs">{c.workDays === "all" ? "7 days" : "Weekdays"}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Min headcount: <strong className="text-foreground">{c.minHeadcount}</strong></span>
                      <span>Active agents: <strong className={agentCount >= c.minHeadcount ? "text-emerald-600" : "text-amber-600"}>{agentCount}</strong></span>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{c.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setForecastCampaignId(c.id); setActiveTab("forecast"); }}
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Forecast
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => { setEditingCampaign(c); setCampaignForm({ name: c.name, minHeadcount: c.minHeadcount.toString(), workDays: c.workDays, notes: c.notes ?? "" }); setCampaignDialog(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) deleteCampaign.mutate({ id: c.id }); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === "forecast" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={forecastCampaignId ?? ""}
              onChange={e => setForecastCampaignId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a campaign...</option>
              {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {forecastCampaignId && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => utils.campaigns.headcountForecast.invalidate({ campaignId: forecastCampaignId })}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            )}
          </div>

          {!forecastCampaignId ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p>Select a campaign to see the 30-day headcount forecast</p>
            </div>
          ) : loadingForecast ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Approved Leaves</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Projected</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(forecast as ForecastDay[]).map(day => {
                    const campaign = (campaigns as Campaign[]).find(c => c.id === forecastCampaignId);
                    const min = campaign?.minHeadcount ?? 0;
                    const isUnder = day.projected < min;
                    return (
                      <tr key={day.date} className={`hover:bg-muted/20 transition-colors ${isUnder ? "bg-red-50/50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs">{day.date}</td>
                        <td className="px-4 py-3 text-muted-foreground">{DAY_FULL[day.dayOfWeek]}</td>
                        <td className="px-4 py-3">{day.scheduled}</td>
                        <td className="px-4 py-3 text-amber-600">{day.approvedLeaves > 0 ? day.approvedLeaves : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${isUnder ? "text-red-600" : "text-emerald-600"}`}>{day.projected}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isUnder ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1" variant="outline">
                              <AlertTriangle className="h-3 w-3" /> Under {min - day.projected} short
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs" variant="outline">
                              <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> OK
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isUnder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                              onClick={() => {
                                setOvertimeCampaignId(forecastCampaignId);
                                setOvertimeDate(day.date);
                                setOvertimeMessage(`Overtime needed on ${day.date}. We are ${min - day.projected} agent(s) short. Are you available?`);
                                setOvertimeDialog(true);
                              }}
                            >
                              <Bell className="h-3 w-3" /> Alert
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Operation Plan Tab */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[180px]"
              value={planCampaignId ?? ""}
              onChange={e => { setPlanCampaignId(e.target.value ? Number(e.target.value) : null); setPlanWeekOffset(0); }}
            >
              <option value="">Select campaign...</option>
              {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {planCampaignId !== null && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPlanWeekOffset(o => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {operationPlan ? `Week of ${operationPlan.weekStart}` : `Week ${planWeekOffset >= 0 ? "+" : ""}${planWeekOffset}`}
                </span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPlanWeekOffset(o => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPlanWeekOffset(0)}>This Week</Button>
              </div>
            )}
          </div>

          {planCampaignId === null ? (
            <div className="text-center py-16 text-muted-foreground">
              <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">Select a campaign to view the operation plan</p>
            </div>
          ) : loadingPlan ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : !operationPlan || operationPlan.grid.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No agents in this campaign</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-sm sticky left-0 bg-muted/40 min-w-[160px]">Agent</th>
                      {operationPlan.weekDays.map(day => (
                        <th key={day.date} className="px-3 py-3 font-semibold text-center min-w-[72px]">
                          <div>{day.label}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">{day.date.slice(5)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {operationPlan.grid.map((agent, i) => (
                      <tr key={agent.traineeCode} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-4 py-2.5 sticky left-0 bg-inherit">
                          <div className="font-medium text-sm">{agent.alias ?? agent.fullName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{agent.traineeCode}</div>
                        </td>
                        {agent.days.map(day => (
                          <td key={day.date} className="px-3 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold"
                              style={{
                                background: day.status === "off" ? "#ef444422" : "#22c55e22",
                                color: day.status === "off" ? "#ef4444" : "#22c55e",
                              }}
                            >
                              {day.status === "off" ? "Off" : "On"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/40">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-sm sticky left-0 bg-muted/40">Daily Count</td>
                      {operationPlan.weekDays.map(day => {
                        const working = operationPlan.grid.filter(a => a.days.find(d => d.date === day.date)?.status === "work").length;
                        const min = (operationPlan.campaign as Campaign | null)?.minHeadcount ?? 0;
                        return (
                          <td key={day.date} className="px-3 py-2.5 text-center">
                            <span className={`font-bold text-sm ${working < min ? "text-red-600" : "text-emerald-600"}`}>{working}</span>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Break Schedule Tab */}
      {activeTab === "breaks" && (
        <BreakScheduleTab
          campaigns={campaigns as Campaign[]}
          agents={agents as WorkforceAgent[]}
          breakCampaignId={breakCampaignId}
          setBreakCampaignId={setBreakCampaignId}
          breakAgentCode={breakAgentCode}
          setBreakAgentCode={setBreakAgentCode}
          breakWeekOffset={breakWeekOffset}
          setBreakWeekOffset={setBreakWeekOffset}
          breakEntries={breakEntries}
          setBreakEntries={setBreakEntries}
          quickFillStart={quickFillStart}
          setQuickFillStart={setQuickFillStart}
          quickFillEnd={quickFillEnd}
          setQuickFillEnd={setQuickFillEnd}
          upsertBreaks={upsertBreaks}
        />
      )}
      {/* Edit Agent Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Agent — {editingAgent?.traineeCode}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <Input value={editForm.fullName ?? ""} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">English Alias</label>
              <Input value={editForm.alias ?? ""} onChange={e => setEditForm(f => ({ ...f, alias: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.campaignId ?? ""} onChange={e => setEditForm(f => ({ ...f, campaignId: e.target.value }))}>
                <option value="">No campaign</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CRDTS</label>
              <Input value={editForm.crdts ?? ""} onChange={e => setEditForm(f => ({ ...f, crdts: e.target.value }))} placeholder="Enter credentials" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Leader</label>
              <Input value={editForm.teamLeader ?? ""} onChange={e => setEditForm(f => ({ ...f, teamLeader: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Join Date</label>
              <Input type="date" value={editForm.joinDateStr ?? ""} onChange={e => setEditForm(f => ({ ...f, joinDateStr: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 1</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.offDay1 ?? ""} onChange={e => setEditForm(f => ({ ...f, offDay1: e.target.value }))}>
                <option value="">None</option>
                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 2</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.offDay2 ?? ""} onChange={e => setEditForm(f => ({ ...f, offDay2: e.target.value }))}>
                <option value="">None</option>
                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive ?? true}
                onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="isActive" className="text-sm font-medium">Active (working in operations)</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAgent} disabled={updateAgent.isPending}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign Name</label>
              <Input placeholder="e.g. CMPN-100" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Headcount / Day</label>
                <Input type="number" min={1} value={campaignForm.minHeadcount} onChange={e => setCampaignForm(f => ({ ...f, minHeadcount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Work Days</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={campaignForm.workDays} onChange={e => setCampaignForm(f => ({ ...f, workDays: e.target.value as "all" | "weekdays" }))}>
                  <option value="all">All 7 days</option>
                  <option value="weekdays">Weekdays only</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input placeholder="Any notes about this campaign..." value={campaignForm.notes} onChange={e => setCampaignForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCampaignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCampaign} disabled={createCampaign.isPending || updateCampaign.isPending}>
              {editingCampaign ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Agent to Operations Dialog */}
      <Dialog open={addAgentDialog} onOpenChange={(o) => { setAddAgentDialog(o); if (!o) setAddAgentForm(EMPTY_ADD_FORM); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" /> Add Agent to Operations</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-3 py-2.5 text-xs text-blue-800 dark:text-blue-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Only candidates with <strong>Accepted</strong> status appear here. To add an agent, go to the <strong>Candidates</strong> tab, find the candidate, and set their status to <em>Accepted</em> first.</span>
            </div>
            {/* Empty state when no eligible candidates */}
            {(eligibleCandidates as Array<{candidateId: number; traineeCode: string | null; name: string; phone: string | null; source: string}>).length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="text-sm font-medium text-muted-foreground">No accepted candidates available</p>
                <p className="text-xs text-muted-foreground/70">Go to the <strong>Candidates</strong> tab and accept a candidate first, then they will appear here.</p>
              </div>
            ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Candidate</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={addAgentForm.candidateId}
                onChange={e => {
                  const selected = (eligibleCandidates as Array<{candidateId: number; traineeCode: string | null; name: string; phone: string | null; source: string}>).find(c => c.candidateId === Number(e.target.value));
                  if (selected) {
                    setAddAgentForm(f => ({
                      ...f,
                      candidateId: String(selected.candidateId),
                      traineeCode: selected.traineeCode ?? "",
                      fullName: selected.name,
                    }));
                  } else {
                    setAddAgentForm(f => ({ ...f, candidateId: "", traineeCode: "", fullName: "" }));
                  }
                }}
              >
                <option value="">Select candidate...</option>
                {(eligibleCandidates as Array<{candidateId: number; traineeCode: string | null; name: string; phone: string | null; source: string}>).map(c => (
                  <option key={c.candidateId} value={c.candidateId}>
                    {c.name}{c.traineeCode ? ` (${c.traineeCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Trainee Code</label>
              <Input placeholder="e.g. TN-001" value={addAgentForm.traineeCode} onChange={e => setAddAgentForm(f => ({ ...f, traineeCode: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <Input placeholder="Full name" value={addAgentForm.fullName} onChange={e => setAddAgentForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">English Alias (optional)</label>
              <Input placeholder="e.g. Jordan" value={addAgentForm.alias} onChange={e => setAddAgentForm(f => ({ ...f, alias: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={addAgentForm.campaignId} onChange={e => setAddAgentForm(f => ({ ...f, campaignId: e.target.value }))}>
                <option value="">Select campaign...</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Hours</label>
                <Input placeholder="e.g. 9AM–5PM" value={addAgentForm.shiftHours} onChange={e => setAddAgentForm(f => ({ ...f, shiftHours: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Leader</label>
                <Input placeholder="Team leader name" value={addAgentForm.teamLeader} onChange={e => setAddAgentForm(f => ({ ...f, teamLeader: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Credentials</label>
              <Input placeholder="Dialer / hub credentials" value={addAgentForm.dialerCredentials} onChange={e => setAddAgentForm(f => ({ ...f, dialerCredentials: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 1</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={addAgentForm.offDay1} onChange={e => setAddAgentForm(f => ({ ...f, offDay1: e.target.value }))}>
                  <option value="">Select day...</option>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 2</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={addAgentForm.offDay2} onChange={e => setAddAgentForm(f => ({ ...f, offDay2: e.target.value }))}>
                  <option value="">Select day...</option>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddAgentDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={createWorkforceAgent.isPending || !addAgentForm.traineeCode || !addAgentForm.fullName || !addAgentForm.candidateId}
              onClick={() => {
                if (!addAgentForm.traineeCode.trim()) { toast.error("Trainee code required"); return; }
                if (!addAgentForm.fullName.trim()) { toast.error("Full name required"); return; }
                if (!addAgentForm.candidateId) { toast.error("Please select a candidate"); return; }
                createWorkforceAgent.mutate({
                  traineeCode: addAgentForm.traineeCode.trim(),
                  candidateId: Number(addAgentForm.candidateId),
                  fullName: addAgentForm.fullName.trim(),
                  alias: addAgentForm.alias || undefined,
                  campaignId: addAgentForm.campaignId ? Number(addAgentForm.campaignId) : undefined,
                  shiftHours: addAgentForm.shiftHours || undefined,
                  teamLeader: addAgentForm.teamLeader || undefined,
                  offDay1: addAgentForm.offDay1 !== "" ? Number(addAgentForm.offDay1) : undefined,
                  offDay2: addAgentForm.offDay2 !== "" ? Number(addAgentForm.offDay2) : undefined,
                  joinDate: Date.now(),
                  dialerCredentials: addAgentForm.dialerCredentials || undefined,
                });
              }}
            >
              <UserPlus className="h-4 w-4" /> Add to Operations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bulk Generate Credentials Dialog */}
      <Dialog open={bulkCredDialog} onOpenChange={(o) => { setBulkCredDialog(o); if (!o) setBulkCredResults([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-blue-600" /> Generate Agent Credentials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">This will generate portal login credentials for all Operations agents. Default password: <span className="font-mono font-semibold">Tanis2025</span>. Agents will be required to change their password on first login.</p>
            <div className="flex items-center gap-3">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                defaultValue=""
                id="bulk-cred-campaign"
              >
                <option value="">All campaigns</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button
                onClick={() => {
                  const sel = document.getElementById('bulk-cred-campaign') as HTMLSelectElement;
                  const cid = sel.value ? parseInt(sel.value) : undefined;
                  bulkGenerateCreds.mutate({ campaignId: cid });
                }}
                disabled={bulkGenerateCreds.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${bulkGenerateCreds.isPending ? 'animate-spin' : ''}`} />
                {bulkGenerateCreds.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            {bulkCredResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{bulkCredResults.length} credential(s) generated</span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCredentialsCSV}>
                    <ExternalLink className="h-3.5 w-3.5" /> Download CSV
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Agent Name</th>
                        <th className="text-left px-3 py-2 font-medium">Code</th>
                        <th className="text-left px-3 py-2 font-medium">Password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bulkCredResults.map(r => (
                        <tr key={r.traineeCode}>
                          <td className="px-3 py-2">{r.fullName}</td>
                          <td className="px-3 py-2 font-mono">{r.traineeCode}</td>
                          <td className="px-3 py-2 font-mono">{r.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkCredDialog(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overtime Alert Dialog */}
      <Dialog open={overtimeDialog} onOpenChange={setOvertimeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-amber-600" /> Send Overtime Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={overtimeCampaignId ?? ""} onChange={e => setOvertimeCampaignId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select campaign...</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Message to agents</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={overtimeMessage}
                onChange={e => setOvertimeMessage(e.target.value)}
                placeholder="Overtime needed on this date. Are you available?"
              />
            </div>
            <p className="text-xs text-muted-foreground">This will send a notification to all active agents in the selected campaign. They can respond with Available/Unavailable in their portal.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOvertimeDialog(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              disabled={!overtimeCampaignId || !overtimeDate || sendOvertimeAlert.isPending}
              onClick={() => {
                if (!overtimeCampaignId || !overtimeDate) return;
                sendOvertimeAlert.mutate({ campaignId: overtimeCampaignId, date: overtimeDate, message: overtimeMessage || undefined });
              }}
            >
              <Bell className="h-4 w-4" /> Send Alert
            </Button>
          </div>
        </DialogContent>

      {/* ── Export Modal ── */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Agents</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the columns to include. Exports <strong>{filteredAgents.length}</strong> agent{filteredAgents.length !== 1 ? "s" : ""} matching current filters.
            </p>
            {/* Select All / Clear All */}
            <div className="flex gap-2">
              <button
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setSelectedExportCols(new Set(EXPORT_COLUMNS.map(c => c.key)))}
              >Select All</button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setSelectedExportCols(new Set())}
              >Clear All</button>
            </div>
            {/* Column checkboxes */}
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={selectedExportCols.has(col.key)}
                    onCheckedChange={() => toggleExportCol(col.key)}
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
            </div>
            {/* Preview */}
            {selectedExportCols.size > 0 && (
              <p className="text-xs text-muted-foreground">
                Preview columns: {EXPORT_COLUMNS.filter(c => selectedExportCols.has(c.key)).map(c => c.label).join(", ")}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button size="sm" className="gap-1.5" onClick={runExport} disabled={selectedExportCols.size === 0}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </Dialog>
    </div>
  );
}
