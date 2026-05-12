import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, Upload, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type AdherenceRow = {
  id: number;
  agentCode: string | null;
  crdts: string | null;
  alias: string | null;
  date: string;
  month: string | null;
  type: string;
  hours: string | null;
  deduction: string | null;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: number | null;
};

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function AdherenceLog() {
  const utils = trpc.useUtils();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthInput, setMonthInput] = useState(currentMonth);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRows, setUploadRows] = useState<Array<Record<string, unknown>>>([]);
  const [uploadMonth, setUploadMonth] = useState(currentMonth);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rows = [], isLoading } = trpc.adherence.list.useQuery(
    { month: selectedMonth },
    { enabled: !!selectedMonth }
  ) as { data: AdherenceRow[]; isLoading: boolean };

  const bulkInsert = trpc.adherence.bulkInsert.useMutation({
    onSuccess: () => {
      utils.adherence.list.invalidate();
      toast.success(`Uploaded ${uploadRows.length} adherence records`);
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
      type: String(r["Type"] ?? "absence"),
      hours: r["Hours"] != null ? parseFloat(String(r["Hours"])) : undefined,
      deduction: r["Deduction"] != null ? parseFloat(String(r["Deduction"])) : undefined,
      notes: r["Notes"] != null ? String(r["Notes"]) : undefined,
    })).filter(r => r.date);
    bulkInsert.mutate(mapped);
  }

  function handleExport() {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Agent Code", "CRDTS", "Alias", "Date", "Month", "Type", "Hours", "Deduction (EGP)", "Notes"];
    const csvRows = rows.map(r => [
      r.agentCode ?? "", r.crdts ?? "", r.alias ?? "",
      r.date, r.month ?? "", r.type,
      r.hours ?? "", r.deduction ?? "", r.notes ?? "",
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adherence-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const headers = [["Agent Code", "CRDTS", "Alias", "Date", "Type", "Hours", "Deduction", "Notes"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Adherence");
    XLSX.writeFile(wb, "adherence-template.xlsx");
  }

  const totalDeductions = rows.reduce((s, r) => s + (r.deduction ? parseFloat(r.deduction) : 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Adherence Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track attendance violations and deductions</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Incidents</p>
                  <p className="text-2xl font-bold">{rows.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Deductions</p>
                  <p className="text-lg font-bold text-red-600">
                    EGP {totalDeductions.toLocaleString("en-EG", { minimumFractionDigits: 0 })}
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
              No adherence records for {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Agent Code", "CRDTS", "Alias", "Date", "Type", "Hours", "Deduction", "Notes"].map(h => (
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
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">{row.type}</span>
                      </td>
                      <td className="px-4 py-3">{row.hours ? `${row.hours} hrs` : "—"}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{row.deduction ? `EGP ${parseFloat(row.deduction).toLocaleString("en-EG")}` : "—"}</td>
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
          <DialogHeader><DialogTitle>Upload Adherence Data</DialogTitle></DialogHeader>
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
