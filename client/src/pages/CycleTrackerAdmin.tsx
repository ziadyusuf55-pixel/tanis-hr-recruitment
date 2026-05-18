import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, BarChart2, XCircle, Zap, CheckCircle, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import * as XLSX from "xlsx";

// ─── Excel parser helpers ──────────────────────────────────────────────────────
function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
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
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return s;
}

// ─── Upload section component ──────────────────────────────────────────────────
type UploadStatus = "idle" | "parsing" | "uploading" | "done" | "error";

interface UploadSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  columnHint: string;
  onUpload: (file: File) => Promise<{ count: number; cycleKey: string }>;
}

function UploadSection({ title, description, icon, color, columnHint, onUpload }: UploadSectionProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<{ count: number; cycleKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setStatus("parsing");
    setError(null);
    setResult(null);
    try {
      const res = await onUpload(file);
      setResult(res);
      setStatus("done");
      toast.success(`${title}: ${res.count} rows uploaded for cycle ${res.cycleKey}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      setStatus("error");
      toast.error(msg);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1.5">{columnHint}</p>
        <label className="block">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
            disabled={status === "parsing" || status === "uploading"}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 cursor-pointer"
            asChild
            disabled={status === "parsing" || status === "uploading"}
          >
            <span>
              {status === "parsing" || status === "uploading" ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {status === "parsing" ? "Parsing…" : status === "uploading" ? "Uploading…" : "Choose Excel / CSV"}
            </span>
          </Button>
        </label>

        {status === "done" && result && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            {result.count} rows uploaded · Cycle {result.cycleKey}
          </div>
        )}
        {status === "error" && error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
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

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function CycleTrackerAdmin() {
  const { data: cycleInfo } = trpc.cycleTracker.getCurrentCycle.useQuery();
  const uploadStatsMutation = trpc.cycleTracker.uploadStats.useMutation();
  const uploadDeductionsMutation = trpc.cycleTracker.uploadDeductions.useMutation();
  const uploadOTMutation = trpc.cycleTracker.uploadOT.useMutation();
  const uploadCoachingMutation = trpc.coaching.upload.useMutation();

  async function handleStatsUpload(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const rows = raw.map(r => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? r["agent_code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? r["Code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      date: parseDate(r["Date"] ?? r["date"] ?? ""),
      loginHours: parseNumber(r["Login Hours"] ?? r["login_hours"] ?? r["LoginHours"] ?? 0),
      totalCalls: parseNumber(r["Total Calls"] ?? r["total_calls"] ?? r["TotalCalls"] ?? 0),
      revenue: parseNumber(r["Revenue"] ?? r["revenue"] ?? 0),
      cost: parseNumber(r["Cost"] ?? r["cost"] ?? 0),
      profit: parseNumber(r["Profit"] ?? r["profit"] ?? 0),
      revPerHr: parseNumber(r["Rev/Hr"] ?? r["rev_per_hr"] ?? r["RevPerHr"] ?? r["Rev Per Hr"] ?? 0),
    })).filter(r => r.crdts && r.date);
    if (rows.length === 0) throw new Error("No valid rows found. Check CRDTS and Date columns.");
    return uploadStatsMutation.mutateAsync({ rows });
  }

  async function handleDeductionsUpload(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Use raw row arrays so we can normalize headers that contain newlines (e.g. from Quality Log)
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    if (rawRows.length < 2) throw new Error("File appears empty.");
    // Find the header row: first row that contains a cell with "CRDTS"
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      if ((rawRows[i] as unknown[]).some(c => typeof c === "string" && c.replace(/\n/g, " ").toUpperCase().includes("CRDTS"))) {
        headerRowIdx = i;
        break;
      }
    }
    // Normalize headers: strip newlines and trim
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
    const rows = (rawRows.slice(headerRowIdx + 1) as unknown[][]).map(row => ({
      crdts: parseString(getVal(row, ["crdts", "agent code"])),
      agentCode: parseString(getVal(row, ["agent code", "agent_code"])),
      alias: parseString(getVal(row, ["alias"])),
      date: parseDate(getVal(row, ["date"])),
      violationType: parseString(getVal(row, ["violation type", "violationtype", "violation", "type"])),
      hours: parseNumber(getVal(row, ["override hours", "escalation hours", "hours"])),
      deductionAmount: parseNumber(getVal(row, ["deduction", "amount"])),
      status: (parseString(getVal(row, ["status"]) || "approved").toLowerCase() === "rejected" ? "rejected" : "approved") as "approved" | "rejected",
    })).filter(r => r.crdts && r.date && r.deductionAmount > 0);
    if (rows.length === 0) throw new Error("No valid rows found. Ensure CRDTS, Date, and Deduction (EGP) columns are present and have values.");
    return uploadDeductionsMutation.mutateAsync({ rows });
  }

  async function handleCoachingUpload(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const cycleKey = cycleInfo?.cycleKey ?? new Date().toISOString().slice(0, 7);
    const sessions = raw.map(r => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? r["agent_code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      sessionDate: parseDate(r["Date"] ?? r["date"] ?? r["Session Date"] ?? ""),
      coachingHours: parseNumber(r["Coaching Hours"] ?? r["coaching_hours"] ?? r["Hours"] ?? 0),
      bonusAmount: parseNumber(r["Bonus Amount"] ?? r["bonus_amount"] ?? r["Bonus"] ?? r["Bonus (EGP)"] ?? 0),
      sessionType: parseString(r["Session Type"] ?? r["session_type"] ?? r["Type"] ?? ""),
      notes: parseString(r["Notes"] ?? r["notes"] ?? ""),
    })).filter(s => s.crdts && s.sessionDate);
    if (sessions.length === 0) throw new Error("No valid rows found. Ensure CRDTS and Date columns are present.");
    const result = await uploadCoachingMutation.mutateAsync({ cycleKey, sessions });
    return { count: result.inserted, cycleKey };
  }

  async function handleOTUpload(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const rows = raw.map(r => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      date: parseDate(r["Date"] ?? r["date"] ?? ""),
      otType: parseString(r["OT Type"] ?? r["ot_type"] ?? r["Type"] ?? r["OTType"] ?? "1.5x"),
      hours: parseNumber(r["Hours"] ?? r["hours"] ?? 0),
      egpAmount: parseNumber(r["EGP Amount"] ?? r["egp_amount"] ?? r["Amount"] ?? r["EGP"] ?? 0),
    })).filter(r => r.crdts && r.date);
    if (rows.length === 0) throw new Error("No valid rows found. Check CRDTS and Date columns.");
    return uploadOTMutation.mutateAsync({ rows });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Cycle Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload Excel files to update agent cycle data in real time.
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
            <p>Each upload is matched by <strong>CRDTS</strong> column. Rows are upserted (date + CRDTS = unique key), so re-uploading the same file is safe. Only <strong>Approved</strong> deductions are shown to agents — set Status = "rejected" to hide an entry.</p>
            <p>Cycle resets automatically on the 26th of each month. Previous cycle data moves to payslip history.</p>
          </div>
        </div>

        {/* Upload cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UploadSection
            title="Stats Upload"
            description="Upload every 2 hours during shift. Updates Today and This Cycle sections."
            icon={<BarChart2 className="w-4 h-4" />}
            color="oklch(0.55 0.18 250)"
            columnHint="Required: CRDTS, Date | Optional: Agent Code, Alias, Login Hours, Total Calls, Revenue, Cost, Profit, Rev/Hr"
            onUpload={handleStatsUpload}
          />
          <UploadSection
            title="Deductions Upload"
            description="Upload when violations are approved or rejected. Agents see only Approved entries."
            icon={<XCircle className="w-4 h-4" />}
            color="oklch(0.55 0.22 25)"
            columnHint="Required: CRDTS, Date, Violation Type | Optional: Agent Code, Alias, Hours, Deduction Amount, Status (approved/rejected)"
            onUpload={handleDeductionsUpload}
          />
          <UploadSection
            title="OT Upload"
            description="Upload when new OT events are logged. Shows itemized OT breakdown to agents."
            icon={<Zap className="w-4 h-4" />}
            color="oklch(0.55 0.18 145)"
            columnHint="Required: CRDTS, Date, OT Type (1.5x/2x/3x) | Optional: Agent Code, Alias, Hours, EGP Amount"
            onUpload={handleOTUpload}
          />
          <UploadSection
            title="Coaching Upload"
            description="Upload coaching sessions per agent per cycle. Approved sessions add to payslip coaching bonus."
            icon={<CheckCircle className="w-4 h-4" />}
            color="oklch(0.55 0.18 300)"
            columnHint="Required: CRDTS, Date | Optional: Agent Code, Alias, Coaching Hours, Bonus Amount (EGP), Session Type, Notes"
            onUpload={handleCoachingUpload}
          />
        </div>

        {/* Column name flexibility hint */}
        <div className="rounded-xl p-4 bg-muted/40 border text-xs text-muted-foreground">
          <p className="font-medium mb-1">Column name flexibility</p>
          <p>The parser accepts common column name variations (e.g. "Login Hours", "login_hours", "LoginHours"). The only strict requirement is a <strong>CRDTS</strong> column (or "Agent Code") and a <strong>Date</strong> column. Extra columns are ignored.</p>
        </div>

        {/* Delete / Revert section */}
        <DeleteStatsSection cycleKey={cycleInfo?.cycleKey} />
      </div>
    </DashboardLayout>
  );
}
