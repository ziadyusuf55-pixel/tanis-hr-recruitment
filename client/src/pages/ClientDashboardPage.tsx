import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { currentCycleMonth } from "@/lib/cycle";
import { etMonthKey } from "@/lib/tz";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Users, CreditCard, UserSearch, ClipboardCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLocation } from "wouter";

// Quantum Scorecard KPI definitions
const SCORECARD_KPIS = [
  // People & Attendance
  { category: "People & Attendance", key: "attendance_rate", label: "Attendance Rate", target: "≥98%", unit: "%" },
  { category: "People & Attendance", key: "schedule_adherence", label: "Schedule Adherence", target: "≥98%", unit: "%" },
  { category: "People & Attendance", key: "unplanned_absence_rate", label: "Unplanned Absence Rate", target: "≤2%", unit: "%" },
  { category: "People & Attendance", key: "late_arrivals", label: "Late Arrivals / Early Departures", target: "Trend / minimize", unit: "#" },
  { category: "People & Attendance", key: "pto_compliance", label: "PTO Compliance", target: "100%", unit: "%" },
  { category: "People & Attendance", key: "monthly_attrition", label: "Monthly Attrition", target: "Track trend", unit: "%" },
  // Recruiting
  { category: "Recruiting", key: "time_to_first_qualified", label: "Time to First Qualified Candidates", target: "≤5 business days", unit: "days" },
  { category: "Recruiting", key: "time_to_fill", label: "Time to Fill", target: "≤30 days", unit: "days" },
  { category: "Recruiting", key: "replacement_speed", label: "Replacement Speed", target: "SLA-based", unit: "days" },
  { category: "Recruiting", key: "candidate_quality", label: "Candidate Quality Rate", target: "≥80%", unit: "%" },
  // Performance
  { category: "Performance", key: "employees_meeting_expectations", label: "Employees Meeting Expectations", target: "≥90%", unit: "%" },
  { category: "Performance", key: "escalations", label: "Escalations", target: "0", unit: "#" },
  { category: "Performance", key: "corrective_actions_compliance", label: "Corrective Actions Compliance", target: "100%", unit: "%" },
  // Operations
  { category: "Operations", key: "operational_availability", label: "Operational Availability", target: "≥99%", unit: "%" },
  { category: "Operations", key: "power_internet_incidents", label: "Power/Internet Incidents", target: "0", unit: "#" },
  { category: "Operations", key: "escalation_response_time", label: "Escalation Response Time", target: "≤1hr", unit: "min" },
  // HR/Compliance
  { category: "HR/Compliance", key: "payroll_hr_issues", label: "Payroll/HR Issues", target: "0", unit: "#" },
  { category: "HR/Compliance", key: "security_privacy_incidents", label: "Security/Privacy Incidents", target: "0", unit: "#" },
  // Billing/Admin
  { category: "Billing/Admin", key: "invoice_accuracy", label: "Invoice Accuracy", target: "100%", unit: "%" },
  { category: "Billing/Admin", key: "roster_rate_accuracy", label: "Roster/Rate Accuracy", target: "100%", unit: "%" },
];

type Agent = {
  id: number;
  traineeCode: string | null;
  fullName: string;
  campaignName: string | null;
  jobTitle: string | null;
  teamLeader: string | null;
  agentStatus: string | null;
  joinDate: string | null;
  workLocation: string | null;
  nestingStatus: string | null;
  crdts: string | null;
  salarySettled: boolean | null;
  promotedAt: number | null;
};

type PayrollRecord = {
  id: number;
  agentCode: string | null;
  month: string | null;
  // REAL server fields (payroll_records) — the old baseSalaryEgp/incentivesEgp/
  // netPayEgp names never existed, so every amount rendered 0 EGP.
  baseSalary: string | null;
  commissionEgp: string | null;
  netPay: string | null;
  /** net + commission + adjustments, computed server-side with the shared finalPay formula */
  finalTotal?: number;
};

type AdherenceEntry = {
  id: number;
  agentCode: string | null;
  date: string | null;
  type: string | null;
};

export default function ClientDashboardPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("overview");

  // Payroll & violations are keyed by the 26th→25th Cairo PAY CYCLE — defaulting
  // to the ET calendar month showed last cycle as "current" from the 26th on.
  const currentMonth = currentCycleMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthTouched = useRef(false);

  const { data, isLoading, error } = trpc.clients.getDashboard.useQuery(
    { clientId, month: selectedMonth },
    { enabled: clientId > 0 }
  );
  // Time-tracking clients (Quantum): hours / AUX / attendance come from the shift + AUX records.
  const dashClient = (data as { client?: { timeTrackingEnabled?: boolean; positionBased?: boolean } } | undefined)?.client;
  // A time-tracking client's dashboard is mostly hours/AUX, which live on the
  // CALENDAR month — once we know the client type, snap the untouched default
  // there instead (between the 26th and month-end the two labels differ).
  useEffect(() => {
    if (dashClient?.timeTrackingEnabled && !monthTouched.current) {
      const et = etMonthKey();
      setSelectedMonth(prev => (prev === currentMonth && prev !== et ? et : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashClient?.timeTrackingEnabled]);
  const monthFrom = `${selectedMonth}-01`;
  const monthTo = (() => { const [y, m] = selectedMonth.split("-").map(Number); return `${selectedMonth}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`; })();
  const { data: hours = [], error: hoursError } = trpc.timeTracking.workedSummary.useQuery(
    { clientId, from: monthFrom, to: monthTo },
    { enabled: clientId > 0 && !!dashClient?.timeTrackingEnabled }
  );
  const { data: managedPositions = [] } = trpc.clients.positions.useQuery(
    { clientId },
    { enabled: clientId > 0 && !!dashClient?.positionBased }
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading client data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="mb-4 gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Button>
        <p className="text-red-500">Failed to load client: {error?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  const { client, campaigns, activeAgents: _rawActiveAgents, allAgents, payroll, adherence, month, monthlyAttritionPct, separationsThisMonth } = data as unknown as {
    client: { id: number; name: string; shortCode: string; colorHex: string; isActive: boolean; timeTrackingEnabled?: boolean; positionBased?: boolean };
    campaigns: { id: number; name: string }[];
    activeAgents: Agent[];
    allAgents: Agent[];
    payroll: PayrollRecord[];
    adherence: AdherenceEntry[];
    month: string;
    monthlyAttritionPct: number;
    separationsThisMonth: number;
  };
  type HoursRow = { traineeCode: string; name: string; role: string | null; scheduledHrs: number; workedHrs: number; shiftHrs: number; ptoHrs: number; unplannedHrs: number; lateEarly: number; auxMinutes: Record<string, number> };
  const hoursRows = hours as HoursRow[];
  const hoursTot = hoursRows.reduce((acc, r) => ({
    scheduled: acc.scheduled + r.scheduledHrs, worked: acc.worked + r.workedHrs, shift: acc.shift + r.shiftHrs,
    pto: acc.pto + r.ptoHrs, unplanned: acc.unplanned + r.unplannedHrs, lateEarly: acc.lateEarly + r.lateEarly,
  }), { scheduled: 0, worked: 0, shift: 0, pto: 0, unplanned: 0, lateEarly: 0 });
  const auxTotals = hoursRows.reduce<Record<string, number>>((acc, r) => { for (const [k, v] of Object.entries(r.auxMinutes ?? {})) acc[k] = (acc[k] ?? 0) + v; return acc; }, {});
  const auxTotalMin = Object.values(auxTotals).reduce((a, b) => a + b, 0);
  const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : null;
  // Attendance = (scheduled − unplanned) / scheduled; Adherence = productive / shift time (time on task while clocked in).
  const attendanceRate = pct(hoursTot.scheduled - hoursTot.unplanned, hoursTot.scheduled);
  const adherenceRate = pct(hoursTot.worked, hoursTot.shift);
  const unplannedRate = pct(hoursTot.unplanned, hoursTot.scheduled);
  const hasHours = !!client.timeTrackingEnabled && hoursRows.length > 0;

  // Position-based client: positions are the agents' job titles (one client, many positions), not campaigns.
  const isQuantum = (client as { positionBased?: boolean; timeTrackingEnabled?: boolean }).positionBased ?? (client as { timeTrackingEnabled?: boolean }).timeTrackingEnabled ?? client.name.toLowerCase().includes("quantum");

  // Filter to only truly active-status agents (backend returns inactive/nesting too)
  const activeAgents = _rawActiveAgents.filter(a => a.agentStatus === "active");
  const positionCounts = (() => {
    const m = new Map<string, number>();
    for (const a of activeAgents) { const k = (a.jobTitle ?? "").trim() || "No position set"; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  })();

  // Computed metrics
  const totalActive = activeAgents.length;
  const attritionRate = (monthlyAttritionPct ?? 0).toFixed(1);

  const lateEvents = adherence.filter(a => a.type === "late" || a.type === "early_departure").length;

  const totalPayroll = payroll.reduce((sum, p) => sum + (p.finalTotal ?? parseFloat(p.netPay ?? "0")), 0);

  const adherenceByType = adherence.reduce<Record<string, number>>((acc, a) => {
    const t = a.type ?? "other";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Scorecard auto-computation
  const getComputedValue = (key: string): string | null => {
    switch (key) {
      case "monthly_attrition": return attritionRate + "%";
      case "late_arrivals": return String(hasHours ? hoursTot.lateEarly : lateEvents);
      case "attendance_rate": return hasHours && attendanceRate != null ? attendanceRate + "%" : null;
      case "schedule_adherence": return hasHours && adherenceRate != null ? adherenceRate + "%" : null;
      case "unplanned_absence_rate": return hasHours && unplannedRate != null ? unplannedRate + "%" : null;
      case "payroll_hr_issues": return "0";
      default: return null;
    }
  };

  const categories = Array.from(new Set(SCORECARD_KPIS.map(k => k.category)));

  function KpiRow({ kpi }: { kpi: typeof SCORECARD_KPIS[0] }) {
    const computed = getComputedValue(kpi.key);
    const hasValue = computed !== null;

    let status: "green" | "red" | "gray" = "gray";
    if (computed !== null) {
      const num = parseFloat(computed);
      const isTrackOnly = kpi.target === "Track trend" || kpi.target === "Trend / minimize" || kpi.target === "SLA-based";
      if (!isNaN(num) && !isTrackOnly) {
        if (kpi.target.startsWith("≥")) {
          const t = parseFloat(kpi.target.slice(1));
          status = num >= t ? "green" : "red";
        } else if (kpi.target.startsWith("≤")) {
          const t = parseFloat(kpi.target.slice(1));
          status = num <= t ? "green" : "red";
        } else if (kpi.target === "0") {
          status = num === 0 ? "green" : "red";
        } else if (kpi.target === "100%") {
          status = num >= 100 ? "green" : "red";
        }
      }
    }

    const StatusIcon = status === "green" ? TrendingUp : status === "red" ? TrendingDown : Minus;
    const statusColor = status === "green" ? "text-green-600" : status === "red" ? "text-red-500" : "text-muted-foreground";

    return (
      <TableRow>
        <TableCell className="font-medium text-sm">{kpi.label}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{kpi.target}</TableCell>
        <TableCell>
          {hasValue ? (
            <div className={`flex items-center gap-1.5 font-semibold ${statusColor}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {computed}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Manual entry needed</span>
          )}
        </TableCell>
        <TableCell>
          {status !== "gray" && (
            <Badge variant={status === "green" ? "default" : "destructive"} className="text-xs">
              {status === "green" ? "On Track" : "Off Track"}
            </Badge>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="mb-2 -ml-2 gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: client.colorHex }}
            >
              {client.shortCode.slice(0, 2)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{client.name}</h1>
                <Badge variant="outline" className="font-mono text-xs">{client.shortCode}</Badge>
                {!client.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {isQuantum ? positionCounts.length : campaigns.length} {isQuantum ? "position" : "campaign"}{(isQuantum ? positionCounts.length : campaigns.length) !== 1 ? "s" : ""} · {totalActive} active agents
              </p>
            </div>
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => { monthTouched.current = true; setSelectedMonth(e.target.value); }}
              className="rounded-md border px-2.5 py-1.5 text-sm bg-background"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Agents ({totalActive})
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Payroll
          </TabsTrigger>
          <TabsTrigger value="recruiting" className="gap-1.5">
            <UserSearch className="w-3.5 h-3.5" /> Recruiting
          </TabsTrigger>
          <TabsTrigger value="scorecard" className="gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Scorecard
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Agents</p>
                <p className="text-3xl font-bold mt-1">{totalActive}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{isQuantum ? "Positions" : "Campaigns"}</p>
                <p className="text-3xl font-bold mt-1">{isQuantum ? positionCounts.length : campaigns.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Attrition</p>
                <p className="text-3xl font-bold mt-1">{attritionRate}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{separationsThisMonth ?? 0} left in {month}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payroll ({month})</p>
                <p className="text-3xl font-bold mt-1">{totalPayroll.toLocaleString("en-EG")} EGP</p>
              </CardContent>
            </Card>
          </div>

          {client.timeTrackingEnabled && !hoursError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Hours — {month} (ET)</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {!hasHours ? <p className="text-sm text-muted-foreground py-3">No shift data for this month yet.</p> : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {[
                        ["Scheduled", hoursTot.scheduled.toFixed(1) + " h"], ["Clocked", hoursTot.shift.toFixed(1) + " h"], ["Productive", hoursTot.worked.toFixed(1) + " h"],
                        ["PTO (approved)", hoursTot.pto.toFixed(1) + " h"], ["Unplanned", hoursTot.unplanned.toFixed(1) + " h"], ["Late / early", String(hoursTot.lateEarly)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg border p-2.5"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">{k}</p><p className="font-semibold tabular-nums mt-0.5">{v}</p></div>
                      ))}
                      <div className="rounded-lg border p-2.5"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Attendance</p><p className="font-semibold tabular-nums mt-0.5">{attendanceRate ?? "—"}%</p></div>
                      <div className="rounded-lg border p-2.5"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Adherence</p><p className="font-semibold tabular-nums mt-0.5">{adherenceRate ?? "—"}%</p></div>
                      <div className="rounded-lg border p-2.5"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Unplanned</p><p className="font-semibold tabular-nums mt-0.5">{unplannedRate ?? "—"}%</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">AUX breakdown — {month}</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {auxTotalMin === 0 ? <p className="text-sm text-muted-foreground py-3">No AUX logged this month.</p> : (
                    <div className="space-y-2">
                      {Object.entries(auxTotals).sort((a, b) => b[1] - a[1]).map(([type, min]) => (
                        <div key={type}>
                          <div className="flex justify-between text-xs mb-0.5"><span className="capitalize">{type.replace(/_/g, " ")}</span><span className="tabular-nums text-muted-foreground">{Math.round(min)} min · {Math.round((min / auxTotalMin) * 100)}%</span></div>
                          <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.max(2, (min / auxTotalMin) * 100)}%`, backgroundColor: client.colorHex }} /></div>
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground pt-1">Total AUX {Math.round(auxTotalMin / 60 * 10) / 10} h · {hoursTot.shift > 0 ? Math.round((auxTotalMin / 60 / hoursTot.shift) * 100) : 0}% of clocked time</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Campaigns list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{isQuantum ? "Positions" : "Campaigns"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isQuantum ? (() => {
                type MP = { id: number; name: string; headcount: number; targetHeadcount: number | null };
                const managed = managedPositions as MP[];
                const rows: Array<{ pos: string; n: number; target: number | null; unmanaged: boolean }> = [
                  ...managed.map(p => ({ pos: p.name, n: positionCounts.find(([k]) => k.toLowerCase() === p.name.toLowerCase())?.[1] ?? 0, target: p.targetHeadcount, unmanaged: false })),
                  ...positionCounts.filter(([k]) => !managed.some(p => p.name.toLowerCase() === k.toLowerCase())).map(([k, n]) => ({ pos: k, n, target: null, unmanaged: k !== "No position set" })),
                ];
                return rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No positions defined yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rows.map(r => (
                      <span
                        key={r.pos}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                        title={r.unmanaged ? "Not in the client's position list" : r.target != null ? `Target ${r.target}` : undefined}
                        style={r.pos === "No position set" || r.unmanaged ? { backgroundColor: "#f59e0b22", color: "#b45309" } : { backgroundColor: client.colorHex + "22", color: client.colorHex }}
                      >
                        {r.pos} <span className="text-xs opacity-70">× {r.n}{r.target != null ? ` / ${r.target}` : ""}</span>
                      </span>
                    ))}
                  </div>
                );
              })() : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No campaigns assigned to this client.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {campaigns.map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                      style={{ backgroundColor: client.colorHex + "22", color: client.colorHex }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Adherence summary */}
          {Object.keys(adherenceByType).length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Adherence Issues — {month}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(adherenceByType).map(([type, count]) => (
                    <div key={type} className="flex flex-col items-center p-3 rounded-lg bg-muted/50 min-w-[80px]">
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-xs text-muted-foreground capitalize mt-0.5">{type.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>{isQuantum ? "Position" : "Campaign"}</TableHead>
                    {!isQuantum && <TableHead>Team Leader</TableHead>}
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isQuantum ? 5 : 6} className="text-center text-muted-foreground py-8">
                        No active agents for this client.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeAgents.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{a.traineeCode}</TableCell>
                        <TableCell>{isQuantum ? (a.jobTitle ?? <span className="text-amber-600">not set</span>) : (a.campaignName ?? "—")}</TableCell>
                        {!isQuantum && <TableCell>{a.teamLeader ?? "—"}</TableCell>}
                        <TableCell className="capitalize">{a.workLocation ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Payroll — {month}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Code</TableHead>
                    <TableHead className="text-right">Base Salary</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Final Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No payroll records for {month}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.agentCode}</TableCell>
                        <TableCell className="text-right">{parseFloat(p.baseSalary ?? "0").toLocaleString("en-EG")} EGP</TableCell>
                        <TableCell className="text-right">{parseFloat(p.commissionEgp ?? "0").toLocaleString("en-EG")} EGP</TableCell>
                        <TableCell className="text-right font-semibold">{(p.finalTotal ?? parseFloat(p.netPay ?? "0")).toLocaleString("en-EG")} EGP</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {payroll.length > 0 && (
                <div className="mt-3 pt-3 border-t flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Total Payroll:</span>
                  <span className="font-bold">{totalPayroll.toLocaleString("en-EG")} EGP</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recruiting Tab */}
        <TabsContent value="recruiting" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center py-6">
                Recruiting pipeline for <strong>{client.name}</strong> candidates — linked through workforce agents.
                View the full pipeline in{" "}
                <button
                  onClick={() => navigate("/candidates")}
                  className="text-primary underline hover:no-underline"
                >
                  Candidates
                </button>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scorecard Tab */}
        <TabsContent value="scorecard" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Monthly Scorecard — {month}</h2>
            <Badge variant="outline" className="text-xs">
              Auto-computed where possible · Manual entry for others
            </Badge>
          </div>

          {categories.map(category => {
            const kpis = SCORECARD_KPIS.filter(k => k.category === category);
            return (
              <Card key={category} className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KPI</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpis.map(kpi => <KpiRow key={kpi.key} kpi={kpi} />)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
