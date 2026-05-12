import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, Upload, Star } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type QualityRow = {
  id: number;
  agentCode: string | null;
  crdts: string | null;
  alias: string | null;
  date: string;
  month: string | null;
  type: string;
  score: string | null;
  penalty: string | null;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: number | null;
};

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function QualityLog() {
  const utils = trpc.useUtils();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthInput, setMonthInput] = useState(currentMonth);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRows, setUploadRows] = useState<Array<Record<string, unknown>>>([]);
  const [uploadMonth, setUploadMonth] = useState(currentMonth);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rows = [], isLoading } = trpc.quality.list.useQuery(
    { month: selectedMonth },
    { enabled: !!selectedMonth }
  ) as { data: QualityRow[]; isLoading: boolean };

  const bulkInsert = trpc.quality.bulkInsert.useMutation({
    onSuccess: () => {
      utils.quality.list.invalidate();
      toast.success(`Uploaded ${uploadRows.length} quality records`);
      setUploadOpen(false);
      setUploadRows([]);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Array<Record<string, unknown>>;
      setUploadRows(data);
    };
    reader.readAsBinaryString(file);
  }

  function handleUpload() {
    if (uploadRows.length === 0) { toast.error("No data to upload"); return; }
    const mapped = uploadRows.map(r => ({
      agentCode: r["Agent Code"] != null ? String(r["Agent Code"]) : undefined,
      crdts: r["CRDTS"] != null ? String(r["CRDTS"]) : undefined,
      alias: r["Alias"] != null ? String(r["Alias"]) : undefined,
      date: String(r["Date"] ?? ""),
      month: uploadMonth,
      type: String(r["Type"] ?? "call_quality"),
      score: r["Score"] != null ? parseFloat(String(r["Score"])) : undefined,
      penalty: r["Penalty"] != null ? parseFloat(String(r["Penalty"])) : undefined,
      notes: r["Notes"] != null ? String(r["Notes"]) : undefined,
    })).filter(r => r.date);
    bulkInsert.mutate(mapped);
  }

  function handleExport() {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Agent Code", "CRDTS", "Alias", "Date", "Month", "Type", "Score", "Penalty (EGP)", "Notes"];
    const csvRows = rows.map(r => [
      r.agentCode ?? "", r.crdts ?? "", r.alias ?? "",
      r.date, r.month ?? "", r.type,
      r.score ?? "", r.penalty ?? "", r.notes ?? "",
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const headers = [["Agent Code", "CRDTS", "Alias", "Date", "Type", "Score", "Penalty", "Notes"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quality");
    XLSX.writeFile(wb, "quality-template.xlsx");
  }

  const totalPenalties = rows.reduce((s, r) => s + (r.penalty ? parseFloat(r.penalty) : 0), 0);
  const avgScore = rows.filter(r => r.score).length > 0
    ? rows.reduce((s, r) => s + (r.score ? parseFloat(r.score) : 0), 0) / rows.filter(r => r.score).length
    : null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quality Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track quality scores and penalties</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />Export
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />Upload Excel
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Month:</label>
        <input type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background" />
        <Button size="sm" onClick={() => setSelectedMonth(monthInput)}>Load</Button>
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><Star className="w-5 h-5 text-yellow-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{rows.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><Star className="w-5 h-5 text-yellow-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold">{avgScore != null ? avgScore.toFixed(1) : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><Star className="w-5 h-5 text-red-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Penalties</p>
                  <p className="text-lg font-bold text-red-600">
                    EGP {totalPenalties.toLocaleString("en-EG", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedMonth ? formatMonthLabel(selectedMonth) : "Select a month"} — {rows.length} record{rows.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No quality records for {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Agent Code", "CRDTS", "Alias", "Date", "Type", "Score", "Penalty", "Notes"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 text-muted-foreground">{row.agentCode ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.crdts ?? "—"}</td>
                      <td className="px-4 py-3">{row.alias ?? "—"}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-700">{row.type}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.score ? parseFloat(row.score).toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{row.penalty ? `EGP ${parseFloat(row.penalty).toLocaleString("en-EG")}` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload Quality Data</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Month:</label>
              <input type="month" value={uploadMonth} onChange={e => setUploadMonth(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background" />
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 mb-3">
                <Download className="w-4 h-4" />Download Template
              </Button>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select Excel file</p>
                {uploadRows.length > 0 && <p className="text-sm font-medium text-primary mt-2">{uploadRows.length} rows loaded</p>}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadRows([]); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploadRows.length === 0 || bulkInsert.isPending}>
              {bulkInsert.isPending ? "Uploading..." : `Upload ${uploadRows.length} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
