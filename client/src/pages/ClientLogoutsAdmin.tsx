import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, PhoneOff, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type ParsedRow = {
  crdts: string;
  agentCode?: string;
  alias?: string;
  date: string;        // YYYY-MM-DD
  cycleKey: string;    // YYYY-MM
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Parse a date that may be ISO (YYYY-MM-DD) or day-first (DD/MM/YYYY or DD-MM-YYYY).
// We must NOT use `new Date(str)` on "01/06/2026" — JS reads that as US MM/DD (Jan 6),
// which is what filed June logouts under January.
// The logout sheet's dash format is YYYY-DD-MM (e.g. "2026-01-06" = 1 June 2026),
// so for dashes the MIDDLE number is the DAY. If either part is >12 we can tell
// unambiguously which is which and self-correct.
function parseYMD(dateStr: string): { y: number; m: number; d: number } | null {
  const s = String(dateStr).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);        // YYYY-DD-MM (sheet format)
  if (m) {
    const y = +m[1], a = +m[2], b = +m[3];
    if (b > 12 && a <= 12) return { y, m: a, d: b };      // third can't be a month → it's YYYY-MM-DD
    return { y, m: b, d: a };                              // default: middle = day (YYYY-DD-MM)
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);      // DD/MM/YYYY (day first)
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  return null;
}
function toISO(dateStr: string): string {
  const p = parseYMD(dateStr);
  return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : String(dateStr).trim();
}
function getCycleKey(dateStr: string): string {
  // Cycle runs 26th of prev month → 25th of current month
  // If day <= 25 → cycle = current month; if day >= 26 → cycle = next month
  const p = parseYMD(dateStr);
  if (!p) return String(dateStr).slice(0, 7);
  const { y, m, d } = p; // m is 1-indexed
  if (d >= 26) {
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientLogoutsAdmin() {
  const utils = trpc.useUtils();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logoutsByCycle = [], isLoading: loadingLogouts, refetch } =
    trpc.cycleTracker.getClientLogoutsByCycle.useQuery({ cycleKey: selectedCycle });

  const uploadMutation = trpc.cycleTracker.uploadClientLogouts.useMutation({
    onSuccess: (data) => {
      toast.success(`Uploaded ${data.inserted + data.updated} client logout records (${data.inserted} new, ${data.updated} updated)`);
      setParsedRows([]);
      refetch();
      utils.cycleTracker.getClientLogoutsByCycle.invalidate();
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

        const norm = (k: string) => k.toLowerCase().replace(/[\s()_-]/g, "");
        const rows: ParsedRow[] = raw.map((r) => {
          const get = (key: string) => {
            const found = Object.keys(r).find(k => norm(k) === norm(key));
            return found ? r[found] : null;
          };

          // Handle Excel date serial numbers
          let dateStr = "";
          const rawDate = get("Date") ?? get("date");
          if (rawDate != null) {
            if (typeof rawDate === "number") {
              // Excel serial date
              const d = XLSX.SSF.parse_date_code(rawDate as number);
              dateStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
            } else {
              dateStr = toISO(String(rawDate).trim());
            }
          }

          const cycleKey = getCycleKey(dateStr);
          return {
            crdts: String(get("CRDTS") ?? get("crdts") ?? "").trim(),
            agentCode: String(get("Agent Code") ?? get("agentCode") ?? "").trim() || undefined,
            alias: String(get("Alias") ?? get("alias") ?? "").trim() || undefined,
            date: dateStr,
            cycleKey,
          };
        }).filter(r => r.crdts !== "" && r.date !== "");

        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure 'CRDTS' and 'Date' columns are present.");
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
    const headers = ["CRDTS", "Alias", "Agent Code", "Date"];
    const example = ["1001", "Harry", "TN-001", "2026-05-10"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ClientLogouts");
    XLSX.writeFile(wb, "client_logouts_template.xlsx");
  }

  function handleUpload() {
    if (parsedRows.length === 0) return;
    uploadMutation.mutate({ rows: parsedRows });
  }

  // Group view logouts by agent
  const groupedByAgent = logoutsByCycle.reduce((acc, l) => {
    const key = l.crdts ?? "unknown";
    if (!acc[key]) acc[key] = { alias: l.alias, agentCode: l.agentCode, dates: [] };
    acc[key].dates.push(l.date ?? "");
    return acc;
  }, {} as Record<string, { alias: string | null; agentCode: string | null; dates: string[] }>);

  // Cycle options (last 12 months)
  const cycleOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <PhoneOff className="w-6 h-6 text-destructive" />
              Client Logouts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and review dates when clients logged out agents due to performance issues.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Upload preview */}
        {(parsedRows.length > 0 || parseError) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {parseError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{parseError}</span>
                </div>
              )}
              {parsedRows.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{parsedRows.length} rows parsed — ready to upload</span>
                  </div>
                  <div className="overflow-x-auto max-h-56 border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 font-medium">CRDTS</th>
                          <th className="text-left px-3 py-2 font-medium">Alias</th>
                          <th className="text-left px-3 py-2 font-medium">Agent Code</th>
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                          <th className="text-left px-3 py-2 font-medium">Cycle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parsedRows.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-1.5 font-mono">{r.crdts}</td>
                            <td className="px-3 py-1.5">{r.alias || "—"}</td>
                            <td className="px-3 py-1.5">{r.agentCode || "—"}</td>
                            <td className="px-3 py-1.5">{r.date}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant="secondary" className="text-xs">{r.cycleKey}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setParsedRows([]); setParseError(null); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? "Uploading…" : `Upload ${parsedRows.length} Records`}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* View by cycle */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Records by Cycle</CardTitle>
              <select
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                className="text-sm rounded-lg border px-3 py-1.5 bg-background"
              >
                {cycleOptions.map(c => (
                  <option key={c} value={c}>{formatMonthLabel(c)}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLogouts ? (
              <div className="h-32 rounded-lg animate-pulse bg-muted" />
            ) : logoutsByCycle.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PhoneOff className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No client logouts for {formatMonthLabel(selectedCycle)}.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {logoutsByCycle.length} logout{logoutsByCycle.length !== 1 ? "s" : ""} across {Object.keys(groupedByAgent).length} agent{Object.keys(groupedByAgent).length !== 1 ? "s" : ""}
                </p>
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 font-medium">CRDTS</th>
                        <th className="text-left px-4 py-2.5 font-medium">Alias</th>
                        <th className="text-left px-4 py-2.5 font-medium">Agent Code</th>
                        <th className="text-left px-4 py-2.5 font-medium">Dates</th>
                        <th className="text-right px-4 py-2.5 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(groupedByAgent)
                        .sort((a, b) => b[1].dates.length - a[1].dates.length)
                        .map(([crdts, info]) => (
                          <tr key={crdts} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono text-xs">{crdts}</td>
                            <td className="px-4 py-2.5">{info.alias || "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{info.agentCode || "—"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {info.dates.sort().map((d, i) => (
                                  <Badge key={i} variant="destructive" className="text-xs font-mono px-1.5 py-0">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Badge variant="secondary" className="font-bold">{info.dates.length}</Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload hint */}
        {parsedRows.length === 0 && !parseError && (
          <p className="text-xs text-muted-foreground text-center">
            Expected columns: CRDTS | Alias | Agent Code | Date (YYYY-MM-DD). Cycle key is auto-calculated from date.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
