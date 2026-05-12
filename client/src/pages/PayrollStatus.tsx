import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, CreditCard, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PayrollRow = {
  id: number;
  crdts: string | null;
  alias: string | null;
  agentCode: string | null;
  netPay: string | null;
  paymentStatus: string | null;
  paidAt: number | null;
  month: string;
};

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function fmtEGP(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayrollStatus() {
  const utils = trpc.useUtils();

  // Get available months from payroll records
  const { data: allMonths = [] } = trpc.payrollV2.getStatusPage.useQuery(
    { month: "2099-01" }, // dummy to get months — we'll use a separate approach
    { enabled: false }
  );
  // Use a workaround: fetch a known month or use current month as default
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [monthInput, setMonthInput] = useState<string>(currentMonth);

  const { data: rows = [], isLoading } = trpc.payrollV2.getStatusPage.useQuery(
    { month: selectedMonth },
    { enabled: !!selectedMonth }
  ) as { data: PayrollRow[]; isLoading: boolean };

  const setStatusMutation = trpc.payrollV2.setStatus.useMutation({
    onSuccess: () => {
      utils.payrollV2.getStatusPage.invalidate();
      toast.success("Payment status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleToggleStatus(row: PayrollRow) {
    const newStatus = row.paymentStatus === "paid" ? "pending" : "paid";
    setStatusMutation.mutate({ id: row.id, status: newStatus });
  }

  function handleExport() {
    if (rows.length === 0) { toast.error("No data to export"); return; }
    const headers = ["CRDTS", "Alias", "Agent Code", "Net Pay (EGP)", "Status", "Payment Date"];
    const csvRows = rows.map(r => [
      r.crdts ?? "",
      r.alias ?? "",
      r.agentCode ?? "",
      r.netPay ?? "",
      r.paymentStatus ?? "pending",
      r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-US") : "",
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-status-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  }

  const paidCount = rows.filter(r => r.paymentStatus === "paid").length;
  const pendingCount = rows.filter(r => r.paymentStatus !== "paid").length;
  const totalNetPay = rows.reduce((sum, r) => sum + (r.netPay ? parseFloat(r.netPay) : 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Status</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage agent payment status by month</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Month:</label>
        <input
          type="month"
          value={monthInput}
          onChange={e => setMonthInput(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        />
        <Button size="sm" onClick={() => setSelectedMonth(monthInput)}>Load</Button>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold">{paidCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Net Pay</p>
                  <p className="text-lg font-bold">
                    EGP {totalNetPay.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
            {selectedMonth ? formatMonthLabel(selectedMonth) : "Select a month"} — {rows.length} agent{rows.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No payroll records found for {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">CRDTS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alias</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent Code</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net Pay</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment Date</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{row.crdts ?? "—"}</td>
                      <td className="px-4 py-3">{row.alias ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.agentCode ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtEGP(row.netPay)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={row.paymentStatus === "paid" ? "default" : "secondary"}
                          className={row.paymentStatus === "paid"
                            ? "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20"
                            : "bg-amber-500/15 text-amber-600 border-amber-500/30"}
                        >
                          {row.paymentStatus === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {row.paidAt ? new Date(row.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          disabled={setStatusMutation.isPending}
                          onClick={() => handleToggleStatus(row)}
                        >
                          {row.paymentStatus === "paid" ? "Mark Pending" : "Mark Paid"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
