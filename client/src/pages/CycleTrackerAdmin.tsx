import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, BarChart2, XCircle, Zap, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
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
  // Excel serial date
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // Try to parse common date formats
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

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function CycleTrackerAdmin() {
  const { data: cycleInfo } = trpc.cycleTracker.getCurrentCycle.useQuery();
  const uploadStatsMutation = trpc.cycleTracker.uploadStats.useMutation();
  const uploadDeductionsMutation = trpc.cycleTracker.uploadDeductions.useMutation();
  const uploadOTMutation = trpc.cycleTracker.uploadOT.useMutation();

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
    })).filter(r => r.crdts && r.date);
    if (rows.length === 0) throw new Error("No valid rows found. Check CRDTS and Date columns.");
    return uploadStatsMutation.mutateAsync({ rows });
  }

  async function handleDeductionsUpload(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const rows = raw.map(r => ({
      crdts: parseString(r["CRDTS"] ?? r["crdts"] ?? r["Agent Code"] ?? ""),
      agentCode: parseString(r["Agent Code"] ?? r["agent_code"] ?? ""),
      alias: parseString(r["Alias"] ?? r["alias"] ?? ""),
      date: parseDate(r["Date"] ?? r["date"] ?? ""),
      violationType: parseString(r["Violation Type"] ?? r["violation_type"] ?? r["ViolationType"] ?? r["Type"] ?? ""),
      hours: parseNumber(r["Hours"] ?? r["hours"] ?? 0),
      deductionAmount: parseNumber(r["Deduction Amount"] ?? r["deduction_amount"] ?? r["Amount"] ?? r["Deduction"] ?? 0),
      status: (parseString(r["Status"] ?? r["status"] ?? "approved").toLowerCase() === "rejected" ? "rejected" : "approved") as "approved" | "rejected",
    })).filter(r => r.crdts && r.date);
    if (rows.length === 0) throw new Error("No valid rows found. Check CRDTS and Date columns.");
    return uploadDeductionsMutation.mutateAsync({ rows });
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UploadSection
            title="Stats Upload"
            description="Upload every 2 hours during shift. Updates Today and This Cycle sections."
            icon={<BarChart2 className="w-4 h-4" />}
            color="oklch(0.55 0.18 250)"
            columnHint="Required: CRDTS, Date | Optional: Agent Code, Alias, Login Hours, Total Calls, Revenue, Cost, Profit"
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
        </div>

        {/* Template download hint */}
        <div className="rounded-xl p-4 bg-muted/40 border text-xs text-muted-foreground">
          <p className="font-medium mb-1">Column name flexibility</p>
          <p>The parser accepts common column name variations (e.g. "Login Hours", "login_hours", "LoginHours"). The only strict requirement is a <strong>CRDTS</strong> column (or "Agent Code") and a <strong>Date</strong> column. Extra columns are ignored.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
