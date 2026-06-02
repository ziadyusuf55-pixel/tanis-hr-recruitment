import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, CheckCircle2, Clock, AlertTriangle, Info, DollarSign, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ParsedCommRow = {
  crdts: string;
  alias?: string;
  commissionEgp: number;
  performanceMonth?: string;
};

type CommRecord = {
  id: number;
  crdts: string | null;
  alias: string | null;
  commissionEgp: string | null;
  performanceMonth: string | null;
  paymentCycle: string;
  paymentStatus: string | null;
};

type Warning = { crdts: string; alias?: string; type: string; message: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined, prefix = ""): string {
  if (val == null || val === "") return "—";
  const n = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtEGP(val: string | number | null | undefined) { return fmt(val, "EGP "); }

function formatMonthLabel(m: string) {
  if (!m) return m;
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function n(v: string | null | undefined) {
  const p = parseFloat(v ?? "0");
  return isNaN(p) ? 0 : p;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CommissionAdmin() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"records" | "upload">("records");

  // Records tab state
  const [viewMonth, setViewMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: commRecords = [], isLoading: loadingRecords, refetch: refetchRecords } =
    trpc.commission.getForMonth.useQuery({ month: viewMonth });

  const records = commRecords as CommRecord[];
  const totalCommission = records.reduce((s, r) => s + n(r.commissionEgp), 0);
  const paidCount = records.filter(r => r.paymentStatus === "paid").length;

  // Upload dialog state
  const [uploadDialog, setUploadDialog] = useState(false);
  const [payCycle, setPayCycle] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [performanceMonth, setPerformanceMonth] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCommRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<Warning[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit commission state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const updateCommissionMutation = trpc.commission.updateCommission.useMutation({
    onSuccess: () => {
      toast.success("Commission updated and synced to payroll");
      setEditingId(null);
      utils.commission.getForMonth.invalidate({ month: viewMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadMutation = trpc.commission.upload.useMutation({
    onSuccess: (data) => {
      const d = data as { count: number; warnings: Warning[] };
      const warns = d.warnings ?? [];
      if (warns.length > 0) {
        setUploadWarnings(warns);
        toast.success(`Uploaded ${d.count} commission records — ${warns.length} warning${warns.length > 1 ? "s" : ""}`);
      } else {
        toast.success(`Uploaded ${d.count} commission records for ${formatMonthLabel(payCycle)}`);
        setUploadDialog(false);
        setParsedRows([]);
        setPerformanceMonth("");
      }
      setViewMonth(payCycle);
      setActiveTab("records");
      utils.commission.getForMonth.invalidate({ month: payCycle });
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
        // Priority: "Manus Upload" > "Main" > "Commission" > first sheet
        const sheetName = wb.SheetNames.find(n =>
          n.toLowerCase().replace(/\s/g, "") === "manusupload"
        ) ?? wb.SheetNames.find(n =>
          n.toLowerCase().includes("main") || n.toLowerCase().includes("commission")
        ) ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        // rawNumbers: false keeps text-prefixed numbers as strings (handles '114063 apostrophe trick)
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, rawNumbers: false });

        if (raw.length === 0) { setParseError("File appears empty."); return; }

        const norm = (k: string) => k.toLowerCase().replace(/[\s()%_-]/g, "");
        const rows: ParsedCommRow[] = raw.map((r) => {
          const get = (key: string) => {
            const found = Object.keys(r).find(k => norm(k) === norm(key));
            return found ? r[found] : null;
          };
          const num = (v: unknown): number => {
            if (v == null || v === "") return 0;
            // Strip any leading apostrophe Excel uses to force text
            const s = String(v).replace(/^'/, "").trim();
            const n = Number(s); return isNaN(n) ? 0 : n;
          };
          const cleanCrdts = (v: unknown): string => {
            // Strip leading apostrophe if present (Excel text-format trick)
            return String(v ?? "").replace(/^'/, "").trim();
          };
          return {
            crdts: cleanCrdts(get("CRDTS")),
            alias: String(get("Alias") ?? "").trim() || undefined,
            commissionEgp: num(get("Commission (EGP)") ?? get("Commission")),
            performanceMonth: String(get("Performance Month") ?? performanceMonth ?? "").trim() || undefined,
          };
        }).filter(r => {
          // Skip rows where CRDTS is not a valid numeric-like code (catches text notes like row 9)
          if (r.crdts === "") return false;
          if (r.commissionEgp <= 0) return false;
          // Skip rows where CRDTS looks like a sentence/note (contains spaces or is non-numeric)
          if (/\s/.test(r.crdts) || !/^\d+$/.test(r.crdts)) return false;
          return true;
        });

        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure CRDTS and Commission (EGP) columns are present and commission > 0.");
          return;
        }
        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const headers = ["CRDTS", "Alias", "Commission (EGP)", "Performance Month"];
    const example = ["67164", "Alex", 800, "March 2026"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, "Commission");
    XLSX.writeFile(wb2, "commission_template.xlsx");
  }

  function exportRecords() {
    const rows = records.map(r => ({
      CRDTS: r.crdts ?? "",
      Alias: r.alias ?? "",
      "Commission (EGP)": r.commissionEgp ?? "",
      "Performance Month": r.performanceMonth ?? "",
      "Pay Cycle": formatMonthLabel(r.paymentCycle),
      Status: r.paymentStatus ?? "pending",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, "Commission");
    XLSX.writeFile(wb2, `commission_${viewMonth}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commission</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload and manage agent commissions — separate from salary, based on performance 2 months prior
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => {
            setParsedRows([]); setParseError(null); setUploadWarnings([]); setUploadDialog(true);
          }}>
            <Upload className="h-3.5 w-3.5" /> Upload Commission
          </Button>
        </div>
      </div>

      {/* Date treatment info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Commission Date Treatment</p>
          <p className="text-xs leading-relaxed">
            Commission is earned in a full calendar month (1st → last day) and paid <strong>2 months later</strong>.
            Example: January performance → paid on 1st March (in the March pay cycle).
            Upload commission for any past or current pay cycle — backdating is fully supported.
          </p>
          <p className="text-xs font-medium text-blue-700 mt-1">
            Training bonus (paid to all agents equally) is also uploaded here — same column, same flow.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["records", "upload"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "records" ? "Commission Records" : "Upload Guide"}
          </button>
        ))}
      </div>

      {/* ── Records Tab ── */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {/* Month picker + summary */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Pay Cycle:</label>
              <input
                type="month"
                value={viewMonth}
                onChange={e => setViewMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-emerald-600">{paidCount} Paid</span>
                {" · "}
                <span className="font-medium text-amber-500">{records.length - paidCount} Pending</span>
                {" · "}
                {records.length} agents
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportRecords} disabled={records.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </div>

          {/* Summary card */}
          {records.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Commission</p>
                  <p className="text-xl font-bold">{fmtEGP(totalCommission)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{records.length} agents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Paid</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {fmtEGP(records.filter(r => r.paymentStatus === "paid").reduce((s, r) => s + n(r.commissionEgp), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{paidCount} agents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Pending</p>
                  <p className="text-xl font-bold text-amber-500">
                    {fmtEGP(records.filter(r => r.paymentStatus !== "paid").reduce((s, r) => s + n(r.commissionEgp), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{records.length - paidCount} agents</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loadingRecords ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <DollarSign className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-base font-medium text-muted-foreground">No commission records for {formatMonthLabel(viewMonth)}</p>
                <p className="text-sm text-muted-foreground/70">Upload a commission file to see records here</p>
                <Button size="sm" className="mt-2 gap-1.5" onClick={() => setUploadDialog(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload Commission
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
                        <th className="text-left px-4 py-3 font-medium">Performance Period</th>
                        <th className="text-right px-4 py-3 font-medium text-emerald-600">Commission</th>
                        <th className="text-center px-4 py-3 font-medium">Pay Cycle</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium">{r.crdts ?? "—"}</td>
                          <td className="px-4 py-3">{r.alias ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {r.performanceMonth?.replace("Commission (", "").replace(" performance)", "") ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                            {editingId === r.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-muted-foreground">EGP</span>
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="w-24 text-right text-sm border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === "Enter") updateCommissionMutation.mutate({ id: r.id, commissionEgp: parseFloat(editValue) || 0 });
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                />
                                <button onClick={() => updateCommissionMutation.mutate({ id: r.id, commissionEgp: parseFloat(editValue) || 0 })} className="text-emerald-600 hover:text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                                <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 group">
                                {fmtEGP(r.commissionEgp)}
                                <button
                                  onClick={() => { setEditingId(r.id); setEditValue(String(n(r.commissionEgp))); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                  title="Edit commission amount"
                                ><Pencil className="h-3 w-3" /></button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{formatMonthLabel(r.paymentCycle)}</td>
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
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm">Total Commission:</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmtEGP(totalCommission)}</td>
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

      {/* ── Upload Guide Tab ── */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">How to upload commission</p>
              <ol className="space-y-1.5 text-xs list-decimal pl-4">
                <li>After the end of the calendar month (e.g. after 31 March), export Vicidial for the full month (1→31)</li>
                <li>Run the Python commission script — it generates a ranked file by campaign</li>
                <li>Fill the yellow Commission column for eligible agents</li>
                <li>For training bonus — fill the same column for ALL agents equally</li>
                <li>Click "Upload Commission" above — select Pay Cycle and Performance Month</li>
                <li>Upload the file — commission appears on the agent's payslip labeled "Commission (Month performance)"</li>
                <li>Backdating is supported — you can attach commission to any past pay cycle</li>
              </ol>
              <p className="text-xs mt-3 font-medium">
                Required columns: CRDTS, Commission (EGP) | Optional: Alias, Performance Month
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialog} onOpenChange={(o) => {
        setUploadDialog(o);
        if (!o) { setParsedRows([]); setParseError(null); setUploadWarnings([]); if (fileInputRef.current) fileInputRef.current.value = ""; }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Commission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Pay cycle + performance month */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Pay Cycle (which payslip)</label>
                <input
                  type="month"
                  value={payCycle}
                  onChange={e => setPayCycle(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <p className="text-xs text-muted-foreground">Which month's payslip this commission appears on</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Performance Month (label)</label>
                <input
                  type="text"
                  placeholder="e.g. March 2026"
                  value={performanceMonth}
                  onChange={e => setPerformanceMonth(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <p className="text-xs text-muted-foreground">Shown on payslip as "Commission (March 2026 performance)"</p>
              </div>
            </div>

            {/* File picker */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Commission File (Python output)</label>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Choose File
                </Button>
                <span className="text-xs text-muted-foreground">Tanis_Commission_[Month].xlsx from Python</span>
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4" /><span>{parseError}</span>
              </div>
            )}

            {/* Warnings */}
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
                <Button size="sm" onClick={() => { setUploadDialog(false); setUploadWarnings([]); setParsedRows([]); }}>
                  Close
                </Button>
              </div>
            )}

            {/* Preview */}
            {parsedRows.length > 0 && uploadWarnings.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {parsedRows.length} rows parsed — pay cycle: <strong>{formatMonthLabel(payCycle)}</strong>
                    {performanceMonth && <> — performance: <strong>{performanceMonth}</strong></>}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-56 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr className="border-b">
                        <th className="text-left px-3 py-2 font-medium">CRDTS</th>
                        <th className="text-left px-3 py-2 font-medium">Alias</th>
                        <th className="text-right px-3 py-2 font-medium text-emerald-600">Commission (EGP)</th>
                        <th className="text-left px-3 py-2 font-medium">Performance Month</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono">{r.crdts}</td>
                          <td className="px-3 py-1.5">{r.alias || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">
                            {r.commissionEgp.toLocaleString("en-EG")} EGP
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.performanceMonth || performanceMonth || "—"}</td>
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
                    onClick={() => {
                      if (!payCycle) { toast.error("Select a pay cycle"); return; }
                      if (!performanceMonth) { toast.error("Enter the performance month (e.g. March 2026)"); return; }
                      uploadMutation.mutate({
                        paymentCycle: payCycle,
                        rows: parsedRows.map(r => ({
                          crdts: r.crdts,
                          alias: r.alias,
                          commissionEgp: r.commissionEgp,
                          performanceMonth: r.performanceMonth || performanceMonth,
                        })),
                      });
                    }}
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
                <p>Upload the Python commission script output (Tanis_Commission_[Month].xlsx)</p>
                <p className="text-xs">Required: CRDTS, Commission (EGP) | Optional: Performance Month (can be set above)</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
