import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Clock, CheckCircle, XCircle, Loader2, BarChart3, TrendingUp, Users, Calendar, Paperclip } from "lucide-react";
import { useEffect } from "react";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: "Leave",
  paid_leave: "Paid Leave",
  salary: "Salary Inquiry",
  schedule: "Schedule Change",
  complaint: "General Complaint",
  resignation: "Resignation",
  day_off: "Unpaid Day Off",
  sick_note: "Sick Note",
  hr_letter: "HR Letter",
  other: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending:     { label: "Pending",     className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  in_progress: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200",       icon: Loader2 },
  resolved:    { label: "Resolved",    className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  rejected:    { label: "Rejected",    className: "bg-red-50 text-red-700 border-red-200",           icon: XCircle },
};

type AgentRequest = {
  id: number;
  candidateId: number;
  traineeCode: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  requestedDate: number | null;
  requestedDates: string | null; // JSON array of date strings
  attachmentUrl: string | null;
  hrLetterPurpose: string | null;
  hrLetterLanguage: string | null;
  isAdminRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const BRAND = "oklch(0.32 0.18 28)";

export default function Requests() {
  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.requests.listAll.useQuery();
  const markAllReadMutation = trpc.requests.markAllRead.useMutation({
    onSuccess: () => utils.requests.countUnread.invalidate(),
  });

  // Mark all requests as read when admin opens this page
  useEffect(() => {
    markAllReadMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMutation = trpc.requests.updateStatus.useMutation({
    onSuccess: () => {
      utils.requests.listAll.invalidate();
      toast.success("Request updated");
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<AgentRequest | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  function openRequest(req: AgentRequest) {
    setSelected(req);
    setReplyText(req.adminReply ?? "");
    setNewStatus(req.status);
  }

  function handleUpdate() {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      status: newStatus as "pending" | "in_progress" | "resolved" | "rejected",
      adminReply: replyText.trim() || undefined,
    });
  }

  const reqs = requests as AgentRequest[];

  const counts = {
    all: reqs.length,
    pending: reqs.filter((r) => r.status === "pending").length,
    in_progress: reqs.filter((r) => r.status === "in_progress").length,
    resolved: reqs.filter((r) => r.status === "resolved").length,
    rejected: reqs.filter((r) => r.status === "rejected").length,
  };

  // Analytics: requests by type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    reqs.forEach((r) => { map[r.type] = (map[r.type] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [reqs]);

  // Analytics: avg resolution time (resolved requests)
  const avgResolutionHours = useMemo(() => {
    const resolved = reqs.filter((r) => r.status === "resolved");
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, r) => sum + (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()), 0);
    return Math.round(totalMs / resolved.length / 3600000);
  }, [reqs]);

  // Analytics: unique agents who submitted
  const uniqueAgents = useMemo(() => new Set(reqs.map((r) => r.traineeCode)).size, [reqs]);

  const filtered = reqs
    .filter((r) => filterStatus === "all" || r.status === filterStatus)
    .filter((r) => filterType === "all" || r.type === filterType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
            <Inbox className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Request Center</h1>
            <p className="text-xs text-muted-foreground">Agent requests and inquiries</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {counts.pending} pending
        </Badge>
      </div>

      {/* ── Analytics Panel ── */}
      {reqs.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Analytics</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{uniqueAgents}</p>
                <p className="text-xs text-muted-foreground">Agents</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <TrendingUp className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">
                  {reqs.length > 0 ? Math.round((counts.resolved / reqs.length) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Resolution Rate</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">
                  {avgResolutionHours !== null ? `${avgResolutionHours}h` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg Resolution</p>
              </div>
            </div>
            {/* By type breakdown */}
            {byType.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Requests by Type</p>
                <div className="space-y-1.5">
                  {byType.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{REQUEST_TYPE_LABELS[type] ?? type}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / reqs.length) * 100}%`, background: BRAND }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["pending", "in_progress", "resolved", "rejected"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                filterStatus === s ? cfg.className + " shadow-sm" : "bg-card border-border"
              }`}
            >
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts[s]}</p>
            </button>
          );
        })}
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter by type:</span>
        {["all", ...Object.keys(REQUEST_TYPE_LABELS)].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filterType === t
                ? "text-white border-transparent"
                : "bg-card border-border text-muted-foreground hover:border-foreground/30"
            }`}
            style={filterType === t ? { background: BRAND } : {}}
          >
            {t === "all" ? "All Types" : REQUEST_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Loading requests...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            return (
              <Card
                key={req.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => openRequest(req)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground">{req.traineeCode}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
                        {req.requestedDate && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(req.requestedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="font-semibold text-foreground text-sm truncate">{req.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  {req.adminReply && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <span className="font-medium">Reply:</span> {req.adminReply}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Schedule Change Approvals ── */}
      <ScheduleChangeApprovals />

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="bg-muted rounded px-2 py-0.5 font-medium">{selected.traineeCode}</span>
                <span className="bg-muted rounded px-2 py-0.5">{REQUEST_TYPE_LABELS[selected.type] ?? selected.type}</span>
                <span className="bg-muted rounded px-2 py-0.5">
                  {new Date(selected.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {selected.requestedDate && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {selected.type === "resignation" ? "Last day: " : "Requested: "}
                    {new Date(selected.requestedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {selected.requestedDates && (() => {
                  try {
                    const dates: string[] = JSON.parse(selected.requestedDates);
                    return dates.map((d) => (
                      <span key={d} className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ));
                  } catch { return null; }
                })()}
              </div>

              {/* HR Letter Details */}
              {selected.type === "hr_letter" && (selected.hrLetterPurpose || selected.hrLetterLanguage) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">HR Letter Details</p>
                  {selected.hrLetterPurpose && (
                    <p className="text-sm text-blue-900"><span className="font-medium">Purpose:</span> {selected.hrLetterPurpose}</p>
                  )}
                  {selected.hrLetterLanguage && (
                    <p className="text-sm text-blue-900"><span className="font-medium">Language:</span> {selected.hrLetterLanguage === "arabic" ? "Arabic" : "English"}</p>
                  )}
                </div>
              )}

              {/* Message */}
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
              </div>

              {/* Attachment */}
              {selected.attachmentUrl && (
                <a
                  href={selected.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Paperclip className="w-4 h-4" />
                  View attachment
                </a>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Update Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reply */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reply to Agent</label>
                <Textarea
                  placeholder="Write a reply that the agent will see in their portal..."
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              style={{ background: BRAND }}
              className="text-white hover:opacity-90"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_peer:    { label: "Awaiting Peer",   color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  pending_manager: { label: "Awaiting Admin",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  approved:        { label: "Approved",         color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:        { label: "Rejected",         color: "bg-red-50 text-red-700 border-red-200" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ScReq = {
  id: number;
  requesterCode: string;
  targetCode: string;
  requesterNewOff1: number;
  requesterNewOff2: number;
  targetNewOff1: number;
  targetNewOff2: number;
  message: string | null;
  status: string;
  createdAt: Date;
};

function ScheduleChangeApprovals() {
  const utils = trpc.useUtils();
  const { data: allReqs = [] } = trpc.scheduleChange.listAll.useQuery();
  const managerApprove = trpc.scheduleChange.managerApprove.useMutation({
    onSuccess: () => { utils.scheduleChange.listAll.invalidate(); toast.success("Schedule change approved"); },
    onError: (e) => toast.error(e.message),
  });
  const managerReject = trpc.scheduleChange.managerApprove.useMutation({
    onSuccess: () => { utils.scheduleChange.listAll.invalidate(); toast.success("Schedule change rejected"); },
    onError: (e) => toast.error(e.message),
  });

  const typed = allReqs as ScReq[];
  const pendingManager = typed.filter(r => r.status === "pending_manager");
  const recent = typed.filter(r => r.status === "approved" || r.status === "rejected").slice(0, 5);

  if (typed.length === 0) return null;

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Schedule Change Requests</CardTitle>
          </div>
          {pendingManager.length > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              {pendingManager.length} awaiting approval
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        {pendingManager.length === 0 && recent.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No schedule change requests yet.</p>
        )}
        {pendingManager.map(r => (
          <div key={r.id} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{r.requesterCode}</span>
                <span className="text-xs text-muted-foreground">↔</span>
                <span className="text-sm font-semibold text-foreground">{r.targetCode}</span>
              </div>
              <Badge variant="outline" className={`text-xs ${SC_STATUS_LABELS[r.status]?.color}`}>
                {SC_STATUS_LABELS[r.status]?.label ?? r.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="bg-white rounded px-2 py-1.5 border border-border">
                <p className="font-medium text-foreground mb-0.5">{r.requesterCode} new off days</p>
                <p>{DAY_NAMES[r.requesterNewOff1]} · {DAY_NAMES[r.requesterNewOff2]}</p>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border border-border">
                <p className="font-medium text-foreground mb-0.5">{r.targetCode} new off days</p>
                <p>{DAY_NAMES[r.targetNewOff1]} · {DAY_NAMES[r.targetNewOff2]}</p>
              </div>
            </div>
            {r.message && (
              <p className="text-xs text-muted-foreground italic">"{r.message}"</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Submitted {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              &nbsp;· Peer approved ✓
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => managerApprove.mutate({ id: r.id, approve: true })}
                disabled={managerApprove.isPending}
                className="text-white text-xs h-7"
                style={{ background: BRAND }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => managerReject.mutate({ id: r.id, approve: false })}
                disabled={managerReject.isPending}
                className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
        {recent.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent</p>
            <div className="space-y-1.5">
              {recent.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{r.requesterCode} ↔ {r.targetCode}</span>
                  <Badge variant="outline" className={`text-[10px] ${SC_STATUS_LABELS[r.status]?.color}`}>
                    {SC_STATUS_LABELS[r.status]?.label ?? r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
