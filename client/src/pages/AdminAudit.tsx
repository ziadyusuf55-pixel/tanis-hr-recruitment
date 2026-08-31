import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert, FileSearch, Trash2 } from "lucide-react";

const fmtEGP = (v: number) => `EGP ${v.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export default function AdminAudit() {
  const [auditMonth, setAuditMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [runPayroll, setRunPayroll] = useState(false);
  const [runPortal, setRunPortal] = useState(false);

  const { data: payrollAudit = [], isLoading: loadingPayroll } = trpc.workforce.auditPayrollReconciliation.useQuery(
    { month: auditMonth }, { enabled: runPayroll }
  );
  const { data: portalAudit = [], isLoading: loadingPortal } = trpc.workforce.auditPortalAccess.useQuery(
    undefined, { enabled: runPortal }
  );

  const deleteCredsMutation = // credential revoke handled via navigation
  void (0); const _placeholder = ({
    onSuccess: () => { /* rerun portal audit */ }
  });

  type PayrollRow = { id: number; crdts: string | null; agentCode: string | null; alias: string | null; fullName: string | null; agentStatus: string; netPay: number; commissionEgp: number; baseSalary: number; totalDeductions: number; paymentStatus: string; discrepancy: boolean; expectedNet: number };
  type PortalRow = { traineeCode: string; alias: string | null; fullName: string | null; agentStatus: string; isActive: boolean | null };

  const discrepancies = (payrollAudit as PayrollRow[]).filter(r => r.discrepancy);
  const formerWithAccess = (portalAudit as PortalRow[]).filter(r =>
    r.agentStatus !== "active" && r.agentStatus !== "inactive"
  );

  const STATUS_COLOR: Record<string, string> = {
    resigned: "bg-orange-100 text-orange-700",
    terminated: "bg-red-100 text-red-700",
    blacklisted: "bg-gray-100 text-gray-700",
    frozen: "bg-blue-100 text-blue-700",
    unknown: "bg-muted text-muted-foreground",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Admin Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">Run checks on payroll accuracy and portal access security</p>
        </div>

        {/* ── Payroll Reconciliation ────────────────────────────────── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-semibold">Payroll Reconciliation</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compares each agent's payroll record against the base formula to flag discrepancies
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input type="month" value={auditMonth} onChange={e => { setAuditMonth(e.target.value); setRunPayroll(false); }}
                  className="h-9 rounded-md border px-2 text-sm bg-background" />
                <Button size="sm" onClick={() => setRunPayroll(true)} disabled={loadingPayroll}>
                  {loadingPayroll ? "Running…" : "Run Audit"}
                </Button>
              </div>
            </div>

            {runPayroll && !loadingPayroll && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <p className="text-2xl font-bold">{(payrollAudit as PayrollRow[]).length}</p>
                    <p className="text-xs text-muted-foreground">Total records</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${discrepancies.length > 0 ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
                    <p className={`text-2xl font-bold ${discrepancies.length > 0 ? "text-red-600" : "text-emerald-600"}`}>{discrepancies.length}</p>
                    <p className="text-xs text-muted-foreground">Discrepancies</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <p className="text-2xl font-bold">{(payrollAudit as PayrollRow[]).filter(r => r.paymentStatus === "paid").length}</p>
                    <p className="text-xs text-muted-foreground">Already paid</p>
                  </div>
                </div>

                {discrepancies.length === 0 && (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="text-sm font-medium">All payroll records match — no discrepancies found for {formatMonthLabel(auditMonth)}</p>
                  </div>
                )}

                {discrepancies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> {discrepancies.length} record{discrepancies.length > 1 ? "s" : ""} with discrepancies
                    </p>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-xs">
                        <thead className="bg-red-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2">Agent</th>
                            <th className="text-right px-3 py-2">Base Salary</th>
                            <th className="text-right px-3 py-2">Deductions</th>
                            <th className="text-right px-3 py-2">Expected Net</th>
                            <th className="text-right px-3 py-2 text-red-700">Stored Net</th>
                            <th className="text-right px-3 py-2">Diff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {discrepancies.map(r => (
                            <tr key={r.id} className="bg-red-50/50">
                              <td className="px-3 py-2">
                                <p className="font-medium">{r.alias || r.fullName || r.crdts || "—"}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{r.agentCode || r.crdts}</p>
                                <Badge className={`text-[9px] mt-0.5 ${STATUS_COLOR[r.agentStatus] ?? STATUS_COLOR.unknown}`}>{r.agentStatus}</Badge>
                              </td>
                              <td className="px-3 py-2 text-right">{fmtEGP(r.baseSalary)}</td>
                              <td className="px-3 py-2 text-right text-red-600">-{fmtEGP(r.totalDeductions)}</td>
                              <td className="px-3 py-2 text-right">{fmtEGP(r.expectedNet)}</td>
                              <td className="px-3 py-2 text-right font-bold text-red-700">{fmtEGP(r.netPay)}</td>
                              <td className="px-3 py-2 text-right text-red-600 font-semibold">{fmtEGP(Math.abs(r.netPay - r.expectedNet))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Full list */}
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Show all {(payrollAudit as PayrollRow[]).length} records</summary>
                  <div className="overflow-x-auto rounded-xl border mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b">
                        <tr>
                          <th className="text-left px-3 py-2">Agent</th>
                          <th className="text-right px-3 py-2">Net Pay</th>
                          <th className="text-right px-3 py-2">Commission</th>
                          <th className="text-center px-3 py-2">Status</th>
                          <th className="text-center px-3 py-2">Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(payrollAudit as PayrollRow[]).map(r => (
                          <tr key={r.id} className={r.discrepancy ? "bg-red-50" : ""}>
                            <td className="px-3 py-2">
                              <p className="font-medium">{r.alias || r.fullName || r.crdts || "—"}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{r.agentCode || r.crdts}</p>
                            </td>
                            <td className="px-3 py-2 text-right">{fmtEGP(r.netPay)}</td>
                            <td className="px-3 py-2 text-right">{r.commissionEgp > 0 ? fmtEGP(r.commissionEgp) : "—"}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {r.paymentStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.discrepancy
                                ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                                : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Portal Access Audit ───────────────────────────────────── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <h2 className="text-base font-semibold">Portal Access Audit</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Finds terminated, resigned, or blacklisted agents who still have portal credentials
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRunPortal(true)} disabled={loadingPortal}>
                {loadingPortal ? "Scanning…" : "Run Scan"}
              </Button>
            </div>

            {runPortal && !loadingPortal && (
              <div className="space-y-3">
                {formerWithAccess.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="text-sm font-medium">Clean — no terminated or resigned agents have active portal credentials</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> {formerWithAccess.length} agent{formerWithAccess.length > 1 ? "s" : ""} with credentials but non-active status
                    </p>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-xs">
                        <thead className="bg-red-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2">Agent</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Risk</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(formerWithAccess as PortalRow[]).map(r => (
                            <tr key={r.traineeCode} className="bg-red-50/40">
                              <td className="px-3 py-2">
                                <p className="font-medium">{r.alias || r.fullName || r.traineeCode}</p>
                                <p className="text-[10px] font-mono text-muted-foreground">{r.traineeCode}</p>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.agentStatus] ?? STATUS_COLOR.unknown}`}>
                                  {r.agentStatus}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-red-700 font-medium">
                                Can log in to agent portal
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-[10px]"
                                  onClick={() => {
                                    if (confirm(`Revoke portal credentials for ${r.alias || r.traineeCode}?`)) {
                                      // Navigate to Training page to delete credentials
                                      window.location.href = `/training?revoke=${r.traineeCode}`;
                                    }
                                  }}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Revoke
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Note: The portal lock is already blocking all logins when active. These agents can only log in when the portal is unlocked.
                      Revoking credentials permanently removes their access.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
