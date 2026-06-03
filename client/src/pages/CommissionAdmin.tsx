import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, CheckCircle2, Clock, AlertTriangle, Info, DollarSign, Pencil, Check, X, Trash2, Trophy, Copy, MessageSquare, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ParsedCommRow = {
  crdts: string;
  alias?: string;
  commissionEgp: number;
  performanceMonth?: string;
};

type ParsedLeaderboardRow = {
  campaignName: string;
  crdts: string;
  alias?: string;
  rank: number;
  loginHours?: number;
  revenue?: number;
  profit?: number;
  commissionEgp?: number;
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
  const [activeTab, setActiveTab] = useState<"records" | "leaderboard" | "upload">("records");

  // Leaderboard tab state
  const [lbCycle, setLbCycle] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lbCampaign, setLbCampaign] = useState<string>("all");
  const { data: lbData = [], isLoading: lbLoading } = trpc.commission.getFullLeaderboard.useQuery(
    { cycleKey: lbCycle },
    { enabled: activeTab === "leaderboard" }
  );
  type LbRow = { rank: number; crdts: string; alias: string; campaignName: string; profit: number; revenue: number; commissionEgp: number };
  const lbRows = lbData as LbRow[];
  const lbCampaigns = ["all", ...Array.from(new Set(lbRows.map(r => r.campaignName))).sort()];
  const lbFiltered = lbCampaign === "all" ? lbRows : lbRows.filter(r => r.campaignName === lbCampaign);

  // Slack message generator state
  const [slackDialog, setSlackDialog] = useState(false);
  const [slackCopied, setSlackCopied] = useState(false);
  const [slackCycle, setSlackCycle] = useState<string>("");
  const [slackPerfMonth, setSlackPerfMonth] = useState<string>("");
  const [slackLeaderboard, setSlackLeaderboard] = useState<LbRow[]>([]);

  const generateSlackMessage = useCallback((cycle: string, perfMonth: string, rows: LbRow[]) => {
    const perfLabel = perfMonth || formatMonthLabel(cycle);
    const cycleLabel = formatMonthLabel(cycle);
    // First day of perf month, last day of perf month
    const [py, pm] = (perfMonth ? (() => {
      // perfMonth is a label like "March 2026" — derive YYYY-MM from cycle - 2 months
      const d = new Date(cycle + "-01");
      d.setMonth(d.getMonth() - 2);
      return [`${d.getFullYear()}`, String(d.getMonth() + 1).padStart(2, "0")];
    })() : cycle.split("-"));
    const firstDay = `1 ${new Date(parseInt(py), parseInt(pm) - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}`;
    const lastDay = (() => {
      const last = new Date(parseInt(py), parseInt(pm), 0);
      return `${last.getDate()} ${last.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
    })();
    const top3 = rows.filter(r => r.rank <= 3).sort((a, b) => a.rank - b.rank);
    const medals = ["🥇", "🥈", "🥉"];
    const top3Lines = top3.map((r, i) =>
      `${medals[i]} *${r.alias || r.crdts}* — $${r.profit.toLocaleString()} profit${r.commissionEgp > 0 ? ` · EGP ${r.commissionEgp.toLocaleString()} commission` : ""}`
    ).join("\n");
    const totalAgents = rows.length;
    return `🎉 *Commission Released — ${perfLabel}*

Hey team! Your commission for *${firstDay} → ${lastDay}* has been calculated and added to your payslip for the *${cycleLabel}* pay cycle.

📊 *Top Performers this cycle:*
${top3Lines || "_(No leaderboard data yet)_"}

💪 Great work everyone — ${totalAgents} agent${totalAgents !== 1 ? "s" : ""} on the board this cycle. Keep pushing!

Check your commission details on the *Tanis Hub Agent Portal* 👉 hub.tanis-eg.com`;
  }, []);

  const slackMessage = useMemo(
    () => slackCycle ? generateSlackMessage(slackCycle, slackPerfMonth, slackLeaderboard) : "",
    [slackCycle, slackPerfMonth, slackLeaderboard, generateSlackMessage]
  );

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
  const [performanceMonthKey, setPerformanceMonthKey] = useState<string>(""); // YYYY-MM
  const [performanceMonth, setPerformanceMonth] = useState(""); // free text label
  // Auto-calculate Pay Cycle = performanceMonthKey + 2 months
  const payCycle = useMemo(() => {
    if (!performanceMonthKey) return "";
    const [y, m] = performanceMonthKey.split("-").map(Number);
    const d = new Date(y, m - 1 + 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [performanceMonthKey]);

  // Cycle date range: 26th of prev month → 25th of performance month
  const cycleDateRange = useMemo(() => {
    if (!performanceMonthKey) return null;
    const [y, m] = performanceMonthKey.split("-").map(Number);
    const startDate = new Date(y, m - 2, 26); // 26th of month before performance month
    const endDate = new Date(y, m - 1, 25);   // 25th of performance month
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [performanceMonthKey]);
  const [parsedRows, setParsedRows] = useState<ParsedCommRow[]>([]);
  const [parsedLeaderboard, setParsedLeaderboard] = useState<ParsedLeaderboardRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<Warning[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit commission state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // Edit Cycle dialog
  const [editCycleId, setEditCycleId] = useState<number | null>(null);
  const [editCycleNewMonth, setEditCycleNewMonth] = useState(""); // YYYY-MM (performance month)
  const editCycleNewPayCycle = useMemo(() => {
    if (!editCycleNewMonth) return "";
    const [y, m] = editCycleNewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [editCycleNewMonth]);
  const editCycleDateRange = useMemo(() => {
    if (!editCycleNewMonth) return null;
    const [y, m] = editCycleNewMonth.split("-").map(Number);
    const startDate = new Date(y, m - 2, 26);
    const endDate = new Date(y, m - 1, 25);
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [editCycleNewMonth]);
  const changeCycleMutation = trpc.commission.changeCycle.useMutation({
    onSuccess: () => {
      utils.commission.getForMonth.invalidate();
      toast.success("Cycle updated and payroll synced");
      setEditCycleId(null);
      setEditCycleNewMonth("");
    },
    onError: (e) => toast.error(e.message),
  });
  const [confirmClearCycle, setConfirmClearCycle] = useState(false);

  const deleteRecordMutation = trpc.commission.deleteCommissionRecord.useMutation({
    onSuccess: () => {
      toast.success("Commission record deleted");
      setConfirmDeleteId(null);
      utils.commission.getForMonth.invalidate({ month: viewMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  const clearCycleMutation = trpc.commission.clearCommissionCycle.useMutation({
    onSuccess: () => {
      toast.success(`All commission records for ${formatMonthLabel(viewMonth)} cleared`);
      setConfirmClearCycle(false);
      utils.commission.getForMonth.invalidate({ month: viewMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCommissionMutation = trpc.commission.updateCommission.useMutation({
    onSuccess: () => {
      toast.success("Commission updated and synced to payroll");
      setEditingId(null);
      utils.commission.getForMonth.invalidate({ month: viewMonth });
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadLeaderboardMutation = trpc.commission.uploadLeaderboard.useMutation({
    onError: (e) => toast.error(`Leaderboard upload failed: ${e.message}`),
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
        setParsedLeaderboard([]);
        setPerformanceMonth("");
        setPerformanceMonthKey("");
        // Open Slack message generator
        setSlackCycle(payCycle);
        setSlackPerfMonth(performanceMonth);
        setSlackLeaderboard(parsedLeaderboard as LbRow[]);
        setSlackDialog(true);
      }
      setViewMonth(payCycle);
      setActiveTab("records");
      utils.commission.getForMonth.invalidate({ month: payCycle });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Excel parsing (dual-purpose: Campaign tabs → leaderboard, Manus Upload → payments) ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsedRows([]);
    setParsedLeaderboard([]);
    setUploadWarnings([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", raw: false });

        // ── Shared helpers ──
        const cleanNum = (v: unknown): number => {
          if (v == null || v === "") return 0;
          const s = String(v).replace(/^'/, "").replace(/,/g, "").trim();
          const n = Number(s); return isNaN(n) ? 0 : n;
        };
        const cleanStr = (v: unknown): string =>
          String(v ?? "").replace(/^'/, "").trim();
        const isValidCrdts = (s: string) =>
          s !== "" && /^\d+$/.test(s) && !(/\s/.test(s));

        // Convert emoji medals to rank numbers (older files may use 🥇🥈🥉 instead of 1,2,3)
        const parseRank = (v: unknown): number => {
          if (v == null || v === "") return 0;
          const s = String(v).trim();
          if (s === "🥇") return 1;
          if (s === "🥈") return 2;
          if (s === "🥉") return 3;
          // Strip any leading emoji/medal chars then parse number
          const stripped = s.replace(/[🥇🥈🥉]/g, "").trim();
          const n = parseInt(stripped, 10);
          return isNaN(n) ? 0 : n;
        };

        // Normalise a column header key for fuzzy matching
        // Strips whitespace, parentheses, $, newlines, underscores, hyphens
        const norm = (k: string) =>
          k.toLowerCase()
            .replace(/\r?\n/g, " ")
            .replace(/[\s()$%_\-,]/g, "");

        // Find a value in a row by matching normalised key against a list of candidate names
        const getCol = (r: Record<string, unknown>, ...candidates: string[]): unknown => {
          const keys = Object.keys(r);
          for (const candidate of candidates) {
            const nc = norm(candidate);
            const found = keys.find(k => norm(k) === nc);
            if (found !== undefined) return r[found];
          }
          // Fallback: partial match (key contains candidate or vice versa)
          for (const candidate of candidates) {
            const nc = norm(candidate);
            const found = keys.find(k => norm(k).includes(nc) || nc.includes(norm(k)));
            if (found !== undefined) return r[found];
          }
          return null;
        };

        // ── 1. Parse Campaign tabs for leaderboard ──
        // Sheet names: 'Campaign 100 — Main', 'Campaign 133', 'Campaign 198'
        // Row 1-2: title rows (skipped by range:2)
        // Row 3: column headers  → range:2 makes this the header row
        // Row 4: sub-headers     → first item in raw[], skipped with slice(1)
        // Row 5+: data
        const campaignSheets = wb.SheetNames.filter(name =>
          name.toLowerCase() !== "manus upload" &&
          !name.toLowerCase().replace(/\s/g, "").startsWith("manusupload")
        );

        const leaderboardRows: ParsedLeaderboardRow[] = [];
        for (const sheetName of campaignSheets) {
          const ws = wb.Sheets[sheetName];
          // range:2 → 0-based row index 2 = Excel row 3 → becomes the header row
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: null,
            rawNumbers: false,
            range: 2,
          });
          // raw[0] is the sub-header row (Excel row 4) — skip it
          const dataRows = raw.slice(1);

          for (const r of dataRows) {
            const crdts = cleanStr(getCol(r, "CRDTS", "crdts"));
            if (!isValidCrdts(crdts)) continue;

            const rank = parseRank(getCol(r, "Rank", "rank"));
            if (rank <= 0) continue;

            // Profit: try multiple column name variants used in the file
            // File headers include: "Profit($)", "Profit ()", "Profit (\n),Profit()"
            const profitRaw = getCol(r,
              "Profit ($)", "Profit($)", "Profit ()", "Profit",
              "profit", "PROFIT"
            );
            // Revenue: "Revenue ()", "Revenue"
            const revenueRaw = getCol(r,
              "Revenue ()", "Revenue()", "Revenue",
              "revenue", "REVENUE"
            );
            // Commission: "Commission (EGP)", "Commission(EGP)", "Commission"
            const commRaw = getCol(r,
              "Commission (EGP)", "Commission(EGP)", "Commission",
              "commission", "COMMISSION"
            );
            // Performance Month
            const perfMonthRaw = getCol(r,
              "Performance Month", "PerformanceMonth", "Perf Month"
            );
            // Alias
            const aliasRaw = getCol(r, "Alias", "alias", "Name", "name");

            leaderboardRows.push({
              campaignName: sheetName,
              crdts,
              alias: cleanStr(aliasRaw) || undefined,
              rank,
              // Do NOT read hours from file — hours come from Vicidial cycleStats
              loginHours: undefined,
              revenue: cleanNum(revenueRaw),
              profit: cleanNum(profitRaw),
              commissionEgp: cleanNum(commRaw),
              performanceMonth: cleanStr(perfMonthRaw) || performanceMonth || undefined,
            });
          }
        }

        // ── 2. Parse Manus Upload tab for commission payments ──
        // Row 1: headers (CRDTS, Commission (EGP), Performance Month)
        // Row 2+: data
        // Skip rows where CRDTS is non-numeric or Commission is 0/null
        const manusUploadSheet = wb.SheetNames.find(n =>
          n.toLowerCase().replace(/\s/g, "") === "manusupload"
        );

        let paymentRows: ParsedCommRow[] = [];
        if (manusUploadSheet) {
          const ws = wb.Sheets[manusUploadSheet];
          // Default range: row 1 = headers, row 2+ = data
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: null,
            rawNumbers: false,
          });
          paymentRows = raw.map((r) => ({
            crdts: cleanStr(getCol(r, "CRDTS", "crdts")),
            alias: cleanStr(getCol(r, "Alias", "alias", "Name")) || undefined,
            commissionEgp: cleanNum(getCol(r, "Commission (EGP)", "Commission(EGP)", "Commission")),
            performanceMonth: cleanStr(getCol(r, "Performance Month", "PerformanceMonth")) || performanceMonth || undefined,
          })).filter(r => isValidCrdts(r.crdts) && r.commissionEgp > 0);
        }

        if (paymentRows.length === 0 && leaderboardRows.length === 0) {
          setParseError("No valid data found. Make sure the file has Campaign tabs (for leaderboard) and/or a 'Manus Upload' tab (for payments).");
          return;
        }

        setParsedRows(paymentRows);
        setParsedLeaderboard(leaderboardRows);
      } catch (err) {
        setParseError(`Failed to parse file: ${String(err)}`);
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
        {(["records", "leaderboard", "upload"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "records" ? "Commission Records" : tab === "leaderboard" ? "Leaderboard" : "Upload Guide"}
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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportRecords} disabled={records.length === 0}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                {records.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmClearCycle(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Clear Cycle
                  </Button>
                )}
              </div>
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
                        <th className="px-4 py-3" />
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
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => { setEditCycleId(r.id); setEditCycleNewMonth(""); }}
                                className="text-muted-foreground hover:text-blue-600 transition-colors"
                                title="Change pay cycle"
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(r.id)}
                                className="text-muted-foreground hover:text-red-600 transition-colors"
                                title="Delete this commission record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm">Total Commission:</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmtEGP(totalCommission)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Leaderboard Tab ── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Pay Cycle:</label>
              <input
                type="month"
                value={lbCycle}
                onChange={e => { setLbCycle(e.target.value); setLbCampaign("all"); }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={() => {
                setSlackCycle(lbCycle);
                setSlackPerfMonth("");
                setSlackLeaderboard(lbRows);
                setSlackDialog(true);
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Generate Slack Message
            </Button>
          </div>

          {/* Campaign filter tabs */}
          {lbCampaigns.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {lbCampaigns.map(c => (
                <button key={c} onClick={() => setLbCampaign(c)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors border ${
                    lbCampaign === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                  }`}>
                  {c === "all" ? "All Campaigns" : c}
                </button>
              ))}
            </div>
          )}

          {/* Leaderboard table */}
          {lbLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : lbFiltered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No leaderboard data for this pay cycle.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Rank</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Alias</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">CRDTS</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Campaign</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Profit ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lbFiltered.map((row, idx) => {
                        const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
                        const fmtMoney = (v: number) => v < 0 ? `-$${Math.abs(v).toLocaleString()}` : `$${v.toLocaleString()}`;
                        const commAmt = Number(row.commissionEgp ?? 0);
                        return (
                          <tr key={`${row.crdts}-${row.campaignName}`}
                            className={`border-b last:border-0 ${
                              idx % 2 === 0 ? "" : "bg-muted/20"
                            } ${row.rank <= 3 ? "bg-amber-50/60" : ""}`}>
                            <td className="px-4 py-3 font-bold" style={{ color: row.rank <= 3 ? "oklch(0.65 0.18 55)" : undefined }}>
                              {medal ? <span>{medal} #{row.rank}</span> : `#${row.rank}`}
                            </td>
                            <td className="px-4 py-3 font-medium">{row.alias || "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.crdts}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.campaignName}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${
                              Number(row.profit) < 0 ? "text-red-600" : "text-emerald-600"
                            }`}>{fmtMoney(Number(row.profit))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td colSpan={4} className="px-4 py-3 text-right text-sm text-muted-foreground">{lbFiltered.length} agents</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-600">
                          {(() => { const t = lbFiltered.reduce((s, r) => s + Number(r.profit), 0); return t < 0 ? `-$${Math.abs(t).toLocaleString()}` : `$${t.toLocaleString()}`; })()}
                        </td>
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
            {/* Performance month → auto Pay Cycle */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Performance Month</label>
                <input
                  type="month"
                  value={performanceMonthKey}
                  onChange={e => {
                    setPerformanceMonthKey(e.target.value);
                    // Auto-fill label
                    if (e.target.value) {
                      const [y, mo] = e.target.value.split("-");
                      const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
                      setPerformanceMonth(label);
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                {cycleDateRange && (
                  <p className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                    📅 Work period: {cycleDateRange}
                  </p>
                )}
                {!cycleDateRange && <p className="text-xs text-muted-foreground">The month agents worked to earn this commission</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Pay Cycle (auto-calculated)</label>
                <div className="h-9 rounded-md border border-input bg-muted px-3 py-1 text-sm flex items-center text-muted-foreground">
                  {payCycle ? formatMonthLabel(payCycle) : "Select performance month first"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {payCycle ? `Paid on 1st ${formatMonthLabel(payCycle)} (performance + 2 months)` : "Will be auto-set to performance month + 2 months"}
                </p>
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
            {(parsedRows.length > 0 || parsedLeaderboard.length > 0) && uploadWarnings.length === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    File parsed — pay cycle: <strong>{formatMonthLabel(payCycle)}</strong>
                    {parsedRows.length > 0 && <> · <strong>{parsedRows.length} payment rows</strong></>}
                    {parsedLeaderboard.length > 0 && <> · <strong>{parsedLeaderboard.length} leaderboard rows</strong></>}
                  </span>
                </div>

                {/* Payment rows preview */}
                {parsedRows.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Commission Payments (Manus Upload tab)</p>
                    <div className="overflow-x-auto max-h-48 border rounded-md">
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
                  </div>
                )}

                {/* Leaderboard rows preview */}
                {parsedLeaderboard.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Leaderboard Rankings (Campaign tabs)</p>
                    <div className="overflow-x-auto max-h-48 border rounded-md">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80">
                          <tr className="border-b">
                            <th className="text-left px-3 py-2 font-medium">Campaign</th>
                            <th className="text-center px-3 py-2 font-medium">Rank</th>
                            <th className="text-left px-3 py-2 font-medium">CRDTS</th>
                            <th className="text-left px-3 py-2 font-medium">Alias</th>
                            <th className="text-right px-3 py-2 font-medium">Hours</th>
                            <th className="text-right px-3 py-2 font-medium">Revenue</th>
                            <th className="text-right px-3 py-2 font-medium">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {parsedLeaderboard.map((r, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-3 py-1.5 text-muted-foreground">{r.campaignName}</td>
                              <td className="px-3 py-1.5 text-center font-bold">{r.rank}</td>
                              <td className="px-3 py-1.5 font-mono">{r.crdts}</td>
                              <td className="px-3 py-1.5">{r.alias || "—"}</td>
                              <td className="px-3 py-1.5 text-right">{r.loginHours?.toFixed(1) ?? "—"}</td>
                              <td className="px-3 py-1.5 text-right">{r.revenue != null ? `$${r.revenue.toLocaleString()}` : "—"}</td>
                              <td className="px-3 py-1.5 text-right">{r.profit != null ? `$${r.profit.toLocaleString()}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => {
                    setParsedRows([]); setParsedLeaderboard([]); setPerformanceMonthKey(""); setPerformanceMonth("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}>
                    Clear
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!performanceMonthKey) { toast.error("Select a performance month"); return; }
                      // Upload leaderboard rows first (if any)
                      if (parsedLeaderboard.length > 0) {
                        await uploadLeaderboardMutation.mutateAsync({
                          cycleKey: payCycle,
                          rows: parsedLeaderboard.map(r => ({
                            campaignName: r.campaignName,
                            crdts: r.crdts,
                            alias: r.alias,
                            rank: r.rank,
                            loginHours: r.loginHours,
                            revenue: r.revenue,
                            profit: r.profit,
                            commissionEgp: r.commissionEgp,
                            performanceMonth: r.performanceMonth || performanceMonth || undefined,
                          })),
                        });
                        toast.success(`Leaderboard updated: ${parsedLeaderboard.length} rows across ${Array.from(new Set(parsedLeaderboard.map(r => r.campaignName))).length} campaign(s)`);
                      }
                      // Upload payment rows (if any)
                      if (parsedRows.length > 0) {
                        uploadMutation.mutate({
                          paymentCycle: payCycle,
                          rows: parsedRows.map(r => ({
                            crdts: r.crdts,
                            alias: r.alias,
                            commissionEgp: r.commissionEgp,
                            performanceMonth: r.performanceMonth || performanceMonth,
                          })),
                        });
                      } else {
                        // Only leaderboard, no payment rows — close dialog
                        setUploadDialog(false);
                        setParsedLeaderboard([]);
                        setPerformanceMonth("");
                      }
                    }}
                    disabled={uploadMutation.isPending || uploadLeaderboardMutation.isPending}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {(uploadMutation.isPending || uploadLeaderboardMutation.isPending)
                      ? "Uploading…"
                      : `Upload${parsedRows.length > 0 ? ` ${parsedRows.length} Payments` : ""}${parsedLeaderboard.length > 0 ? ` + ${parsedLeaderboard.length} Leaderboard` : ""}`
                    }
                  </Button>
                </div>
              </div>
            )}

            {parsedRows.length === 0 && parsedLeaderboard.length === 0 && !parseError && uploadWarnings.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground space-y-1">
                <p>Upload the Tanis Commission file (Tanis_Commission_[Month].xlsx)</p>
                <p className="text-xs">Campaign tabs (100/133/198) → leaderboard · "Manus Upload" tab → commission payments</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Single Record ── */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Delete Commission Record
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            This will permanently delete this agent's commission record and clear their commission from the matching payroll record. This cannot be undone.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteRecordMutation.isPending}
              onClick={() => confirmDeleteId !== null && deleteRecordMutation.mutate({ id: confirmDeleteId })}
            >
              {deleteRecordMutation.isPending ? "Deleting…" : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Clear Entire Cycle ── */}
      <Dialog open={confirmClearCycle} onOpenChange={open => { if (!open) setConfirmClearCycle(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Clear Entire Cycle
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
            <p className="font-semibold">This will delete ALL commission records for {formatMonthLabel(viewMonth)}:</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              <li>All {records.length} commission payment records</li>
              <li>All leaderboard rows for this cycle</li>
              <li>Commission amounts cleared from matching payroll records</li>
            </ul>
            <p className="text-xs font-semibold mt-1">This cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmClearCycle(false)}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={clearCycleMutation.isPending}
              onClick={() => clearCycleMutation.mutate({ cycleKey: viewMonth })}
            >
              {clearCycleMutation.isPending ? "Clearing…" : `Clear ${formatMonthLabel(viewMonth)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Cycle Dialog ── */}
      <Dialog open={editCycleId !== null} onOpenChange={open => { if (!open) { setEditCycleId(null); setEditCycleNewMonth(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" /> Change Pay Cycle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Select the correct performance month. The pay cycle will be auto-calculated as performance month + 2 months.</p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">New Performance Month</label>
              <input
                type="month"
                value={editCycleNewMonth}
                onChange={e => setEditCycleNewMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              {editCycleDateRange && (
                <p className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                  📅 Work period: {editCycleDateRange}
                </p>
              )}
            </div>
            {editCycleNewPayCycle && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">New Pay Cycle: </span>
                <strong>{formatMonthLabel(editCycleNewPayCycle)}</strong>
                <span className="text-xs text-muted-foreground ml-1">(paid 1st {formatMonthLabel(editCycleNewPayCycle)})</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditCycleId(null); setEditCycleNewMonth(""); }}>Cancel</Button>
            <Button
              size="sm"
              disabled={!editCycleNewPayCycle || changeCycleMutation.isPending}
              onClick={() => editCycleId !== null && changeCycleMutation.mutate({
                id: editCycleId,
                newPaymentCycle: editCycleNewPayCycle,
                newPerformanceMonth: editCycleNewMonth ? new Date(parseInt(editCycleNewMonth.split("-")[0]), parseInt(editCycleNewMonth.split("-")[1]) - 1).toLocaleString("en-US", { month: "long", year: "numeric" }) : undefined,
              })}
            >
              {changeCycleMutation.isPending ? "Updating…" : "Update Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Slack Message Generator Dialog ── */}
      <Dialog open={slackDialog} onOpenChange={open => { setSlackDialog(open); if (!open) setSlackCopied(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-500" />
              Slack Announcement Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Copy this message and paste it into your Slack channel to announce the commission release.
            </p>
            <div className="relative">
              <textarea
                className="w-full min-h-[280px] rounded-lg border border-input bg-muted/30 px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                value={slackMessage}
                onChange={() => {}} // read-only display; user can edit in Slack
                readOnly
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>This message uses Slack markdown formatting (*bold*, _italic_). Paste directly into Slack for best results.</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSlackDialog(false)}>Close</Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(slackMessage).then(() => {
                  setSlackCopied(true);
                  toast.success("Message copied to clipboard!");
                  setTimeout(() => setSlackCopied(false), 3000);
                }).catch(() => toast.error("Copy failed — please select and copy manually"));
              }}
            >
              {slackCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {slackCopied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
