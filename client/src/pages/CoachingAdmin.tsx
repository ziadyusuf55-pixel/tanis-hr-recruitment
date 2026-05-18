import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Filter, Clock, TrendingUp, User, Calendar,
  ChevronRight, AlertTriangle, CheckCircle2, XCircle, ArrowRight,
  Trash2, Edit3,
} from "lucide-react";
import { toast } from "sonner";

const COACHING_STATUSES = [
  "pending", "in_progress", "improved", "no_change", "escalated", "terminated",
] as const;
type CoachingStatus = typeof COACHING_STATUSES[number];

const STATUS_CONFIG: Record<CoachingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: "Pending",     color: "bg-amber-100 text-amber-800 border-amber-200",    icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <ArrowRight className="w-3 h-3" /> },
  improved:    { label: "Improved",    color: "bg-green-100 text-green-800 border-green-200",    icon: <CheckCircle2 className="w-3 h-3" /> },
  no_change:   { label: "No Change",   color: "bg-gray-100 text-gray-700 border-gray-200",       icon: <AlertTriangle className="w-3 h-3" /> },
  escalated:   { label: "Escalated",   color: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> },
  terminated:  { label: "Terminated",  color: "bg-red-100 text-red-800 border-red-200",          icon: <XCircle className="w-3 h-3" /> },
};

const NESTING_LABELS = ["Nesting", "Active", "Senior"];

function getCurrentCycleKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPastCycles(n = 6) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

// ─── New Case Dialog ──────────────────────────────────────────────────────────
interface NewCaseDialogProps {
  open: boolean;
  onClose: () => void;
  cycleKey: string;
  currentUser: string;
}

function NewCaseDialog({ open, onClose, cycleKey, currentUser }: NewCaseDialogProps) {
  const utils = trpc.useUtils();
  const { data: agents = [] } = trpc.workforce.list.useQuery({});
  const createCase = trpc.coachingCases.create.useMutation({
    onSuccess: () => {
      utils.coachingCases.list.invalidate();
      toast.success("Coaching case created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const [agentId, setAgentId] = useState<string>("");
  const [assignedBy, setAssignedBy] = useState(currentUser);
  const [followUpDate, setFollowUpDate] = useState("");
  const [coachingReason, setCoachingReason] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [afterCoaching, setAfterCoaching] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const selectedAgent = agents.find((a) => String(a.id) === agentId);

  function handleSubmit() {
    if (!agentId || !coachingReason.trim()) {
      toast.error("Select an agent and enter a coaching reason.");
      return;
    }
    createCase.mutate({
      agentId: Number(agentId),
      agentCrdts: selectedAgent?.crdts ?? "",
      agentAlias: selectedAgent?.alias ?? undefined,
      nestingLabel: (selectedAgent as { nestingStatus?: string })?.nestingStatus ?? undefined,
      assignedBy: assignedBy || currentUser,
      cycleKey,
      followUpDate: followUpDate || undefined,
      coachingReason,
      whatHappened: whatHappened || undefined,
      afterCoaching: afterCoaching || undefined,
      nextSteps: nextSteps || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            New Coaching Case — {cycleKey}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Agent <span className="text-destructive">*</span></Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select from Operations…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.fullName} {a.crdts ? `(${a.crdts})` : ""}
                      {(a as { nestingStatus?: string }).nestingStatus ? ` · ${(a as { nestingStatus?: string }).nestingStatus}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned By</Label>
              <Input value={assignedBy} onChange={(e) => setAssignedBy(e.target.value)} placeholder="Manager / TL name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Follow-up Date</Label>
            <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Coaching Reason <span className="text-destructive">*</span></Label>
            <Textarea value={coachingReason} onChange={(e) => setCoachingReason(e.target.value)}
              placeholder="What triggered this coaching session? (e.g. low revenue, attendance issue, quality violation)" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>What Happened</Label>
            <Textarea value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)}
              placeholder="Notes from the session itself…" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>After Coaching</Label>
            <Textarea value={afterCoaching} onChange={(e) => setAfterCoaching(e.target.value)}
              placeholder="Observed improvement, agent response, attitude…" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Next Steps</Label>
            <Textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)}
              placeholder="Action items, follow-up tasks…" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createCase.isPending}>
            {createCase.isPending ? "Creating…" : "Create Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Case Detail Dialog ───────────────────────────────────────────────────────
interface CaseDetailDialogProps {
  caseId: number | null;
  onClose: () => void;
  currentUser: string;
}

function CaseDetailDialog({ caseId, onClose, currentUser }: CaseDetailDialogProps) {
  const utils = trpc.useUtils();
  const [editMode, setEditMode] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<CoachingStatus>("pending");
  const [statusNote, setStatusNote] = useState("");
  const [editFields, setEditFields] = useState({
    coachingReason: "", whatHappened: "", afterCoaching: "", nextSteps: "", followUpDate: "",
  });
  const [synced, setSynced] = useState(false);

  const { data: caseData, isLoading } = trpc.coachingCases.getById.useQuery(
    { id: caseId! }, { enabled: !!caseId }
  );

  if (caseData && !synced) {
    setEditFields({
      coachingReason: caseData.coachingReason ?? "",
      whatHappened: caseData.whatHappened ?? "",
      afterCoaching: caseData.afterCoaching ?? "",
      nextSteps: caseData.nextSteps ?? "",
      followUpDate: caseData.followUpDate ?? "",
    });
    setSynced(true);
  }

  const updateCase = trpc.coachingCases.update.useMutation({
    onSuccess: () => {
      utils.coachingCases.getById.invalidate({ id: caseId! });
      utils.coachingCases.list.invalidate();
      setEditMode(false);
      toast.success("Case updated");
    },
  });

  const updateStatus = trpc.coachingCases.updateStatus.useMutation({
    onSuccess: () => {
      utils.coachingCases.getById.invalidate({ id: caseId! });
      utils.coachingCases.list.invalidate();
      setStatusDialogOpen(false);
      setStatusNote("");
      toast.success("Status updated");
    },
  });

  const deleteCase = trpc.coachingCases.delete.useMutation({
    onSuccess: () => {
      utils.coachingCases.list.invalidate();
      onClose();
      toast.success("Case deleted");
    },
  });

  if (!caseId) return null;
  const snap = caseData?.performanceSnapshot;
  const statusCfg = caseData ? STATUS_CONFIG[caseData.status as CoachingStatus] : null;

  return (
    <>
      <Dialog open={!!caseId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : caseData ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-lg">
                      {caseData.agentAlias ?? caseData.agentCrdts}
                      {caseData.nestingLabel && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">· {caseData.nestingLabel}</span>
                      )}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      CRDTS: {caseData.agentCrdts} · Cycle: {caseData.cycleKey} · Assigned by: {caseData.assignedBy}
                    </p>
                  </div>
                  {statusCfg && (
                    <Badge className={`${statusCfg.color} border flex items-center gap-1 shrink-0`}>
                      {statusCfg.icon} {statusCfg.label}
                    </Badge>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-5 py-2">
                {snap && (
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Performance Snapshot — {caseData.cycleKey}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Revenue",   value: `$${snap.totalRevenue.toFixed(0)}`,    color: "text-green-600" },
                        { label: "Calls",     value: String(snap.totalCalls),               color: "" },
                        { label: "Login Hrs", value: snap.totalLoginHours.toFixed(1),       color: "" },
                        { label: "Rev/Hr",    value: `$${snap.avgRevPerHr.toFixed(2)}`,     color: "" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`text-base font-bold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {caseData.qualityScore !== null && caseData.qualityScore !== undefined && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Latest Quality Score:</span>
                        <span className={`font-semibold ${(caseData.qualityScore ?? 0) >= 80 ? "text-green-600" : "text-red-600"}`}>
                          {(caseData.qualityScore ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {snap.days === 0 && <p className="text-xs text-muted-foreground mt-1">No cycle stats yet for this cycle.</p>}
                  </div>
                )}
                {caseData.followUpDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Follow-up: <span className="font-medium text-foreground">{caseData.followUpDate}</span>
                  </div>
                )}
                <Separator />
                {editMode ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Follow-up Date</Label>
                      <Input type="date" value={editFields.followUpDate}
                        onChange={(e) => setEditFields(f => ({ ...f, followUpDate: e.target.value }))} />
                    </div>
                    {(["coachingReason", "whatHappened", "afterCoaching", "nextSteps"] as const).map((field) => {
                      const labels: Record<string, string> = {
                        coachingReason: "Coaching Reason",
                        whatHappened: "What Happened",
                        afterCoaching: "After Coaching",
                        nextSteps: "Next Steps",
                      };
                      return (
                        <div key={field} className="space-y-1.5">
                          <Label>{labels[field]}</Label>
                          <Textarea rows={3} value={editFields[field]}
                            onChange={(e) => setEditFields(f => ({ ...f, [field]: e.target.value }))} />
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateCase.mutate({ id: caseId!, ...editFields })} disabled={updateCase.isPending}>
                        {updateCase.isPending ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: "Coaching Reason", value: caseData.coachingReason },
                      { label: "What Happened",   value: caseData.whatHappened },
                      { label: "After Coaching",  value: caseData.afterCoaching },
                      { label: "Next Steps",      value: caseData.nextSteps },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-sm whitespace-pre-wrap">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status Timeline</p>
                  <div className="space-y-2">
                    {(caseData.statusLog ?? []).map((log, i) => {
                      const cfg = STATUS_CONFIG[log.toStatus as CoachingStatus];
                      return (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className={`mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg?.color ?? "bg-gray-100 text-gray-700"}`}>
                            {cfg?.icon} {cfg?.label ?? log.toStatus}
                          </div>
                          <div className="flex-1 min-w-0">
                            {log.note && <p className="text-foreground">{log.note}</p>}
                            <p className="text-xs text-muted-foreground">
                              {log.changedBy ? `by ${log.changedBy} · ` : ""}
                              {new Date(log.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="destructive" size="sm"
                  onClick={() => { if (confirm("Delete this coaching case?")) deleteCase.mutate({ id: caseId! }); }}
                  disabled={deleteCase.isPending}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditMode(!editMode); setSynced(false); }}>
                  <Edit3 className="w-4 h-4 mr-1" /> {editMode ? "View" : "Edit"}
                </Button>
                <Button size="sm" onClick={() => { setNewStatus(caseData.status as CoachingStatus); setStatusDialogOpen(true); }}>
                  Change Status
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Case not found.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={(v) => !v && setStatusDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as CoachingStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COACHING_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Reason for this status change…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => updateStatus.mutate({ id: caseId!, status: newStatus, note: statusNote || undefined, changedBy: currentUser })}
              disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Saving…" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoachingAdmin() {
  const { data: me } = trpc.auth.me.useQuery();
  const currentUser = me?.name ?? "Admin";
  const cycles = useMemo(() => getPastCycles(6), []);
  const [cycleKey, setCycleKey] = useState(getCurrentCycleKey);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nestingFilter, setNestingFilter] = useState<string>("all");
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);

  const { data: cases = [], isLoading } = trpc.coachingCases.list.useQuery({
    cycleKey,
    status: statusFilter !== "all" ? statusFilter : undefined,
    nestingLabel: nestingFilter !== "all" ? nestingFilter : undefined,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter((c) =>
      c.agentCrdts.toLowerCase().includes(q) ||
      (c.agentAlias ?? "").toLowerCase().includes(q) ||
      c.assignedBy.toLowerCase().includes(q) ||
      c.coachingReason.toLowerCase().includes(q)
    );
  }, [cases, search]);

  const kpis = useMemo(() => ({
    total:      cases.length,
    pending:    cases.filter((c) => c.status === "pending").length,
    inProgress: cases.filter((c) => c.status === "in_progress").length,
    improved:   cases.filter((c) => c.status === "improved").length,
  }), [cases]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Coaching Cases</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Admin-only · Internal coaching records for Operations agents</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={cycleKey} onValueChange={setCycleKey}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cycles.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setNewCaseOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Case
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Cases",  value: kpis.total,      color: "text-foreground" },
            { label: "Pending",      value: kpis.pending,    color: "text-amber-600" },
            { label: "In Progress",  value: kpis.inProgress, color: "text-blue-600" },
            { label: "Improved",     value: kpis.improved,   color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by CRDTS, alias, assigned by, reason…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {COACHING_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={nestingFilter} onValueChange={setNestingFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {NESTING_LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Cases List */}
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading coaching cases…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No coaching cases for {cycleKey}.</p>
            <Button className="mt-4" onClick={() => setNewCaseOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create First Case
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const cfg = STATUS_CONFIG[c.status as CoachingStatus];
              return (
                <div key={c.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedCaseId(c.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.agentAlias ?? c.agentCrdts}</span>
                      <span className="text-xs text-muted-foreground">{c.agentCrdts}</span>
                      {c.nestingLabel && <Badge variant="outline" className="text-xs">{c.nestingLabel}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{c.coachingReason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Assigned by: {c.assignedBy}</span>
                      {c.followUpDate && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {c.followUpDate}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {cfg && (
                      <Badge className={`${cfg.color} border flex items-center gap-1 text-xs`}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewCaseDialog open={newCaseOpen} onClose={() => setNewCaseOpen(false)} cycleKey={cycleKey} currentUser={currentUser} />
      <CaseDetailDialog caseId={selectedCaseId} onClose={() => setSelectedCaseId(null)} currentUser={currentUser} />
    </DashboardLayout>
  );
}
