import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, ChevronLeft, ChevronRight, FileSpreadsheet, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = {
  crdts: string;
  alias?: string;
  agentCode?: string;
  baseSalary?: number;
  workingHours?: number;
  ot1x5Hours?: number;
  ot2xHours?: number;
  ot3xHours?: number;
  commissionEgp?: number;
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
  netPay: string | null;
  paymentStatus: string | null;
  paidAt: number | null;
  month: string;
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayrollPage() {
  const utils = trpc.useUtils();

  // Tabs: "upload" = old agent-code-based view, "status" = new CRDTS-based status page
  const [activeTab, setActiveTab] = useState<"upload" | "status">("status");

  // ── Status tab state ──
  const [statusMonth, setStatusMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: statusRecords = [], isLoading: loadingStatus, refetch: refetchStatus } =
    trpc.payrollV2.getStatusPage.useQuery({ month: statusMonth });

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
            baseSalary: num(get("Base Salary (EGP)")),
            workingHours: num(get("Working Hours")),
            ot1x5Hours: num(get("OT 1.5x Hours")),
            ot2xHours: num(get("OT 2x Hours")),
            ot3xHours: num(get("OT 3x Hours")),
            commissionEgp: num(get("Commission (EGP)")),
            qualityDeductions: num(get("Quality Deductions (EGP)")),
            attendanceDeductions: num(get("Attendance Deductions (EGP)")),
            totalDeductions: num(get("Total Deductions (EGP)")),
            netPay: num(get("Net Pay (EGP)")),
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
      "CRDTS", "Alias", "Agent Code",
      "Base Salary (EGP)", "Working Hours",
      "OT 1.5x Hours", "OT 2x Hours", "OT 3x Hours",
      "Commission (EGP)", "Quality Deductions (EGP)", "Attendance Deductions (EGP)",
      "Total Deductions (EGP)", "Net Pay (EGP)",
      "Quality Detail", "Attendance Detail",
    ];
    const example = [
      "1001", "Harry", "TN-001",
      4500, 176,
      8, 4, 0,
      800, 100, 50,
      150, 5150,
      "Late 2x", "Absent 1 day",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, "payroll_template_v2.xlsx");
  }

  function exportStatusCSV() {
    const rows = (statusRecords as StatusRecord[]).map(r => ({
      CRDTS: r.crdts ?? "",
      Alias: r.alias ?? "",
      "Agent Code": r.agentCode ?? "",
      "Net Pay (EGP)": r.netPay ? parseFloat(r.netPay) : "",
      Status: r.paymentStatus ?? "pending",
      "Paid At": r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-EG") : "",
      Month: r.month,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Status");
    XLSX.writeFile(wb, `payroll_status_${statusMonth}.xlsx`);
  }

  const paidCount = (statusRecords as StatusRecord[]).filter(r => r.paymentStatus === "paid").length;
  const pendingCount = (statusRecords as StatusRecord[]).length - paidCount;

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
          {/* Month picker + summary */}
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
                {(statusRecords as StatusRecord[]).length} total
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportStatusCSV} disabled={(statusRecords as StatusRecord[]).length === 0}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </div>

          {loadingStatus ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : (statusRecords as StatusRecord[]).length === 0 ? (
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
                        <th className="text-left px-4 py-3 font-medium">CRDTS</th>
                        <th className="text-left px-4 py-3 font-medium">Alias</th>
                        <th className="text-left px-4 py-3 font-medium">Agent Code</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Net Pay</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Paid At</th>
                        <th className="text-center px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(statusRecords as StatusRecord[]).map((r) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium">{r.crdts ?? "—"}</td>
                          <td className="px-4 py-3">{r.alias ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.agentCode ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtEGP(r.netPay)}</td>
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
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-EG") : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.paymentStatus === "paid" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-amber-600 hover:text-amber-700"
                                onClick={() => setStatusMutation.mutate({ id: r.id, status: "pending" })}
                                disabled={setStatusMutation.isPending}
                              >
                                Mark Pending
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => setStatusMutation.mutate({ id: r.id, status: "paid" })}
                                disabled={setStatusMutation.isPending}
                              >
                                Mark Paid
                              </Button>
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
        </div>
      )}

      {/* ── Upload History Tab ── */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use the <strong>Upload Payroll Sheet</strong> button above to upload a new payroll Excel file.
            After uploading, records will appear in the <strong>Payment Status</strong> tab.
          </p>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-base font-medium text-muted-foreground">Upload a payroll sheet to get started</p>
              <p className="text-sm text-muted-foreground/70">Download the template first, fill it in with the Python-generated data, then upload here</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Download Template
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setUploadDialog(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload Payroll Sheet
                </Button>
              </div>
            </CardContent>
          </Card>
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
                <label className="text-sm font-medium">Excel File (Python-generated)</label>
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
                        <th className="text-right px-3 py-2 font-medium">OT 1.5x</th>
                        <th className="text-right px-3 py-2 font-medium">OT 2x</th>
                        <th className="text-right px-3 py-2 font-medium">OT 3x</th>
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
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot1x5Hours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot2xHours)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(r.ot3xHours)}</td>
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
                <p className="text-xs">Expected columns: CRDTS, Alias, Base Salary (EGP), Working Hours, OT 1.5x/2x/3x Hours, Commission (EGP), Quality/Attendance Deductions (EGP), Total Deductions (EGP), Net Pay (EGP), Quality Detail, Attendance Detail</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
