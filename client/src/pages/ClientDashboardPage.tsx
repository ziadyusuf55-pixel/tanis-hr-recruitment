import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
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
  { category: "People & Attendance", key: "late_arrivals", label: "Late Arrivals / Early Departures", target: "0", unit: "#" },
  { category: "People & Attendance", key: "pto_compliance", label: "PTO Compliance", target: "100%", unit: "%" },
  { category: "People & Attendance", key: "monthly_attrition", label: "Monthly Attrition", target: "≤3%", unit: "%" },
  // Recruiting
  { category: "Recruiting", key: "time_to_first_qualified", label: "Time to First Qualified", target: "≤5 days", unit: "days" },
  { category: "Recruiting", key: "time_to_fill", label: "Time to Fill", target: "≤30 days", unit: "days" },
  { category: "Recruiting", key: "replacement_speed", label: "Replacement Speed", target: "≤14 days", unit: "days" },
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
  baseSalaryEgp: string | null;
  incentivesEgp: string | null;
  netPayEgp: string | null;
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

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data, isLoading, error } = trpc.clients.getDashboard.useQuery(
    { clientId, month: selectedMonth },
    { enabled: clientId > 0 }
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

  const { client, campaigns, activeAgents, allAgents, payroll, adherence, month } = data as unknown as {
    client: { id: number; name: string; shortCode: string; colorHex: string; isActive: boolean };
    campaigns: { id: number; name: string }[];
    activeAgents: Agent[];
    allAgents: Agent[];
    payroll: PayrollRecord[];
    adherence: AdherenceEntry[];
    month: string;
  };

  // Computed metrics
  const totalActive = activeAgents.length;
  const resignedThisMonth = allAgents.filter(a => a.agentStatus === "resigned" || a.agentStatus === "terminated").length;
  const attritionRate = allAgents.length > 0 ? ((resignedThisMonth / allAgents.length) * 100).toFixed(1) : "0.0";

  const lateEvents = adherence.filter(a => a.type === "late" || a.type === "early_departure").length;

  const totalPayroll = payroll.reduce((sum, p) => sum + parseFloat(p.netPayEgp ?? "0"), 0);

  const adherenceByType = adherence.reduce<Record<string, number>>((acc, a) => {
    const t = a.type ?? "other";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Scorecard auto-computation
  const getComputedValue = (key: string): string | null => {
    switch (key) {
      case "monthly_attrition": return attritionRate + "%";
      case "late_arrivals": return String(lateEvents);
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
      if (!isNaN(num)) {
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
                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {totalActive} active agents
              </p>
            </div>
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
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
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Campaigns</p>
                <p className="text-3xl font-bold mt-1">{campaigns.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Attrition</p>
                <p className="text-3xl font-bold mt-1">{attritionRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payroll ({month})</p>
                <p className="text-3xl font-bold mt-1">{totalPayroll.toLocaleString("en-EG")} EGP</p>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {campaigns.length === 0 ? (
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
                    <TableHead>Campaign</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No active agents for this client.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeAgents.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{a.traineeCode}</TableCell>
                        <TableCell>{a.campaignName ?? "—"}</TableCell>
                        <TableCell>{a.teamLeader ?? "—"}</TableCell>
                        <TableCell className="capitalize">{a.workLocation ?? "—"}</TableCell>
                        <TableCell>
                          {a.nestingStatus === "nesting" ? (
                            <Badge variant="secondary" className="text-xs">Nesting</Badge>
                          ) : (
                            <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>
                          )}
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
                    <TableHead className="text-right">Incentives</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
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
                        <TableCell className="text-right">{parseFloat(p.baseSalaryEgp ?? "0").toLocaleString("en-EG")} EGP</TableCell>
                        <TableCell className="text-right">{parseFloat(p.incentivesEgp ?? "0").toLocaleString("en-EG")} EGP</TableCell>
                        <TableCell className="text-right font-semibold">{parseFloat(p.netPayEgp ?? "0").toLocaleString("en-EG")} EGP</TableCell>
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
