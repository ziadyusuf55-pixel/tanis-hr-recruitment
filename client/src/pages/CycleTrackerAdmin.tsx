import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { currentCycleMonth } from "@/lib/cycle";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, BarChart2, XCircle, Zap, CheckCircle, AlertCircle, RefreshCw, Trash2, FileSpreadsheet } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import * as XLSX from "xlsx";
import { toDecimalHours, normalizeOtType, round2 } from "@shared/hours";

// ─── Excel parser helpers ──────────────────────────────────────────────────────
function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
/**
 * Read a sheet twice: raw values (numbers/dates intact) + formatted text (so a
 * time-formatted cell shows up as "8:48" instead of 0.3667). Hours columns use
 * the formatted text to decide whether the cell was a duration.
 */
function readRows(ws: XLSX.WorkSheet): { raw: Record<string, unknown>[]; fmt: Record<string, unknown>[] } {
  return {
    raw: XLSX.utils.sheet_to_json(ws, { defval: "" }),
    fmt: XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }),
  };
}
/** Hours from a row: null means "unreadable — reject this row". */
function hoursOf(raw: Record<string, unknown>, fmt: Record<string, unknown> | undefined, keys: string[]): number | null {
  const k = keys.find(k => raw[k] !== undefined && raw[k] !== "");
  if (!k) return 0;
  const h = toDecimalHours(raw[k], fmt?.[k]);
  return h == null ? null : round2(h);
}
class RowRejects {
  list: string[] = [];
  add(rowNo: number, who: string, why: string) { this.list.push(`row ${rowNo}${who ? ` (${who})` : ""}: ${why}`); }
  get count() { return this.list.length; }
  summary(max = 8) { return this.list.slice(0, max).join("; ") + (this.list.length > max ? ` … +${this.list.length - max} more` : ""); }
}
function parseString(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
function parseDate(v: unknown): string {
  if (!v) return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  // Sheets here are DD/MM/YYYY (Egypt). Never let new Date() read 09/06 as September 6.
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // Build from LOCAL parts — toISOString() would shift a midnight date to the previous day.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return s;
}

// ─── Delete Stats Section ──────────────────────────────────────────────────────
function DeleteStatsSection({ cycleKey }: { cycleKey?: string }) {
  const [deleteDate, setDeleteDate] = useState("");
  const [deleteCycleKey, setDeleteCycleKey] = useState(cycleKey ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<"date" | "cycle">("date");

  const deleteByDateMutation = trpc.cycleTracker.deleteStatsForDate.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} rows for ${deleteDate}`);
      setDeleteDate("");
      setConfirmOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteByCycleMutation = trpc.cycleTracker.deleteStatsForCycle.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} rows for cycle ${deleteCycleKey}`);
      setConfirmOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function openConfirm(type: "date" | "cycle") {
    if (type === "date" && !deleteDate) { toast.error("Enter a date first"); return; }
    if (type === "cycle" && !deleteCycleKey) { toast.error("Enter a cycle key first"); return; }
    setConfirmType(type);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (confirmType === "date") deleteByDateMutation.mutate({ date: deleteDate });
    else deleteByCycleMutation.mutate({ cycleKey: deleteCycleKey });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-semibold text-destructive">Delete / Revert Uploaded Data</h3>
      </div>
      <p className="text-xs text-muted-foreground">Use this to undo a bad upload. Deletes all stats rows matching the date or cycle. This cannot be undone.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium">Delete by specific date</p>
          <div className="flex gap-2">
            <Input type="date" value={deleteDate} onChange={e => setDeleteDate(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => openConfirm("date")} disabled={!deleteDate}>
              Delete
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium">Delete entire cycle (YYYY-MM)</p>
          <div className="flex gap-2">
            <Input placeholder="e.g. 2026-05" value={deleteCycleKey} onChange={e => setDeleteCycleKey(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => openConfirm("cycle")} disabled={!deleteCycleKey}>
              Delete
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmType === "date"
              ? `This will permanently delete all stats rows for date ${deleteDate}. Are you sure?`
              : `This will permanently delete ALL stats rows for cycle ${deleteCycleKey}. This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={deleteByDateMutation.isPending || deleteByCycleMutation.isPending}>
              {deleteByDateMutation.isPending || deleteByCycleMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab result type ──────────────────────────────────────────────────────────
type TabResult = {
  tab: string;
  status: "skipped" | "done" | "error";
  count?: number;
  cycleKey?: string;
  error?: string;
};

const TAB_NAMES = {
  stats: "Stats Upload",
  deductions: "Deductions Upload",
  ot: "OT Upload",
  coaching: "Coaching Upload",
} as const;

const TAB_ICONS: Record<string, React.ReactNode> = {
  [TAB_NAMES.stats]: <BarChart2 className="w-4 h-4" />,
  [TAB_NAMES.deductions]: <XCircle className="w-4 h-4" />,
  [TAB_NAMES.ot]: <Zap className="w-4 h-4" />,
  [TAB_NAMES.coaching]: <CheckCircle className="w-4 h-4" />,
};

const TAB_COLORS: Record<string, string> = {
  [TAB_NAMES.stats]: "oklch(0.55 0.18 250)",
  [TAB_NAMES.deductions]: "oklch(0.55 0.22 25)",
  [TAB_NAMES.ot]: "oklch(0.55 0.18 145)",
  [TAB_NAMES.coaching]: "oklch(0.55 0.18 300)",
};

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function CycleTrackerAdmin() {
  const { data: cycleInfo } = trpc.cycleTracker.getCurrentCycle.useQuery();
  const uploadStatsMutation = trpc.cycleTracker.uploadStats.useMutation();
  const uploadDeductionsMutation = trpc.cycleTracker.uploadDeductions.useMutation();
  const uploadOTMutation = trpc.cycleTracker.uploadOT.useMutation();
  const uploadCoachingMutation = trpc.coaching.upload.useMutation();

  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<TabResult[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // ── Per-tab parsers ──────────────────────────────────────────────────────────

  async function processStatsSheet(ws: XLSX.WorkSheet): Promise<TabResult> {
    const { raw, fmt } = readRows(ws);
    const rej = new RowRejects();
    const rows = raw.map((r, i) => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? r["agent_code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? r["Code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      date: parseDate(r["Date"] ?? r["date"] ?? ""),
      loginHours: (() => { const h = hoursOf(r, fmt[i], ["Login Hours", "login_hours", "LoginHours"]); if (h == null || h > 24) { rej.add(i + 2, parseString(r["CRDTS"] ?? r["crdts"]), `unreadable Login Hours "${r["Login Hours"] ?? r["login_hours"] ?? r["LoginHours"]}"`); return NaN; } return h; })(),
      totalCalls: parseNumber(r["Total Calls"] ?? r["total_calls"] ?? r["TotalCalls"] ?? 0),
      revenue: parseNumber(r["Revenue"] ?? r["revenue"] ?? 0),
      cost: parseNumber(r["Cost"] ?? r["cost"] ?? 0),
      profit: parseNumber(r["Profit"] ?? r["profit"] ?? 0),
      revPerHr: parseNumber(r["Rev/Hr"] ?? r["rev_per_hr"] ?? r["RevPerHr"] ?? r["Rev Per Hr"] ?? 0),
    })).filter(r => r.crdts && r.date && !Number.isNaN(r.loginHours));
    if (rej.count) return { tab: TAB_NAMES.stats, status: "error", error: `${rej.count} row(s) rejected — nothing uploaded. Fix the sheet: ${rej.summary()}` };
    if (rows.length === 0) return { tab: TAB_NAMES.stats, status: "error", error: "No valid rows. Check CRDTS and Date columns." };
    const res = await uploadStatsMutation.mutateAsync({ rows });
    return { tab: TAB_NAMES.stats, status: "done", count: res.count, cycleKey: res.cycleKey };
  }

  async function processDeductionsSheet(ws: XLSX.WorkSheet): Promise<TabResult> {
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    const fmtRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];
    if (rawRows.length < 2) return { tab: TAB_NAMES.deductions, status: "error", error: "Sheet appears empty." };
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      if ((rawRows[i] as unknown[]).some(c => typeof c === "string" && c.replace(/\n/g, " ").toUpperCase().includes("CRDTS"))) {
        headerRowIdx = i;
        break;
      }
    }
    const headers = (rawRows[headerRowIdx] as unknown[]).map(h =>
      typeof h === "string" ? h.replace(/\n/g, " ").trim().toLowerCase() : ""
    );
    const colIdx = (keys: string[]) => {
      for (const key of keys) {
        const idx = headers.findIndex(h => h.includes(key.toLowerCase()));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const getVal = (row: unknown[], keys: string[]) => {
      const idx = colIdx(keys);
      return idx >= 0 ? (row as unknown[])[idx] : "";
    };
    const rej = new RowRejects();
    const rows = (rawRows.slice(headerRowIdx + 1) as unknown[][]).map((row, i) => {
      const fmtRow = fmtRows[headerRowIdx + 1 + i] ?? [];
      const hRaw = getVal(row, ["override hours", "escalation hours", "hours"]);
      const hFmt = getVal(fmtRow, ["override hours", "escalation hours", "hours"]);
      const h = toDecimalHours(hRaw, hFmt);
      const crdts = parseString(getVal(row, ["crdts", "agent code"]));
      const deductionAmount = parseNumber(getVal(row, ["deduction", "amount"]));
      if (h == null && crdts && deductionAmount > 0) rej.add(headerRowIdx + 2 + i, crdts, `unreadable hours "${hRaw}"`);
      return {
        crdts,
        agentCode: parseString(getVal(row, ["agent code", "agent_code"])),
        alias: parseString(getVal(row, ["alias"])),
        date: parseDate(getVal(row, ["date"])),
        violationType: parseString(getVal(row, ["violation type", "violationtype", "violation", "type"])),
        hours: h == null ? NaN : round2(h),
        deductionAmount,
        status: (parseString(getVal(row, ["status"]) || "approved").toLowerCase() === "rejected" ? "rejected" : "approved") as "approved" | "rejected",
      };
    }).filter(r => r.crdts && r.date && r.deductionAmount > 0 && !Number.isNaN(r.hours));
    if (rej.count) return { tab: TAB_NAMES.deductions, status: "error", error: `${rej.count} row(s) rejected — nothing uploaded. ${rej.summary()}` };
    if (rows.length === 0) return { tab: TAB_NAMES.deductions, status: "error", error: "No valid rows. Ensure CRDTS, Date, and Deduction columns are present." };
    const res = await uploadDeductionsMutation.mutateAsync({ rows });
    return { tab: TAB_NAMES.deductions, status: "done", count: res.count, cycleKey: res.cycleKey };
  }

  async function processOTSheet(ws: XLSX.WorkSheet): Promise<TabResult> {
    const { raw, fmt } = readRows(ws);
    const rej = new RowRejects();
    const rows = raw.map((r, i) => {
      const crdts = parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? "");
      const date = parseDate(r["Date"] ?? r["date"] ?? "");
      const otRaw = r["OT Type"] ?? r["ot_type"] ?? r["Type"] ?? r["OTType"] ?? "";
      const otType = normalizeOtType(otRaw);
      const h = hoursOf(r, fmt[i], ["Hours", "hours"]);
      if (crdts && date) {
        if (!otType) rej.add(i + 2, crdts, `OT type "${otRaw}" must be 1.5x, 2x or 3x`);
        if (h == null || h <= 0 || h > 16) rej.add(i + 2, crdts, `unreadable or out-of-range OT hours "${r["Hours"] ?? r["hours"]}"`);
      }
      return {
        crdts,
        agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? ""),
        alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
        date,
        otType: otType ?? "",
        hours: h ?? NaN,
        egpAmount: parseNumber(r["EGP Amount"] ?? r["egp_amount"] ?? r["Amount"] ?? r["EGP"] ?? 0),
      };
    }).filter(r => r.crdts && r.date && r.otType && !Number.isNaN(r.hours));
    if (rej.count) return { tab: TAB_NAMES.ot, status: "error", error: `${rej.count} row(s) rejected — nothing uploaded. ${rej.summary()}` };
    if (rows.length === 0) return { tab: TAB_NAMES.ot, status: "error", error: "No valid rows. Check CRDTS and Date columns." };
    const res = await uploadOTMutation.mutateAsync({ rows });
    return { tab: TAB_NAMES.ot, status: "done", count: res.count, cycleKey: res.cycleKey };
  }

  async function processCoachingSheet(ws: XLSX.WorkSheet): Promise<TabResult> {
    const { raw, fmt } = readRows(ws);
    const rej = new RowRejects();
    const cycleKey = cycleInfo?.cycleKey ?? currentCycleMonth(); // fallback = current PAY CYCLE, not the UTC calendar month
    const sessions = raw.map((r, i) => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? r["agent_code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      sessionDate: parseDate(r["Date"] ?? r["date"] ?? r["Session Date"] ?? ""),
      coachingHours: (() => { const h = hoursOf(r, fmt[i], ["Coaching Hours", "coaching_hours", "Hours"]); if (h == null) { rej.add(i + 2, parseString(r["CRDTS"] ?? r["crdts"]), `unreadable coaching hours`); return NaN; } return h; })(),
      bonusAmount: parseNumber(r["Bonus Amount"] ?? r["bonus_amount"] ?? r["Bonus"] ?? r["Bonus (EGP)"] ?? 0),
      sessionType: parseString(r["Session Type"] ?? r["session_type"] ?? r["Type"] ?? ""),
      notes: parseString(r["Notes"] ?? r["notes"] ?? ""),
    })).filter(s => s.crdts && s.sessionDate && !Number.isNaN(s.coachingHours));
    if (rej.count) return { tab: TAB_NAMES.coaching, status: "error", error: `${rej.count} row(s) rejected — nothing uploaded. ${rej.summary()}` };
    if (sessions.length === 0) return { tab: TAB_NAMES.coaching, status: "error", error: "No valid rows. Ensure CRDTS and Date columns are present." };
    const result = await uploadCoachingMutation.mutateAsync({ cycleKey, sessions });
    const r = result as { inserted: number; replaced?: number; skippedApproved?: number };
    return { tab: TAB_NAMES.coaching, status: "done", count: r.inserted + (r.replaced ?? 0), cycleKey };
  }

  // ── Main upload handler ──────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setFileName(file.name);
    setUploading(true);
    setResults([]);

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetNames = wb.SheetNames;

      const tabResults: TabResult[] = [];

      for (const [key, tabName] of Object.entries(TAB_NAMES)) {
        const sheetName = sheetNames.find(n => n.trim().toLowerCase() === tabName.toLowerCase());
        if (!sheetName) {
          tabResults.push({ tab: tabName, status: "skipped" });
          continue;
        }
        const ws = wb.Sheets[sheetName];
        try {
          let result: TabResult;
          if (key === "stats") result = await processStatsSheet(ws);
          else if (key === "deductions") result = await processDeductionsSheet(ws);
          else if (key === "ot") result = await processOTSheet(ws);
          else result = await processCoachingSheet(ws);
          tabResults.push(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          tabResults.push({ tab: tabName, status: "error", error: msg });
        }
      }

      setResults(tabResults);

      const doneCount = tabResults.filter(r => r.status === "done").length;
      const errorCount = tabResults.filter(r => r.status === "error").length;
      if (doneCount > 0 && errorCount === 0) {
        toast.success(`Upload complete — ${doneCount} tab${doneCount > 1 ? "s" : ""} processed successfully`);
      } else if (doneCount > 0) {
        toast.warning(`${doneCount} tab${doneCount > 1 ? "s" : ""} uploaded, ${errorCount} had errors`);
      } else if (errorCount > 0) {
        toast.error("All processed tabs had errors");
      } else {
        toast.warning("No matching tab names found in the file");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read file";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Cycle Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a single Excel file with multiple tabs to update agent cycle data in real time.
            </p>
          </div>
          {cycleInfo && (
            <Badge variant="outline" className="text-xs">
              Current cycle: {cycleInfo.cycleKey} · {cycleInfo.dateRange.start} → {cycleInfo.dateRange.end}
            </Badge>
          )}
        </div>

        {/* Info banner */}
        <div className="rounded-xl p-4 flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-semibold">How uploads work</p>
            <p>Upload a single <strong>.xlsx</strong> file with up to 4 named tabs: <strong>Stats Upload</strong>, <strong>Deductions Upload</strong>, <strong>OT Upload</strong>, <strong>Coaching Upload</strong>. Only tabs present in the file are processed — tabs not found are skipped.</p>
            <p>Each upload is matched by <strong>CRDTS</strong> column. Rows are upserted (date + CRDTS = unique key), so re-uploading the same file is safe. Cycle resets automatically on the 26th of each month.</p>
          </div>
        </div>

        {/* Single Upload Card */}
        <Card className="border-2 border-dashed hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Upload Cycle Data File</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  One Excel file with tabs: <strong>Stats Upload</strong> · <strong>Deductions Upload</strong> · <strong>OT Upload</strong> · <strong>Coaching Upload</strong>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2 cursor-pointer h-12 text-sm"
                asChild
                disabled={uploading}
              >
                <span>
                  {uploading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  {uploading ? "Processing tabs…" : fileName ? `Re-upload: ${fileName}` : "Choose Excel File (.xlsx)"}
                </span>
              </Button>
            </label>

            {/* Tab results */}
            {results.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {Object.values(TAB_NAMES).map(tabName => {
                  const result = results.find(r => r.tab === tabName);
                  const status = result?.status ?? "skipped";
                  return (
                    <div
                      key={tabName}
                      className={`rounded-lg border p-3 space-y-1.5 ${
                        status === "done" ? "border-emerald-200 bg-emerald-50/50" :
                        status === "error" ? "border-red-200 bg-red-50/50" :
                        "border-border bg-muted/30 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                          style={{ background: `${TAB_COLORS[tabName]}20`, color: TAB_COLORS[tabName] }}
                        >
                          {TAB_ICONS[tabName]}
                        </div>
                        <span className="text-xs font-medium truncate">{tabName}</span>
                      </div>
                      {status === "done" && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{result?.count} rows · {result?.cycleKey}</span>
                        </div>
                      )}
                      {status === "error" && (
                        <div className="flex items-start gap-1.5 text-xs text-red-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="break-words">{result?.error}</span>
                        </div>
                      )}
                      {status === "skipped" && (
                        <p className="text-xs text-muted-foreground">Tab not found in file</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column name reference */}
        <div className="rounded-xl p-4 bg-muted/40 border text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Expected columns per tab</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: TAB_NAMES.stats, hint: "Required: CRDTS, Date | Optional: Agent Code, Alias, Login Hours, Total Calls, Revenue, Cost, Profit, Rev/Hr" },
              { name: TAB_NAMES.deductions, hint: "Required: CRDTS, Date, Deduction Amount | Optional: Agent Code, Alias, Violation Type, Hours, Status (approved/rejected)" },
              { name: TAB_NAMES.ot, hint: "Required: CRDTS, Date | Optional: Agent Code, Alias, OT Type (1.5x/2x/3x), Hours, EGP Amount" },
              { name: TAB_NAMES.coaching, hint: "Required: CRDTS, Date | Optional: Agent Code, Alias, Coaching Hours, Bonus Amount, Session Type, Notes" },
            ].map(({ name, hint }) => (
              <div key={name} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: TAB_COLORS[name] }} />
                  <span className="font-medium text-foreground">{name}</span>
                </div>
                <p className="font-mono pl-3.5">{hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Delete / Revert section */}
        <DeleteStatsSection cycleKey={cycleInfo?.cycleKey} />
      </div>
    </DashboardLayout>
  );
}
