import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BookOpen, Search, TrendingDown, TrendingUp, Users, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { toast } from "sonner";

const BRAND = "#8B1A1A";

type AgentStat = {
  crdts: string;
  agentCode: string | null;
  alias: string | null;
  totalRevenue: number;
  totalCalls: number;
  totalLoginHours: number;
  totalProfit: number;
  totalRevPerHr: number;
  days: number;
  avgRevPerHr: number;
};

type SortKey = "totalRevenue" | "totalCalls" | "avgRevPerHr" | "totalLoginHours" | "totalProfit";

function getCycleOptions() {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options;
}

function formatCycleLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function CoachingAdmin() {
  const cycles = getCycleOptions();
  const [selectedCycle, setSelectedCycle] = useState(cycles[0]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortAsc, setSortAsc] = useState(true);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [coachDialog, setCoachDialog] = useState<AgentStat | null>(null);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    coachingHours: "1",
    bonusAmount: "0",
    sessionType: "performance",
    notes: "",
  });

  const utils = trpc.useUtils();

  const { data: teamStats = [], isLoading } = trpc.cycleTracker.getTeamStats.useQuery(
    { cycleKey: selectedCycle },
    { enabled: !!selectedCycle }
  );

  const { data: coachingSessions = [] } = trpc.coaching.listByCycle.useQuery(
    { cycleKey: selectedCycle },
    { enabled: !!selectedCycle }
  );

  const addSession = trpc.coaching.upload.useMutation({
    onSuccess: () => {
      utils.coaching.listByCycle.invalidate({ cycleKey: selectedCycle });
      toast.success("Coaching session logged");
      setCoachDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.coaching.updateStatus.useMutation({
    onSuccess: () => {
      utils.coaching.listByCycle.invalidate({ cycleKey: selectedCycle });
      toast.success("Status updated");
    },
  });

  // Compute team averages for low-performer threshold
  const teamAvgRevenue = useMemo(() => {
    if (!teamStats.length) return 0;
    return teamStats.reduce((s, a) => s + a.totalRevenue, 0) / teamStats.length;
  }, [teamStats]);

  const teamAvgRevPerHr = useMemo(() => {
    if (!teamStats.length) return 0;
    return teamStats.reduce((s, a) => s + a.avgRevPerHr, 0) / teamStats.length;
  }, [teamStats]);

  // Sessions map by crdts
  const sessionsByCrdts = useMemo(() => {
    const map = new Map<string, typeof coachingSessions>();
    for (const s of coachingSessions) {
      const arr = map.get(s.crdts) ?? [];
      arr.push(s);
      map.set(s.crdts, arr);
    }
    return map;
  }, [coachingSessions]);

  // Filter + sort
  const displayed = useMemo(() => {
    let list = [...(teamStats as AgentStat[])];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.crdts ?? "").toLowerCase().includes(q) ||
        (a.alias ?? "").toLowerCase().includes(q) ||
        (a.agentCode ?? "").toLowerCase().includes(q)
      );
    }
    if (showLowOnly) {
      list = list.filter(a => a.totalRevenue < teamAvgRevenue * 0.8 || a.avgRevPerHr < teamAvgRevPerHr * 0.8);
    }
    list.sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [teamStats, search, showLowOnly, sortKey, sortAsc, teamAvgRevenue, teamAvgRevPerHr]);

  const lowPerformerCount = useMemo(() =>
    (teamStats as AgentStat[]).filter(a => a.totalRevenue < teamAvgRevenue * 0.8 || a.avgRevPerHr < teamAvgRevPerHr * 0.8).length,
    [teamStats, teamAvgRevenue, teamAvgRevPerHr]
  );

  const coachedCount = useMemo(() =>
    new Set(coachingSessions.map(s => s.crdts)).size,
    [coachingSessions]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  function isLowPerformer(a: AgentStat) {
    return a.totalRevenue < teamAvgRevenue * 0.8 || a.avgRevPerHr < teamAvgRevPerHr * 0.8;
  }

  function openCoachDialog(agent: AgentStat) {
    setSessionForm({
      sessionDate: new Date().toISOString().split("T")[0],
      coachingHours: "1",
      bonusAmount: "0",
      sessionType: "performance",
      notes: "",
    });
    setCoachDialog(agent);
  }

  function submitSession() {
    if (!coachDialog) return;
    addSession.mutate({
      cycleKey: selectedCycle,
      sessions: [{
        crdts: coachDialog.crdts,
        agentCode: coachDialog.agentCode ?? undefined,
        alias: coachDialog.alias ?? undefined,
        sessionDate: sessionForm.sessionDate,
        coachingHours: parseFloat(sessionForm.coachingHours) || 0,
        bonusAmount: parseFloat(sessionForm.bonusAmount) || 0,
        sessionType: sessionForm.sessionType,
        notes: sessionForm.notes || undefined,
      }],
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" style={{ color: BRAND }} />
            Coaching Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Identify low performers and log coaching sessions</p>
        </div>
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycles.map(c => (
              <SelectItem key={c} value={c}>{formatCycleLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">{teamStats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low Performers</p>
                <p className="text-2xl font-bold text-red-600">{lowPerformerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coached This Cycle</p>
                <p className="text-2xl font-bold text-emerald-600">{coachedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{coachingSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by CRDTS, alias, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <button
          onClick={() => setShowLowOnly(v => !v)}
          className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            showLowOnly
              ? "bg-red-600 border-red-600 text-white"
              : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-red-300 hover:bg-red-50"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Low Performers Only
          {lowPerformerCount > 0 && (
            <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${showLowOnly ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
              {lowPerformerCount}
            </span>
          )}
        </button>
        <p className="text-xs text-muted-foreground ml-auto">
          Team avg: <strong>${teamAvgRevenue.toFixed(0)}</strong> rev · <strong>${teamAvgRevPerHr.toFixed(2)}</strong>/hr
        </p>
      </div>

      {/* Agent Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {formatCycleLabel(selectedCycle)} — {displayed.length} agent{displayed.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading stats...</div>
          ) : displayed.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No stats found for {formatCycleLabel(selectedCycle)}.</p>
              <p className="text-xs mt-1">Upload stats in the Cycle Tracker first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Agent</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("totalRevenue")}>
                      <span className="flex items-center justify-end gap-1">Revenue <SortIcon k="totalRevenue" /></span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("totalCalls")}>
                      <span className="flex items-center justify-end gap-1">Calls <SortIcon k="totalCalls" /></span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("totalLoginHours")}>
                      <span className="flex items-center justify-end gap-1">Login Hrs <SortIcon k="totalLoginHours" /></span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("avgRevPerHr")}>
                      <span className="flex items-center justify-end gap-1">Rev/Hr <SortIcon k="avgRevPerHr" /></span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Coaching</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((agent, i) => {
                    const sessions = sessionsByCrdts.get(agent.crdts) ?? [];
                    const approvedCount = sessions.filter(s => s.status === "approved").length;
                    const isLow = isLowPerformer(agent);
                    return (
                      <tr key={agent.crdts} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"} ${isLow ? "bg-red-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <div>
                              <div className="font-medium text-xs">{agent.alias ?? agent.crdts}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{agent.crdts}</div>
                              {agent.agentCode && <div className="text-[10px] text-muted-foreground">{agent.agentCode}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={agent.totalRevenue < teamAvgRevenue * 0.8 ? "text-red-600" : ""}>
                            ${agent.totalRevenue.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{agent.totalCalls.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{agent.totalLoginHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right">
                          <span className={agent.avgRevPerHr < teamAvgRevPerHr * 0.8 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            ${agent.avgRevPerHr.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sessions.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {sessions.slice(0, 2).map(s => (
                                <div key={s.id} className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={`text-[10px] ${
                                    s.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    s.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>{s.status}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{s.sessionDate}</span>
                                  {s.status === "pending" && (
                                    <div className="flex gap-0.5 ml-1">
                                      <button
                                        className="text-[10px] text-emerald-600 hover:underline"
                                        onClick={() => updateStatus.mutate({ id: s.id, status: "approved" })}
                                      >✓</button>
                                      <button
                                        className="text-[10px] text-red-600 hover:underline ml-1"
                                        onClick={() => updateStatus.mutate({ id: s.id, status: "rejected" })}
                                      >✗</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {sessions.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{sessions.length - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => openCoachDialog(agent)}
                          >
                            <BookOpen className="h-3 w-3" />
                            Log Session
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaching Sessions Log */}
      {coachingSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Coaching Sessions — {formatCycleLabel(selectedCycle)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Agent (CRDTS)", "Date", "Type", "Hours", "Bonus", "Status", "Notes", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coachingSessions.map((s, i) => (
                    <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-mono text-xs">{s.crdts}{s.alias ? ` (${s.alias})` : ""}</td>
                      <td className="px-4 py-3 text-xs">{s.sessionDate}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">{s.sessionType ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{s.coachingHours}h</td>
                      <td className="px-4 py-3 text-xs font-medium text-emerald-700">${parseFloat(String(s.bonusAmount ?? 0)).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${
                          s.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          s.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{s.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        {s.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => updateStatus.mutate({ id: s.id, status: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => updateStatus.mutate({ id: s.id, status: "rejected" })}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Coaching Session Dialog */}
      <Dialog open={!!coachDialog} onOpenChange={v => !v && setCoachDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" style={{ color: BRAND }} />
              Log Coaching Session
            </DialogTitle>
          </DialogHeader>
          {coachDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border">
                <p className="text-sm font-medium">{coachDialog.alias ?? coachDialog.crdts}</p>
                <p className="text-xs text-muted-foreground font-mono">{coachDialog.crdts}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Revenue: <strong className={coachDialog.totalRevenue < teamAvgRevenue * 0.8 ? "text-red-600" : ""}>${coachDialog.totalRevenue.toFixed(2)}</strong></span>
                  <span>Rev/Hr: <strong className={coachDialog.avgRevPerHr < teamAvgRevPerHr * 0.8 ? "text-red-600" : ""}>${coachDialog.avgRevPerHr.toFixed(2)}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Session Date</Label>
                  <Input type="date" value={sessionForm.sessionDate} onChange={e => setSessionForm(f => ({ ...f, sessionDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Session Type</Label>
                  <Select value={sessionForm.sessionType} onValueChange={v => setSessionForm(f => ({ ...f, sessionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="attendance">Attendance</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Coaching Hours</Label>
                  <Input type="number" min="0" step="0.5" value={sessionForm.coachingHours} onChange={e => setSessionForm(f => ({ ...f, coachingHours: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bonus Amount ($)</Label>
                  <Input type="number" min="0" step="0.01" value={sessionForm.bonusAmount} onChange={e => setSessionForm(f => ({ ...f, bonusAmount: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</Label>
                <Textarea
                  placeholder="Coaching notes, action items, improvement areas..."
                  value={sessionForm.notes}
                  onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoachDialog(null)}>Cancel</Button>
            <Button
              onClick={submitSession}
              disabled={addSession.isPending}
              style={{ background: BRAND }}
              className="text-white"
            >
              {addSession.isPending ? "Saving..." : "Log Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
