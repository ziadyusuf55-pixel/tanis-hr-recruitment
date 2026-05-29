import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2, Clock, Trash2, Pencil, AlertTriangle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  qualityDeductions?: number;
  attendanceDeductions?: number;
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
  agentStatus: string | null;
  baseSalary: string | null;
  workingHours: string | null;
  ot1x5Hours: string | null;
  ot1x5Pay: string | null;
  ot2xHours: string | null;
  ot2xPay: string | null;
  ot3xHours: string | null;
  ot3xPay: string | null;
  coachingBonus: string | null;
  qualityDeductions: string | null;
  attendanceDeductions: string | null;
  totalDeductions: string | null;
  commissionEgp: string | null;
  netPay: string | null;
  qualityDetail: string | null;
  attendanceDetail: string | null;
  paymentStatus: string | null;
  paidAt: number | null;
  month: string;
};

type Warning = { crdts: string; alias?: string; type: string; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, prefix = ""): string {
  if (val == null || val === "") return "—";
  const n = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtEGP(val: string | number | null | undefined): string { return fmt(val, "EGP "); }
function fmtHrs(val: string | number | null | undefined): string { return fmt(val, "") + (val != null && val !== "" ? " hrs" : ""); }

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function n(v: string | null | undefined) {
  const parsed = parseFloat(v ?? "0");
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayrollPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"status" | "upload">("status");

  // Status tab
  const [statusMonth, setStatusMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<StatusRecord>>({});

  const { data: statusRecords = [], isLoading: loadingStatus, refetch: refetchStatus } =
    trpc.payrollV2.getStatusPage.useQuery({ month: statusMonth });

  const setStatusMutation = trpc.payrollV2.setStatus.useMutation({
    onSuccess: () => { refetchStatus(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  const updateRecordMutation = trpc.payrollV2.updateRecord.useMutation({
    onSuccess: () => {
      refetchStatus();
      setEditingRow(null);
      setEditValues({});
      toast.success("Record updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Upload tab
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadMonth, setUploadMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<Warning[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.payrollV2.uploadPayrollV2.useMutation({
    onSuccess: (data) => {
      const warns = (data as { count: number; warnings: Warning[] }).warnings ?? [];
      if (warns.length > 0) {
        setUploadWarnings(warns);
        toast.success(`Uploaded ${(data as { count: number }).count} records — ${warns.length} warnings`);
      } else {
        toast.success(`Uploaded ${(data as { count: number }).count} payroll records for ${formatMonthLabel(uploadMonth)}`);
        setUploadDialog(false);
        setParsedRows([]);
      }
      setStatusMonth(uploadMonth);
      setActiveTab("status");
      utils.payrollV2.getStatusPage.invalidate({ month: uploadMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Excel parsing ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsedRows([]);
    setUploadWarnings([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        // Find "Payroll" tab or fall back to first sheet
        const sheetName = wb.SheetNames.find(n => n.toLowerCase() === "payroll") ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
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
            qualityDeductions: num(get("Quality/Attendance Deductions (EGP)")) ?? num(get("Quality Deductions (EGP)")),
            attendanceDeductions: num(get("Attendance Deductions (EGP)")),
            totalDeductions: num(get("Total Deductions (EGP)")),
            netPay: num(get("NET PAY (EGP)")) ?? num(get("Net Pay (EGP)")),
            qualityDetail: String(get("Quality Detail") ?? "").trim(),
            attendanceDetail: String(get("Attendance Detail") ?? "").trim(),
          };
        }).filter(r => r.crdts !== "");

        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure the 'CRDTS' column is present.");
          return;
        }
        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse the file. Please use the Python-generated payroll file.");
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
      "Coaching Bonus (EGP)",
      "Quality/Attendance Deductions (EGP)", "Total Deductions (EGP)", "NET PAY (EGP)",
      "Quality Detail", "Attendance Detail",
    ];
    const example = ["67164", "Alex", 166, 12450, 12, 1350, 8, 1200, 0, 0, 75, 150, 150, 14925, "Lateness: 75 EGP", ""];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, "payroll_template.xlsx");
  }

  function exportStatusCSV() {
    const rows = (statusRecords as StatusRecord[]).map(r => ({
      CRDTS: r.crdts ?? "",
      Alias: r.alias ?? "",
      "Agent Code": r.agentCode ?? "",
      "Working Hours": r.workingHours ?? "",
      "Base Salary (EGP)": r.baseSalary ?? "",
      "OT 1.5x Hours": r.ot1x5Hours ?? "",
      "OT 1.5x Pay (EGP)": r.ot1x5Pay ?? "",
      "OT 2x Hours": r.ot2xHours ?? "",
      "OT 2x Pay (EGP)": r.ot2xPay ?? "",
      "OT 3x Hours": r.ot3xHours ?? "",
      "OT 3x Pay (EGP)": r.ot3xPay ?? "",
      "Coaching Bonus (EGP)": r.coachingBonus ?? "",
      "Total Deductions (EGP)": r.totalDeductions ?? "",
      "Net Pay (EGP)": r.netPay ?? "",
      Status: r.paymentStatus ?? "pending",
      "Paid At": r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-EG") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, "Payroll Status");
    XLSX.writeFile(wb2, `payroll_status_${statusMonth}.xlsx`);
  }

  const records = statusRecords as StatusRecord[];
  const paidCount = records.filter(r => r.paymentStatus === "paid").length;
  const pendingCount = records.length - paidCount;
  const totalNetPay = records.reduce((sum, r) => sum + n(r.netPay) + n(r.commissionEgp), 0);
  const totalPaidNetPay = records.filter(r => r.paymentStatus === "paid").reduce((sum, r) => sum + n(r.netPay) + n(r.commissionEgp), 0);
  const totalPendingNetPay = records.filter(r => r.paymentStatus !== "paid").reduce((sum, r) => sum + n(r.netPay) + n(r.commissionEgp), 0);

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
          <Button size="sm" className="gap-1.5" onClick={() => { setParsedRows([]); setParseError(null); setUploadWarnings([]); setUploadDialog(true); }}>
            <Upload className="h-3.5 w-3.5" /> Upload Payroll Sheet
          </Button>
        </div>
      </div>

      {/* Commission reminder banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          <strong>Don't forget commission:</strong> After uploading this payroll, go to the{" "}
          <strong>Commission</strong> tab and upload commission for 2 months ago
          (e.g. if this is May payroll → upload March commission).
          Commission is separate from salary and must be uploaded independently.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["status", "upload"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "status" ? "Payment Status" : "Upload History"}
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-emerald-600">{paidCount} Paid</span>
                {" · "}
                <span className="font-medium text-amber-500">{pendingCount} Pending</span>
                {" · "}
                {records.length} total
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportStatusCSV} disabled={records.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </div>

          {/* ── Totals Summary Bar ── */}
          {records.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total to Disburse</p>
                  <p className="text-xl font-bold text-foreground">{fmtEGP(totalNetPay)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{records.length} agents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Paid</p>
                  <p className="text-xl font-bold text-emerald-600">{fmtEGP(totalPaidNetPay)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{paidCount} agents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Pending</p>
                  <p className="text-xl font-bold text-amber-500">{fmtEGP(totalPendingNetPay)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pendingCount} agents</p>
                </CardContent>
              </Card>
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
                        <th className="text-right px-4 py-3 font-medium">Base Salary</th>
                        <th className="text-right px-4 py-3 font-medium">Total Ded.</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Net Pay</th>
                        <th className="text-right px-4 py-3 font-medium text-blue-600">Commission</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r) => (
                        <>
                          <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                            {/* Expand toggle */}
                            <td className="px-2 py-3">
                              <button
                                onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {expandedRow === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-mono font-medium">{r.crdts ?? "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{r.alias ?? "—"}</span>
                                {r.agentStatus === "resigned" && <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">Resigned</span>}
                                {r.agentStatus === "terminated" && <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">Terminated</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{fmtEGP(r.baseSalary)}</td>
                            <td className="px-4 py-3 text-right text-red-500">{fmtEGP(r.totalDeductions)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtEGP(r.netPay)}</td>
                            <td className="px-4 py-3 text-right font-medium text-blue-600">{r.commissionEgp && parseFloat(r.commissionEgp) > 0 ? fmtEGP(r.commissionEgp) : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="px-4 py-3 text-center">
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
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-xs h-7 text-blue-600 hover:text-blue-700"
                                  onClick={() => { setEditingRow(r.id); setEditValues({ ...r }); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                {r.paymentStatus === "paid" ? (
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-amber-600 hover:text-amber-700"
                                    onClick={() => setStatusMutation.mutate({ id: r.id, status: "pending" })}
                                    disabled={setStatusMutation.isPending}>
                                    Unmark
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-emerald-600 hover:text-emerald-700"
                                    onClick={() => setStatusMutation.mutate({ id: r.id, status: "paid" })}
                                    disabled={setStatusMutation.isPending}>
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded breakdown row */}
                          {expandedRow === r.id && (
                            <tr key={`${r.id}-expand`} className="bg-muted/10">
                              <td colSpan={8} className="px-8 py-4">
                                <div className="grid grid-cols-3 gap-6">
                                  {/* Col 1: Earnings */}
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Earnings Breakdown</p>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span>Base Salary</span><span className="font-medium">{fmtEGP(r.baseSalary)}</span></div>
                                      <div className="flex justify-between text-muted-foreground"><span>Working Hours</span><span>{fmtHrs(r.workingHours)}</span></div>
                                      {n(r.ot1x5Hours) > 0 && <>
                                        <div className="flex justify-between text-blue-600"><span>OT 1.5× ({fmtHrs(r.ot1x5Hours)})</span><span className="font-medium">{fmtEGP(r.ot1x5Pay)}</span></div>
                                      </>}
                                      {n(r.ot2xHours) > 0 && <>
                                        <div className="flex justify-between text-blue-600"><span>OT 2× ({fmtHrs(r.ot2xHours)})</span><span className="font-medium">{fmtEGP(r.ot2xPay)}</span></div>
                                      </>}
                                      {n(r.ot3xHours) > 0 && <>
                                        <div className="flex justify-between text-blue-600"><span>OT 3× ({fmtHrs(r.ot3xHours)})</span><span className="font-medium">{fmtEGP(r.ot3xPay)}</span></div>
                                      </>}
                                      {n(r.coachingBonus) > 0 && (
                                        <div className="flex justify-between text-green-600"><span>Coaching Bonus</span><span className="font-medium">{fmtEGP(r.coachingBonus)}</span></div>
                                      )}
                                      <div className="flex justify-between text-red-500 border-t pt-1 mt-1">
                                        <span>Deductions</span><span>-{fmtEGP(r.totalDeductions)}</span>
                                      </div>
                                      <div className="flex justify-between text-emerald-600 font-semibold border-t pt-1 mt-1">
                                        <span>Net Pay</span><span>{fmtEGP(r.netPay)}</span>
                                      </div>
                                      {r.paidAt && (
                                        <div className="flex justify-between text-muted-foreground mt-1">
                                          <span>Paid</span><span>{new Date(r.paidAt).toLocaleDateString("en-EG")}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Col 2: Deduction detail */}
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deduction Detail</p>
                                    <div className="space-y-1 text-xs">
                                      {r.qualityDetail && r.qualityDetail !== "" ? (
                                        <div>
                                          <p className="text-muted-foreground font-medium mb-0.5">Quality:</p>
                                          <p className="text-red-500">{r.qualityDetail}</p>
                                        </div>
                                      ) : <p className="text-muted-foreground/50">No quality deductions</p>}
                                      {r.attendanceDetail && r.attendanceDetail !== "" && (
                                        <div className="mt-2">
                                          <p className="text-muted-foreground font-medium mb-0.5">Attendance:</p>
                                          <p className="text-red-500">{r.attendanceDetail}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Col 3: Payment preferences */}
                                  <PaymentPreferencesInline agentCode={r.traineeCode ?? r.agentCode} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm">Totals:</td>
                        <td className="px-4 py-3 text-right text-sm">{fmtEGP(records.reduce((s, r) => s + n(r.baseSalary), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-500">{fmtEGP(records.reduce((s, r) => s + n(r.totalDeductions), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmtEGP(totalNetPay)}</td>
                        <td className="px-4 py-3 text-right text-sm text-blue-600">{fmtEGP(records.reduce((s, r) => s + n(r.commissionEgp), 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Upload History Tab ── */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          {/* Admin instructions */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">Admin Payroll Guide</p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold mb-1 text-blue-700">Monthly Process (25th)</p>
                  <ol className="space-y-1 list-decimal pl-4">
                    <li>Download fresh Adherence, Quality and OT logs from SharePoint</li>
                    <li>Export Vicidial: full cycle range (26th → 25th)</li>
                    <li>Put all files + v10 script in same folder</li>
                    <li>Run <code className="bg-blue-100 px-1 rounded">python tanis_vicidial_processor_v10.py</code></li>
                    <li>Review Flags tab and Error Log</li>
                    <li>Upload Payroll tab here on 26th</li>
                    <li>Agents see Net Pay — commission not yet included</li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold mb-1 text-blue-700">Commission (after 31st)</p>
                  <ol className="space-y-1 list-decimal pl-4">
                    <li>Export Vicidial: full calendar month (1st → 31st)</li>
                    <li>Run <code className="bg-blue-100 px-1 rounded">python tanis_commission.py</code></li>
                    <li>Fill yellow Commission column for top performers</li>
                    <li>Fill training bonus for ALL agents (same column)</li>
                    <li>Go to <strong>Commission tab</strong> and upload</li>
                    <li>Agents see Final Total = Net Pay + Commission</li>
                  </ol>
                  <p className="font-semibold mt-2 mb-1 text-blue-700">Payment (1st)</p>
                  <ol className="space-y-1 list-decimal pl-4">
                    <li>Check payment preferences in each agent row (expand ↓)</li>
                    <li>Transfer salary to each agent</li>
                    <li>Click "Mark Paid" per agent</li>
                    <li>Agents see ✓ Paid status on their payslip</li>
                  </ol>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs font-semibold text-blue-700 mb-1">Key Rules</p>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  <li>Commission is based on performance 2 months prior — upload separately in Commission tab</li>
                  <li>Cycle: 26th → 25th | Paid: 1st | Commission period: full calendar month</li>
                  <li>Agents have until 1st to raise concerns about their payslip</li>
                  <li>Use the edit (pencil) button to manually override any record</li>
                  <li>Re-uploading the same file is safe — upsert updates existing records</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Records history for selected month */}
          {records.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Upload Details — {formatMonthLabel(statusMonth)}</p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Records</p>
                    <p className="font-semibold text-lg">{records.length} agents</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uploaded By</p>
                    <p className="font-semibold">{(records[0] as StatusRecord & { uploadedBy?: string | null }).uploadedBy ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uploaded At</p>
                    <p className="font-semibold">
                      {(records[0] as StatusRecord & { uploadedAt?: number | null }).uploadedAt
                        ? new Date((records[0] as StatusRecord & { uploadedAt?: number | null }).uploadedAt!).toLocaleString("en-EG")
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Download Template
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setUploadDialog(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload Payroll Sheet
            </Button>
          </div>
        </div>
      )}

      {/* ── Edit Record Dialog ── */}
      <Dialog open={editingRow !== null} onOpenChange={(o) => { if (!o) { setEditingRow(null); setEditValues({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Payroll Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">CRDTS: <strong>{editValues.crdts}</strong> — {editValues.alias}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["baseSalary", "Base Salary (EGP)"],
                ["workingHours", "Working Hours"],
                ["ot1x5Hours", "OT 1.5x Hours"],
                ["ot1x5Pay", "OT 1.5x Pay (EGP)"],
                ["ot2xHours", "OT 2x Hours"],
                ["ot2xPay", "OT 2x Pay (EGP)"],
                ["ot3xHours", "OT 3x Hours"],
                ["ot3xPay", "OT 3x Pay (EGP)"],
                ["coachingBonus", "Coaching Bonus (EGP)"],
                ["totalDeductions", "Total Deductions (EGP)"],
                ["netPay", "Net Pay (EGP)"],
              ] as [keyof StatusRecord, string][]).map(([field, label]) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    type="number"
                    value={editValues[field] as string ?? ""}
                    onChange={e => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingRow(null); setEditValues({}); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingRow === null) return;
                updateRecordMutation.mutate({ id: editingRow, data: editValues as { baseSalary?: string; workingHours?: string; ot1x5Hours?: string; ot1x5Pay?: string; ot2xHours?: string; ot2xPay?: string; ot3xHours?: string; ot3xPay?: string; coachingBonus?: string; totalDeductions?: string; netPay?: string; } });
              }}
              disabled={updateRecordMutation.isPending}
            >
              {updateRecordMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialog} onOpenChange={(o) => {
        setUploadDialog(o);
        if (!o) { setParsedRows([]); setParseError(null); setUploadWarnings([]); if (fileInputRef.current) fileInputRef.current.value = ""; }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <label className="text-sm font-medium">Excel File (Python v10 output)</label>
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Choose File
                  </Button>
                  <span className="text-xs text-muted-foreground">Matched by CRDTS — commission is NOT included here</span>
                </div>
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4" /><span>{parseError}</span>
              </div>
            )}

            {/* Upload warnings */}
            {uploadWarnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4" />
                  Upload succeeded with {uploadWarnings.length} warning{uploadWarnings.length > 1 ? "s" : ""}:
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 pl-4 max-h-32 overflow-y-auto">
                  {uploadWarnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span><strong>{w.alias || w.crdts}</strong>: {w.message}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" className="mt-2" onClick={() => { setUploadDialog(false); setUploadWarnings([]); setParsedRows([]); }}>
                  Close
                </Button>
              </div>
            )}

            {parsedRows.length > 0 && uploadWarnings.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{parsedRows.length} rows parsed — ready to upload for <strong>{formatMonthLabel(uploadMonth)}</strong></span>
                </div>
                <div className="overflow-x-auto max-h-64 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr className="border-b">
                        <th className="text-left px-3 py-2 font-medium">CRDTS</th>
                        <th className="text-left px-3 py-2 font-medium">Alias</th>
                        <th className="text-right px-3 py-2 font-medium">Base</th>
                        <th className="text-right px-3 py-2 font-medium">Hrs</th>
                        <th className="text-right px-3 py-2 font-medium">OT 1.5x h</th>
                        <th className="text-right px-3 py-2 font-medium">OT 2x h</th>
                        <th className="text-right px-3 py-2 font-medium">OT 3x h</th>
                        <th className="text-right px-3 py-2 font-medium">Coaching</th>
                        <th className="text-right px-3 py-2 font-medium">Ded.</th>
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
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot1x5Hours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot2xHours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot3xHours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtEGP(r.coachingBonus)}</td>
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

            {parsedRows.length === 0 && !parseError && uploadWarnings.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground space-y-1">
                <p>Choose the Python v10 generated payroll file.</p>
                <p className="text-xs">Required: CRDTS column | Commission is NOT included — upload separately in Commission tab</p>
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


// ─── Payment Preferences Inline ────────────────────────────────────────────────
function PaymentPreferencesInline({ agentCode }: { agentCode: string | null }) {
  const { data: methods = [] } = trpc.paymentMethods.listAll.useQuery(undefined, {
    enabled: !!agentCode,
  });
  const agentMethods = (methods as Array<{ traineeCode?: string; type: string; walletProvider?: string | null; walletPhone?: string | null; walletName?: string | null; bankName?: string | null; bankAccountOrPhone?: string | null; bankFullName?: string | null; isPreferred: boolean }>)
    .filter(m => m.traineeCode === agentCode);

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Preferences</p>
      {agentMethods.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">No payment method on file</p>
      ) : (
        <div className="space-y-2">
          {agentMethods.map((m, i) => (
            <div key={i} className={`text-xs rounded-md p-2 border ${m.isPreferred ? "border-emerald-300 bg-emerald-50" : "border-muted bg-muted/20"}`}>
              {m.isPreferred && <p className="text-emerald-600 font-medium text-[10px] mb-0.5">✓ Preferred</p>}
              <p className="font-medium capitalize">{m.type === "wallet" ? `${m.walletProvider?.replace("_", " ")} Wallet` : "Bank Transfer"}</p>
              {m.type === "wallet" && <>
                <p className="text-muted-foreground">{m.walletPhone}</p>
                <p className="text-muted-foreground">{m.walletName}</p>
              </>}
              {m.type === "bank" && <>
                <p className="text-muted-foreground">{m.bankName}</p>
                <p className="text-muted-foreground">{m.bankAccountOrPhone}</p>
                <p className="text-muted-foreground">{m.bankFullName}</p>
              </>}
            </div>
          ))}
        </div>
      )}
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
      toast.success(`Deleted ${(data as { deleted: number }).deleted} payroll rows for ${deleteMonth}`);
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
          <DialogHeader><DialogTitle>Confirm Delete Payroll</DialogTitle></DialogHeader>
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
