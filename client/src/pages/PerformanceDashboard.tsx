import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, Upload, TrendingUp, DollarSign, Clock, BarChart2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type PerfRow = {
  id: number;
  crdts: string | null;
  alias: string | null;
  agentCode: string | null;
  month: string;
  loginHours: string | null;
  revenue: string | null;
  cost: string | null;
  profit: string | null;
  revPerHour: string | null;
};

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function fmtNum(val: string | null | undefined, prefix = "", suffix = "") {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${suffix}`;
}

export default function PerformanceDashboard() {
  const utils = trpc.useUtils();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthInput, setMonthInput] = useState(currentMonth);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRows, setUploadRows] = useState<Array<Record<string, unknown>>>([]);
  const [uploadMonth, setUploadMonth] = useState(currentMonth);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rows = [], isLoading } = trpc.performanceV2.getByMonth.useQuery(
    { month: selectedMonth },
    { enabled: !!selectedMonth }
  ) as { data: PerfRow[]; isLoading: boolean };

  const bulkUpsert = trpc.performanceV2.bulkUpsert.useMutation({
    onSuccess: (r) => {
      utils.performanceV2.getByMonth.invalidate();
      toast.success(`Uploaded ${(r as { success: boolean }).success ? uploadRows.length : 0} records`);
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
      crdts: String(r["CRDTS"] ?? r["crdts"] ?? ""),
      alias: r["Alias"] != null ? String(r["Alias"]) : undefined,
      agentCode: r["Agent Code"] != null ? String(r["Agent Code"]) : undefined,
      loginHours: r["Login Hours"] != null ? parseFloat(String(r["Login Hours"])) : undefined,
      revenue: r["Revenue"] != null ? parseFloat(String(r["Revenue"])) : undefined,
      cost: r["Cost"] != null ? parseFloat(String(r["Cost"])) : undefined,
      profit: r["Profit"] != null ? parseFloat(String(r["Profit"])) : undefined,
      revPerHour: r["Rev/Hour"] != null ? parseFloat(String(r["Rev/Hour"])) : undefined,
    })).filter(r => r.crdts);
    bulkUpsert.mutate({ month: uploadMonth, rows: mapped });
  }

  function handleExport() {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const headers = ["CRDTS", "Alias", "Agent Code", "Login Hours", "Revenue", "Cost", "Profit", "Rev/Hour"];
    const csvRows = rows.map(r => [
      r.crdts ?? "", r.alias ?? "", r.agentCode ?? "",
      r.loginHours ?? "", r.revenue ?? "", r.cost ?? "", r.profit ?? "", r.revPerHour ?? "",
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const headers = [["CRDTS", "Alias", "Agent Code", "Login Hours", "Revenue", "Cost", "Profit", "Rev/Hour"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Performance");
    XLSX.writeFile(wb, "performance-template.xlsx");
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ? parseFloat(r.revenue) : 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.profit ? parseFloat(r.profit) : 0), 0);
  const totalHours = rows.reduce((s, r) => s + (r.loginHours ? parseFloat(r.loginHours) : 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Agent performance metrics by month</p>
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

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Revenue", value: `EGP ${totalRevenue.toLocaleString("en-EG", { minimumFractionDigits: 0 })}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Total Profit", value: `EGP ${totalProfit.toLocaleString("en-EG", { minimumFractionDigits: 0 })}`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Total Login Hours", value: `${totalHours.toLocaleString("en-EG", { minimumFractionDigits: 0 })} hrs`, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
                  <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            {selectedMonth ? formatMonthLabel(selectedMonth) : "Select a month"} — {rows.length} agent{rows.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No performance data for {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
              <br /><span className="text-xs">Upload an Excel file to get started.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["CRDTS", "Alias", "Agent Code", "Login Hrs", "Revenue", "Cost", "Profit", "Rev/Hr"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{row.crdts ?? "—"}</td>
                      <td className="px-4 py-3">{row.alias ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.agentCode ?? "—"}</td>
                      <td className="px-4 py-3">{fmtNum(row.loginHours, "", " hrs")}</td>
                      <td className="px-4 py-3 font-medium text-green-600">{fmtNum(row.revenue, "EGP ")}</td>
                      <td className="px-4 py-3 text-red-500">{fmtNum(row.cost, "EGP ")}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{fmtNum(row.profit, "EGP ")}</td>
                      <td className="px-4 py-3">{fmtNum(row.revPerHour, "EGP ")}</td>
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
          <DialogHeader>
            <DialogTitle>Upload Performance Data</DialogTitle>
          </DialogHeader>
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
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select Excel file</p>
                {uploadRows.length > 0 && (
                  <p className="text-sm font-medium text-primary mt-2">{uploadRows.length} rows loaded</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadRows([]); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploadRows.length === 0 || bulkUpsert.isPending}>
              {bulkUpsert.isPending ? "Uploading..." : `Upload ${uploadRows.length} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
