import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, ChevronLeft, ChevronRight, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type PayrollRow = {
  agentCode: string;
  agentName: string;
  baseSalary: number | null;
  workingHours: number | null;
  overtimeHours: number | null;
  commission: number | null;
  deductions: number | null;
  netPay: number | null;
};

type DbPayrollRecord = {
  id: number;
  agentCode: string | null;
  month: string;
  baseSalary: string | null;
  workingHours: string | null;
  overtimeHours: string | null;
  commission: string | null;
  deductions: string | null;
  netPay: string | null;
  uploadedBy: string | null;
  uploadedAt: number | null;
};

function fmt(val: string | null | undefined, prefix = ""): string {
  if (val == null || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtEGP(val: string | null | undefined): string {
  return fmt(val, "EGP ");
}

export default function PayrollPage() {
  const utils = trpc.useUtils();
  const { data: months = [], isLoading: loadingMonths } = trpc.agent.getPayrollMonths.useQuery();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? months[0] ?? null;
  const monthIndex = months.indexOf(activeMonth ?? "");

  const { data: records = [], isLoading: loadingRecords } = trpc.agent.getPayrollByMonth.useQuery(
    { month: activeMonth! },
    { enabled: !!activeMonth }
  );

  // Upload state
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadMonth, setUploadMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [parsedRows, setParsedRows] = useState<PayrollRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.agent.uploadPayroll.useMutation({
    onSuccess: (data) => {
      toast.success(`Uploaded ${data.count} payroll records for ${uploadMonth}`);
      setUploadDialog(false);
      setParsedRows([]);
      setSelectedMonth(uploadMonth);
      utils.agent.getPayrollMonths.invalidate();
      utils.agent.getPayrollByMonth.invalidate({ month: uploadMonth });
    },
    onError: (e) => toast.error(e.message),
  });

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

        if (raw.length === 0) {
          setParseError("The file appears to be empty.");
          return;
        }

        // Normalize header keys
        const normalize = (k: string) => k.toLowerCase().replace(/\s+/g, "");
        const rows: PayrollRow[] = raw.map((r) => {
          const get = (key: string) => {
            const found = Object.keys(r).find(k => normalize(k) === normalize(key));
            return found ? r[found] : null;
          };
          const num = (v: unknown) => {
            if (v == null || v === "") return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
          };
          return {
            agentCode: String(get("Agent Code") ?? get("agentcode") ?? "").trim(),
            agentName: String(get("Agent Name") ?? get("agentname") ?? "").trim(),
            baseSalary: num(get("Base Salary") ?? get("basesalary")),
            workingHours: num(get("Working Hours") ?? get("workinghours")),
            overtimeHours: num(get("Overtime Hours") ?? get("overtimehours")),
            commission: num(get("Commission") ?? get("commission")),
            deductions: num(get("Deductions") ?? get("deductions")),
            netPay: num(get("Net Pay") ?? get("netpay")),
          };
        }).filter(r => r.agentCode !== "");

        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure the 'Agent Code' column is present and filled.");
          return;
        }
        setParsedRows(rows);
      } catch (err) {
        setParseError("Failed to parse the file. Please use the provided template.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Agent Code", "Agent Name", "Base Salary", "Working Hours", "Overtime Hours", "Commission", "Deductions", "Net Pay"],
      ["TN-001", "Ahmed Hassan", 4500, 176, 12, 800, 200, 5100],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, "payroll_template.xlsx");
  }

  const prevMonth = monthIndex < months.length - 1 ? months[monthIndex + 1] : null;
  const nextMonth = monthIndex > 0 ? months[monthIndex - 1] : null;

  function formatMonthLabel(m: string) {
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload and manage monthly agent payroll records</p>
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

      {/* Month selector */}
      {months.length > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" disabled={!prevMonth} onClick={() => setSelectedMonth(prevMonth!)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold min-w-[160px] text-center">
            {activeMonth ? formatMonthLabel(activeMonth) : "—"}
          </span>
          <Button variant="ghost" size="icon" disabled={!nextMonth} onClick={() => setSelectedMonth(nextMonth!)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">{(records as DbPayrollRecord[]).length} record{(records as DbPayrollRecord[]).length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Records table */}
      {loadingMonths || loadingRecords ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
      ) : months.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-muted-foreground">No payroll records yet</p>
            <p className="text-sm text-muted-foreground/70">Upload a payroll Excel sheet to get started</p>
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
                    <th className="text-left px-4 py-3 font-medium">Agent Code</th>
                    <th className="text-right px-4 py-3 font-medium">Base Salary</th>
                    <th className="text-right px-4 py-3 font-medium">Working Hrs</th>
                    <th className="text-right px-4 py-3 font-medium">Overtime Hrs</th>
                    <th className="text-right px-4 py-3 font-medium">Commission</th>
                    <th className="text-right px-4 py-3 font-medium">Deductions</th>
                    <th className="text-right px-4 py-3 font-medium text-emerald-600">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(records as DbPayrollRecord[]).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{r.agentCode}</td>
                      <td className="px-4 py-3 text-right">{fmtEGP(r.baseSalary)}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.workingHours)}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.overtimeHours)}</td>
                      <td className="px-4 py-3 text-right">{fmtEGP(r.commission)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{r.deductions && parseFloat(r.deductions) > 0 ? `- ${fmtEGP(r.deductions)}` : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtEGP(r.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={(o) => { setUploadDialog(o); if (!o) { setParsedRows([]); setParseError(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Payroll Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
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
                <label className="text-sm font-medium">Excel / CSV File</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Choose File
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Get Template
                  </Button>
                </div>
              </div>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} parsed successfully</span>
                </div>
                <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Code</th>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-right px-3 py-2 font-medium">Base</th>
                        <th className="text-right px-3 py-2 font-medium">Hrs</th>
                        <th className="text-right px-3 py-2 font-medium">OT</th>
                        <th className="text-right px-3 py-2 font-medium">Comm.</th>
                        <th className="text-right px-3 py-2 font-medium">Ded.</th>
                        <th className="text-right px-3 py-2 font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-mono">{r.agentCode}</td>
                          <td className="px-3 py-1.5">{r.agentName || "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.baseSalary ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.workingHours ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.overtimeHours ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.commission ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.deductions ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold">{r.netPay ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUploadDialog(false)}>Cancel</Button>
            <Button
              disabled={parsedRows.length === 0 || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate({ month: uploadMonth, rows: parsedRows })}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? "Uploading..." : `Upload ${parsedRows.length > 0 ? `(${parsedRows.length})` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
