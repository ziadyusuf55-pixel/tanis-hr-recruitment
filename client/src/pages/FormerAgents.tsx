import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorMessage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  UserX, Search, ChevronDown, ChevronRight, DollarSign,
  TrendingUp, AlertTriangle, BookOpen, FileText, Calendar,
} from "lucide-react";

function fmt(v: unknown, prefix = "") {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) || n === 0 ? "—" : `${prefix}${n.toLocaleString("en-EG", { maximumFractionDigits: 0 })}`;
}
function fmtDate(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function statusColor(s: string) {
  if (s === "resigned") return "bg-orange-100 text-orange-700";
  if (s === "terminated") return "bg-red-100 text-red-700";
  if (s === "blacklisted") return "bg-gray-900 text-white";
  return "bg-gray-100 text-gray-600";
}

type Agent = Record<string, unknown>;
type FormerRow = {
  agent: Agent;
  requests: unknown[];
  payroll: Array<{ id: number; month: string; netPay: string | null; paymentStatus: string; paidBy?: string | null }>;
  performance: Array<{ cycleKey: string; revenue: string | null; loginHours: string | null }>;
  violations: unknown[];
  coaching: unknown[];
  totalPaidEgp: number;
  totalCycles: number;
  totalRevenue: number;
};

export default function FormerAgents() {
  const { data = [], isLoading } = trpc.separation.listFormerAgents.useQuery();
  const rows = data as FormerRow[];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "resigned" | "terminated" | "blacklisted">("all");
  const utils = trpc.useUtils();
  const restoreMutation = trpc.workforce.update.useMutation({
    onSuccess: (_data, vars) => {
      utils.separation.listFormerAgents.invalidate();
      fetch(`/api/check-agent-creds?code=${encodeURIComponent(vars.traineeCode)}`)
        .then(r => r.json())
        .then((d: { hasCredentials: boolean }) => {
          if (d.hasCredentials) {
            toast.success("Agent restored. They can log in with their existing credentials.");
          } else {
            toast.success("Agent restored. ⚠️ No portal credentials — go to Training → Generate Credentials before they can log in.", { duration: 8000 });
          }
        })
        .catch(() => toast.success("Agent restored to active status."));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>("personal");

  const filtered = rows.filter(r => {
    const a = r.agent;
    if (statusFilter !== "all" && a.agentStatus !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [a.fullName, a.alias, a.traineeCode, a.crdts, a.phone, a.email]
      .some(v => v && String(v).toLowerCase().includes(q));
  });

  const counts = {
    all: rows.length,
    resigned: rows.filter(r => r.agent.agentStatus === "resigned").length,
    terminated: rows.filter(r => r.agent.agentStatus === "terminated").length,
    blacklisted: rows.filter(r => r.agent.agentStatus === "blacklisted").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <UserX className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold">Former Agents</h1>
          <p className="text-xs text-muted-foreground">Resigned, terminated & archived — full history</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search name, code, CRDTS…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        {(["all","resigned","terminated","blacklisted"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${statusFilter === s ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}>
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No former agents found.</CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map(row => {
          const a = row.agent;
          const code = String(a.traineeCode ?? "");
          const isOpen = expanded === code;
          const exitReason = ((row.requests as unknown as Record<string, unknown>[]).find((r) => r.type === "resignation"))?.message as string | undefined
            ?? (a as Record<string, unknown>).exitReason as string | undefined
            ?? "—";
          return (
            <Card key={code} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header row */}
                <button className="w-full text-left p-4" onClick={() => setExpanded(isOpen ? null : code)}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{String(a.fullName ?? "")}</span>
                        {!!a.alias && <span className="text-xs text-muted-foreground">({String(a.alias)})</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColor(String(a.agentStatus ?? ""))}`}>
                          {String(a.agentStatus ?? "")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {code} · {String(a.crdts ?? "—")} · Joined {fmtDate(a.joinDate as number)} · {row.totalCycles} cycles · EGP {row.totalPaidEgp.toLocaleString()} paid
                      </p>
                    </div>
                    <button
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Restore ${String(a.fullName ?? "this agent")} to active status?`)) {
                          restoreMutation.mutate({ traineeCode: code, agentStatus: "active", isActive: true });
                        }
                      }}
                    >
                      ↩ Restore
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t">
                    {/* Section tabs */}
                    <div className="flex gap-0 border-b overflow-x-auto">
                      {[
                        { k: "personal", label: "Personal Info", icon: <FileText className="w-3.5 h-3.5" /> },
                        { k: "payroll", label: `Payroll (${row.payroll.length})`, icon: <DollarSign className="w-3.5 h-3.5" /> },
                        { k: "performance", label: `Performance (${row.performance.length})`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
                        { k: "violations", label: `Violations (${row.violations.length})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                        { k: "coaching", label: `Coaching (${row.coaching.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
                        { k: "requests", label: `Requests (${row.requests.length})`, icon: <Calendar className="w-3.5 h-3.5" /> },
                      ].map(s => (
                        <button key={s.k} onClick={() => setExpandedSection(s.k)}
                          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${expandedSection === s.k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}>
                          {s.icon}{s.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4">
                      {expandedSection === "personal" && (
                        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                          {([
                            ["Full Name", a.fullName], ["Alias", a.alias], ["Trainee Code", a.traineeCode],
                            ["CRDTS", a.crdts], ["Phone", a.phone], ["Email", a.email],
                            ["National ID", a.nationalId], ["DOB", a.dateOfBirth], ["Gender", a.gender],
                            ["Nationality", a.nationality], ["Marital Status", a.maritalStatus],
                            ["Military Status", a.militaryStatus], ["Job Title", a.jobTitle],
                            ["City", a.city], ["Address", a.address],
                            ["Emergency Contact", a.emergencyContactName], ["Emergency Phone", a.emergencyContactPhone],
                            ["Work Location", a.workLocation], ["Team Leader", a.teamLeader],
                            ["Status", a.agentStatus], ["Exit Reason", exitReason],
                            ["Join Date", fmtDate(a.joinDate as number)],
                          ] as [string, unknown][]).map(([label, val]) => (
                            <div key={String(label)} className="flex gap-2">
                              <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
                              <span className="text-xs font-medium">{val != null ? String(val) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {expandedSection === "payroll" && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Total paid: <span className="font-semibold text-foreground">EGP {row.totalPaidEgp.toLocaleString()}</span></p>
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-muted/30 border-b"><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-right">Net Pay</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-left">Paid By</th></tr></thead>
                              <tbody>
                                {row.payroll.map(p => (
                                  <tr key={p.id} className="border-b last:border-0">
                                    <td className="px-3 py-2">{p.month}</td>
                                    <td className="px-3 py-2 text-right font-medium">EGP {parseFloat(String(p.netPay ?? 0)).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-center"><Badge variant={p.paymentStatus === "paid" ? "default" : "outline"} className="text-[10px]">{p.paymentStatus}</Badge></td>
                                    <td className="px-3 py-2 text-muted-foreground">{p.paidBy ?? "—"}</td>
                                  </tr>
                                ))}
                                {row.payroll.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No payroll records</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {expandedSection === "performance" && (
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/30 border-b"><th className="px-3 py-2 text-left">Cycle</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Login Hrs</th></tr></thead>
                            <tbody>
                              {row.performance.map((p, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-2">{p.cycleKey}</td>
                                  <td className="px-3 py-2 text-right">{fmt(p.revenue, "$")}</td>
                                  <td className="px-3 py-2 text-right">{parseFloat(String(p.loginHours ?? 0)).toFixed(1)}h</td>
                                </tr>
                              ))}
                              {row.performance.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No performance data</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {expandedSection === "violations" && (
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/30 border-b"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Deduction</th></tr></thead>
                            <tbody>
                              {(row.violations as Array<Record<string, unknown>>).map((v, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-2">{String(v.date ?? "")}</td>
                                  <td className="px-3 py-2">{String(v.type ?? "")}</td>
                                  <td className="px-3 py-2">{String(v.category ?? "")}</td>
                                  <td className="px-3 py-2 text-right">{fmt(v.deduction, "EGP ")}</td>
                                </tr>
                              ))}
                              {row.violations.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No violations</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {expandedSection === "coaching" && (
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/30 border-b"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Notes</th></tr></thead>
                            <tbody>
                              {(row.coaching as Array<Record<string, unknown>>).map((c, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-2">{String(c.sessionDate ?? "")}</td>
                                  <td className="px-3 py-2">{String(c.sessionType ?? "")}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{String(c.notes ?? "—")}</td>
                                </tr>
                              ))}
                              {row.coaching.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No coaching sessions</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {expandedSection === "requests" && (
                        <div className="space-y-2">
                          {(row.requests as Array<Record<string, unknown>>).map((r, i) => (
                            <div key={i} className="rounded-lg border p-3 text-xs">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium capitalize">{String(r.type ?? "").replace(/_/g, " ")}</span>
                                <Badge variant="outline" className="text-[10px] capitalize">{String(r.status ?? "")}</Badge>
                              </div>
                              {!!r.subject && <p className="text-muted-foreground">{String(r.subject)}</p>}
                              {!!r.message && <p className="mt-1">{String(r.message)}</p>}
                              <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(r.createdAt as number)}</p>
                            </div>
                          ))}
                          {row.requests.length === 0 && <p className="text-sm text-center py-4 text-muted-foreground">No requests on record.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
