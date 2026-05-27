import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, Clock, Trash2,
  ChevronDown, ChevronRight, CreditCard, Smartphone, Building2,
  DollarSign, TrendingUp, AlertCircle, BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = {
  crdts: string;
  alias?: string;
  agentCode?: string;
  workingHours?: number;
  baseSalary?: number;
  ot1x5Hours?: number;
  ot1x5Pay?: number;
  ot2xHours?: number;
  ot2xPay?: number;
  ot3xHours?: number;
  ot3xPay?: number;
  coachingBonus?: number;
  commissionEgp?: number;
  qualityDeductions?: number;
  totalDeductions?: number;
  netPay?: number;
  qualityDetail?: string;
  attendanceDetail?: string;
};

type StatusRecord = {
  id: number;
  crdts: string | null;
  alias: string | null;
  agentCode: string | null;
  traineeCode: string | null;
  netPay: string | null;
  commissionEgp: string | null;
  paymentStatus: string | null;
  paidAt: number | null;
  month: string;
};

type PaymentMethod = {
  id: number;
  traineeCode: string;
  type: "wallet" | "bank";
  walletProvider?: string | null;
  walletPhone?: string | null;
  walletName?: string | null;
  bankName?: string | null;
  bankAccountOrPhone?: string | null;
  bankFullName?: string | null;
  isPreferred?: boolean | null;
  adminComment?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, prefix = ""): string {
  if (val == null || val === "") return "—";
  const n = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtEGP(val: string | number | null | undefined): string {
  return fmt(val, "EGP ");
}

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function calcFinalPay(r: StatusRecord): number {
  const net = r.netPay ? parseFloat(r.netPay) || 0 : 0;
  const comm = r.commissionEgp ? parseFloat(r.commissionEgp) || 0 : 0;
  return net + comm;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayrollPage() {
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"status" | "guide">("status");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // ── Status tab state ──
  const [statusMonth, setStatusMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: statusRecords = [], isLoading: loadingStatus, refetch: refetchStatus } =
    trpc.payrollV2.getStatusPage.useQuery({ month: statusMonth });

  const { data: allPaymentMethods = [] } = trpc.paymentMethods.listAll.useQuery();

  const setStatusMutation = trpc.payrollV2.setStatus.useMutation({
    onSuccess: () => { refetchStatus(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Upload tab state ──
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadMonth, setUploadMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.payrollV2.uploadPayrollV2.useMutation({
    onSuccess: (data) => {
      toast.success(`Uploaded ${data.count} payroll records for ${formatMonthLabel(uploadMonth)}`);
      setUploadDialog(false);
      setParsedRows([]);
      setStatusMonth(uploadMonth);
      setActiveTab("status");
      utils.payrollV2.getStatusPage.invalidate({ month: uploadMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Computed totals ──
  const records = statusRecords as StatusRecord[];
  const paidRecords = records.filter(r => r.paymentStatus === "paid");
  const pendingRecords = records.filter(r => r.paymentStatus !== "paid");
  const totalDisburse = records.reduce((s, r) => s + calcFinalPay(r), 0);
  const totalPaid = paidRecords.reduce((s, r) => s + calcFinalPay(r), 0);
  const totalPending = pendingRecords.reduce((s, r) => s + calcFinalPay(r), 0);

  // ── Excel parsing ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

        if (raw.length === 0) { setParseError("The file appears to be empty."); return; }

        const norm = (k: string) => k.toLowerCase().replace(/[\s()%_-]/g, "");
        const rows: ParsedRow[] = raw.map((r) => {
          const get = (key: string) => {
            const found = Object.keys(r).find(k => norm(k) === norm(key));
            return found ? r[found] : null;
          };
          const num = (v: unknown): number | undefined => {
            if (v == null || v === "") return undefined;
            const n = Number(v);
            return isNaN(n) ? undefined : n;
          };
          return {
            crdts: String(get("CRDTS") ?? "").trim(),
            alias: String(get("Alias") ?? "").trim(),
            agentCode: String(get("Agent Code") ?? "").trim(),
            workingHours: num(get("Working Hours")),
            baseSalary: num(get("Base Salary (EGP)")),
            ot1x5Hours: num(get("OT 1.5x Hours")),
            ot1x5Pay: num(get("OT 1.5x Pay (EGP)")),
            ot2xHours: num(get("OT 2x Hours")),
            ot2xPay: num(get("OT 2x Pay (EGP)")),
            ot3xHours: num(get("OT 3x Hours")),
            ot3xPay: num(get("OT 3x Pay (EGP)")),
            coachingBonus: num(get("Coaching Bonus (EGP)")),
            commissionEgp: num(get("Commission (EGP)")),
            qualityDeductions: num(get("Quality/Attendance Deductions (EGP)")) ?? num(get("Quality Deductions (EGP)")),
            totalDeductions: num(get("Total Deductions (EGP)")),
            netPay: num(get("NET PAY (EGP)")) ?? num(get("Net Pay (EGP)")),
            qualityDetail: String(get("Quality Detail") ?? "").trim(),
            attendanceDetail: String(get("Attendance Detail") ?? "").trim(),
          };
        }).filter(r => r.crdts !== "");

        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure the 'CRDTS' column is present and filled.");
          return;
        }
        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse the file. Please use the provided template.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const headers = [
      "CRDTS", "Alias", "Working Hours", "Base Salary (EGP)",
      "OT 1.5x Hours", "OT 1.5x Pay (EGP)",
      "OT 2x Hours", "OT 2x Pay (EGP)",
      "OT 3x Hours", "OT 3x Pay (EGP)",
      "Coaching Bonus (EGP)", "Commission (EGP)",
      "Quality/Attendance Deductions (EGP)", "Total Deductions (EGP)", "NET PAY (EGP)",
      "Quality Detail", "Attendance Detail",
    ];
    const example = [
      "1001", "Harry", 176, 4500,
      8, 480, 4, 320, 0, 0,
      200, 800, 150, 150, 6050,
      "Late 2x", "Absent 1 day",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, "payroll_template_v2.xlsx");
  }

  function exportStatusCSV() {
    const rows = records.map(r => ({
      CRDTS: r.crdts ?? "",
      Alias: r.alias ?? "",
      "Agent Code": r.agentCode ?? "",
      "Net Pay (EGP)": r.netPay ? parseFloat(r.netPay) : "",
      "Commission (EGP)": r.commissionEgp ? parseFloat(r.commissionEgp) : "",
      "Final Total (EGP)": calcFinalPay(r),
      Status: r.paymentStatus ?? "pending",
      "Paid At": r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-EG") : "",
      Month: r.month,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Status");
    XLSX.writeFile(wb, `payroll_status_${statusMonth}.xlsx`);
  }

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getPaymentMethods(r: StatusRecord): PaymentMethod[] {
    const tc = r.traineeCode || r.agentCode;
    if (!tc) return [];
    return (allPaymentMethods as PaymentMethod[]).filter(m => m.traineeCode === tc);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage monthly agent payroll — upload, track, and confirm payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setParsedRows([]); setParseError(null); setUploadDialog(true); }}>
            <Upload className="h-3.5 w-3.5" /> Upload Payroll Sheet
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["status", "guide"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "status" ? "Payment Status" : "Monthly Guide"}
          </button>
        ))}
      </div>

      {/* ── Payment Status Tab ── */}
      {activeTab === "status" && (
        <div className="space-y-4">
          {/* Month picker */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Month:</label>
              <input
                type="month"
                value={statusMonth}
                onChange={e => setStatusMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportStatusCSV} disabled={records.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>

          {/* Totals summary bar */}
          {records.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total to Disburse</p>
                  <p className="text-base font-bold">{fmtEGP(totalDisburse)}</p>
                  <p className="text-xs text-muted-foreground">{records.length} agents</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-base font-bold text-emerald-600">{fmtEGP(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">{paidRecords.length} agents</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-base font-bold text-amber-600">{fmtEGP(totalPending)}</p>
                  <p className="text-xs text-muted-foreground">{pendingRecords.length} agents</p>
                </div>
              </div>
            </div>
          )}

          {loadingStatus ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-base font-medium text-muted-foreground">No payroll data for {formatMonthLabel(statusMonth)}</p>
                <p className="text-sm text-muted-foreground/70">Upload a payroll sheet to see records here</p>
                <Button size="sm" className="mt-2 gap-1.5" onClick={() => setUploadDialog(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload Payroll Sheet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium w-8"></th>
                        <th className="text-left px-4 py-3 font-medium">CRDTS</th>
                        <th className="text-left px-4 py-3 font-medium">Alias</th>
                        <th className="text-right px-4 py-3 font-medium">Net Pay</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Commission</th>
                        <th className="text-right px-4 py-3 font-medium font-semibold">Final Total</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Paid At</th>
                        <th className="text-center px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r) => {
                        const isExpanded = expandedRows.has(r.id);
                        const methods = getPaymentMethods(r);
                        const finalTotal = calcFinalPay(r);
                        const commission = r.commissionEgp ? parseFloat(r.commissionEgp) || 0 : 0;
                        return (
                          <>
                            <tr
                              key={r.id}
                              className="hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => toggleRow(r.id)}
                            >
                              <td className="px-4 py-3 text-muted-foreground">
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4" />
                                  : <ChevronRight className="h-4 w-4" />}
                              </td>
                              <td className="px-4 py-3 font-mono font-medium">{r.crdts ?? "—"}</td>
                              <td className="px-4 py-3">{r.alias ?? "—"}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{fmtEGP(r.netPay)}</td>
                              <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                                {commission > 0 ? fmtEGP(commission) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-bold">{fmtEGP(finalTotal)}</td>
                              <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                {r.paymentStatus === "paid" ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Paid
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                                    <Clock className="h-3 w-3" /> Pending
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                                {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-EG") : "—"}
                              </td>
                              <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                {r.paymentStatus === "paid" ? (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="text-xs h-7 text-amber-600 hover:text-amber-700"
                                    onClick={() => setStatusMutation.mutate({ id: r.id, status: "pending" })}
                                    disabled={setStatusMutation.isPending}
                                  >
                                    Mark Pending
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="text-xs h-7 text-emerald-600 hover:text-emerald-700"
                                    onClick={() => setStatusMutation.mutate({ id: r.id, status: "paid" })}
                                    disabled={setStatusMutation.isPending}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${r.id}-expanded`} className="bg-muted/10">
                                <td colSpan={9} className="px-6 py-4">
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                      <CreditCard className="h-3.5 w-3.5" /> Payment Preferences
                                    </p>
                                    {methods.length === 0 ? (
                                      <p className="text-sm text-muted-foreground italic">No payment preferences submitted by this agent.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-3">
                                        {methods.map(m => (
                                          <div key={m.id} className={`rounded-lg border px-4 py-3 text-sm min-w-[220px] ${m.isPreferred ? "border-primary bg-primary/5" : "bg-background"}`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                              {m.type === "wallet"
                                                ? <Smartphone className="h-4 w-4 text-primary" />
                                                : <Building2 className="h-4 w-4 text-blue-500" />}
                                              <span className="font-semibold capitalize">
                                                {m.type === "wallet"
                                                  ? (m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "Wallet")
                                                  : (m.bankName || "Bank Transfer")}
                                              </span>
                                              {m.isPreferred && <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">Preferred</Badge>}
                                            </div>
                                            {m.type === "wallet" ? (
                                              <>
                                                <p className="text-muted-foreground">{m.walletPhone || "—"}</p>
                                                {m.walletName && <p className="text-xs text-muted-foreground">{m.walletName}</p>}
                                              </>
                                            ) : (
                                              <>
                                                <p className="text-muted-foreground">{m.bankAccountOrPhone || "—"}</p>
                                                {m.bankFullName && <p className="text-xs text-muted-foreground">{m.bankFullName}</p>}
                                              </>
                                            )}
                                            {m.adminComment && (
                                              <p className="text-xs text-amber-600 mt-1 border-t border-amber-200 pt-1">{m.adminComment}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Monthly Guide Tab ── */}
      {activeTab === "guide" && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Monthly Payroll Process</h2>
          </div>
          <p className="text-sm text-muted-foreground">Follow these steps every month to complete payroll accurately and on time.</p>

          {[
            {
              step: 1,
              title: "Generate the payroll data",
              icon: <TrendingUp className="h-4 w-4" />,
              color: "bg-blue-500/10 text-blue-600",
              description: "Use the Python payroll script to calculate base salary, OT (1.5×, 2×, 3×), coaching bonuses, and deductions for all active agents. The script outputs an Excel file matching the upload template.",
              notes: ["Run the script after the last working day of the month", "Verify the CRDTS column matches the active roster", "Check OT hours against the scheduling system"],
            },
            {
              step: 2,
              title: "Upload the payroll sheet",
              icon: <Upload className="h-4 w-4" />,
              color: "bg-primary/10 text-primary",
              description: "Click 'Upload Payroll Sheet' above, select the month, and choose the Excel file. Preview the parsed rows to verify the data before confirming.",
              notes: ["The system matches records by CRDTS — ensure no CRDTS is missing", "Re-uploading the same month overwrites existing records", "Use 'Delete Payroll Sheet' at the bottom to clear a bad import"],
            },
            {
              step: 3,
              title: "Add commission (if applicable)",
              icon: <DollarSign className="h-4 w-4" />,
              color: "bg-emerald-500/10 text-emerald-600",
              description: "Commission is based on monthly performance stats. If agents earned commission this month, either include it in the Commission (EGP) column of the payroll sheet, or upload it separately via the Commission Admin page.",
              notes: ["Commission is shown separately on the agent payslip as 'Commission (Month performance)'", "Final Total = Net Pay + Commission", "If no commission was uploaded, agents see Net Pay only — no Final Total line"],
            },
            {
              step: 4,
              title: "Verify payment preferences",
              icon: <CreditCard className="h-4 w-4" />,
              color: "bg-violet-500/10 text-violet-600",
              description: "Click any agent row in the Payment Status tab to expand their payment preferences inline. Verify their preferred bank account or wallet before sending payments.",
              notes: ["Agents with no payment preferences submitted will show an empty panel", "The 'Preferred' badge marks the agent's primary payment method", "Admin comments on payment methods are shown in amber"],
            },
            {
              step: 5,
              title: "Process payments",
              icon: <Building2 className="h-4 w-4" />,
              color: "bg-orange-500/10 text-orange-600",
              description: "Send payments to each agent using their preferred payment method. Use the Export button to download a CSV of all records with final totals for your accounting records.",
              notes: ["Process preferred methods first", "Export the CSV before marking as paid for your records", "The totals bar at the top shows total disbursed vs pending at a glance"],
            },
            {
              step: 6,
              title: "Mark as paid",
              icon: <CheckCircle2 className="h-4 w-4" />,
              color: "bg-emerald-500/10 text-emerald-600",
              description: "After confirming each payment, click 'Mark Paid' on the agent row. The system records the payment timestamp automatically. You can revert to Pending if needed.",
              notes: ["Mark paid immediately after the transfer is confirmed", "Agents can see their payment status in the portal", "The totals bar updates in real time as you mark agents paid"],
            },
          ].map(({ step, title, icon, color, description, notes }) => (
            <div key={step} className="rounded-xl border bg-card p-5 flex gap-4">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                {icon}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Step {step}</span>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                <ul className="space-y-1">
                  {notes.map((n, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialog} onOpenChange={(o) => { setUploadDialog(o); if (!o) { setParsedRows([]); setParseError(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Payroll Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Payroll Month</label>
                <input
                  type="month"
                  value={uploadMonth}
                  onChange={e => setUploadMonth(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-sm font-medium">Excel File</label>
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Choose File
                  </Button>
                  <span className="text-xs text-muted-foreground">Matched by CRDTS column</span>
                </div>
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <span>{parseError}</span>
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{parsedRows.length} rows parsed successfully — ready to upload for <strong>{formatMonthLabel(uploadMonth)}</strong></span>
                </div>
                <div className="overflow-x-auto max-h-64 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr className="border-b">
                        <th className="text-left px-3 py-2 font-medium">CRDTS</th>
                        <th className="text-left px-3 py-2 font-medium">Alias</th>
                        <th className="text-right px-3 py-2 font-medium">Base Salary</th>
                        <th className="text-right px-3 py-2 font-medium">Hrs</th>
                        <th className="text-right px-3 py-2 font-medium">OT 1.5×</th>
                        <th className="text-right px-3 py-2 font-medium">OT 2×</th>
                        <th className="text-right px-3 py-2 font-medium">OT 3×</th>
                        <th className="text-right px-3 py-2 font-medium">Coaching</th>
                        <th className="text-right px-3 py-2 font-medium">Commission</th>
                        <th className="text-right px-3 py-2 font-medium">Deductions</th>
                        <th className="text-right px-3 py-2 font-medium text-emerald-600">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono">{r.crdts}</td>
                          <td className="px-3 py-1.5">{r.alias || "—"}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.baseSalary)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(r.workingHours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.ot1x5Pay)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.ot2xPay)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.ot3xPay)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.coachingBonus)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.commissionEgp)}</td>
                          <td className="px-3 py-1.5 text-right text-red-500">{fmtEGP(r.totalDeductions)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">{fmtEGP(r.netPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setParsedRows([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    Clear
                  </Button>
                  <Button
                    onClick={() => uploadMutation.mutate({ month: uploadMonth, rows: parsedRows })}
                    disabled={uploadMutation.isPending}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadMutation.isPending ? "Uploading…" : `Upload ${parsedRows.length} Records`}
                  </Button>
                </div>
              </div>
            )}

            {parsedRows.length === 0 && !parseError && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground space-y-1">
                <p>Choose an Excel file to preview the parsed rows before uploading.</p>
                <p className="text-xs">Expected columns: CRDTS | Alias | Working Hours | Base Salary (EGP) | OT 1.5x Hours | OT 1.5x Pay (EGP) | OT 2x Hours | OT 2x Pay (EGP) | OT 3x Hours | OT 3x Pay (EGP) | Coaching Bonus (EGP) | Commission (EGP) | Quality/Attendance Deductions (EGP) | Total Deductions (EGP) | NET PAY (EGP) | Quality Detail | Attendance Detail</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Payroll Section ── */}
      <DeletePayrollSection />
    </div>
  );
}

// ─── Delete Payroll Section ────────────────────────────────────────────────────
function DeletePayrollSection() {
  const [deleteMonth, setDeleteMonth] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteForMonthMutation = trpc.payrollV2.deleteForMonth.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} payroll rows for ${deleteMonth}`);
      setDeleteMonth("");
      setConfirmOpen(false);
      utils.payrollV2.getStatusPage.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-semibold text-destructive">Delete Payroll Sheet</h3>
      </div>
      <p className="text-xs text-muted-foreground">Delete all payroll records for a specific month. Use this to revert a bad import. This cannot be undone.</p>
      <div className="flex gap-2 max-w-sm">
        <Input type="month" value={deleteMonth} onChange={e => setDeleteMonth(e.target.value)} className="h-8 text-xs" />
        <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => { if (!deleteMonth) { toast.error("Select a month"); return; } setConfirmOpen(true); }} disabled={!deleteMonth}>
          Delete Month
        </Button>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete Payroll</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all payroll records for <strong>{deleteMonth}</strong>. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteForMonthMutation.mutate({ month: deleteMonth })} disabled={deleteForMonthMutation.isPending}>
              {deleteForMonthMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
