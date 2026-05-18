import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, Search, DollarSign, Phone, Clock, Users, Download,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useLocation } from "wouter";

const BRAND = "#8B1A1A";

type AgentStat = {
  crdts: string;
  agentCode: string | null;
  alias: string | null;
  totalRevenue: number;
  totalCalls: number;
  totalLoginHours: number;
  totalProfit: number;
  avgRevPerHr: number;
  days: number;
};

function fmt$(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtHr(n: number) { return `${n.toFixed(1)}h`; }

export default function PerformanceReports() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "calls" | "revPerHr" | "profit">("revenue");
  const [cycleKey, setCycleKey] = useState<string>("");

  const { data: cycleInfo } = trpc.cycleTracker.getCurrentCycle.useQuery();
  const currentCycle = cycleInfo?.cycleKey ?? "";

  // Use current cycle if none selected
  const activeCycle = cycleKey || currentCycle;

  const { data: rawStats = [], isLoading } = trpc.cycleTracker.getTeamStats.useQuery(
    { cycleKey: activeCycle },
    { enabled: !!activeCycle }
  );

  // Build past 6 cycles for selector
  const pastCycles: string[] = [];
  if (currentCycle) {
    const [y, m] = currentCycle.split("-").map(Number);
    for (let i = 0; i < 6; i++) {
      const d = new Date(y, m - 1 - i, 1);
      pastCycles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  const stats = rawStats as AgentStat[];

  const filtered = stats
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.crdts.toLowerCase().includes(q) ||
        (s.alias ?? "").toLowerCase().includes(q) ||
        (s.agentCode ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sortBy === "calls") return b.totalCalls - a.totalCalls;
      if (sortBy === "revPerHr") return b.avgRevPerHr - a.avgRevPerHr;
      if (sortBy === "profit") return b.totalProfit - a.totalProfit;
      return 0;
    });

  const teamTotals = stats.reduce(
    (acc, s) => ({
      revenue: acc.revenue + s.totalRevenue,
      calls: acc.calls + s.totalCalls,
      loginHours: acc.loginHours + s.totalLoginHours,
      profit: acc.profit + s.totalProfit,
    }),
    { revenue: 0, calls: 0, loginHours: 0, profit: 0 }
  );

  const teamAvgRevPerHr = teamTotals.loginHours > 0
    ? teamTotals.revenue / teamTotals.loginHours
    : 0;

  function exportCSV() {
    const header = ["CRDTS", "Agent Code", "Alias", "Revenue ($)", "Calls", "Login Hours", "Profit ($)", "Rev/Hr ($)"];
    const rows = filtered.map(s => [
      s.crdts, s.agentCode ?? "", s.alias ?? "",
      s.totalRevenue.toFixed(2), s.totalCalls, s.totalLoginHours.toFixed(1),
      s.totalProfit.toFixed(2), s.avgRevPerHr.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${activeCycle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function rankBadge(i: number) {
    if (i === 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">#1</span>;
    if (i === 1) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">#2</span>;
    if (i === 2) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">#3</span>;
    return <span className="text-[10px] text-muted-foreground">#{i + 1}</span>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6" style={{ color: BRAND }} />
            Performance Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cycle-level performance summary per agent</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Cycle selector */}
          <Select value={activeCycle} onValueChange={setCycleKey}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {pastCycles.map(c => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c} {c === currentCycle ? "(Current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: fmt$(teamTotals.revenue), icon: DollarSign, color: "text-emerald-600" },
          { label: "Total Calls",   value: teamTotals.calls.toLocaleString(), icon: Phone, color: "text-blue-600" },
          { label: "Login Hours",   value: fmtHr(teamTotals.loginHours), icon: Clock, color: "text-purple-600" },
          { label: "Avg Rev/Hr",    value: fmt$(teamAvgRevPerHr), icon: TrendingUp, color: "text-amber-600" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xl font-bold">{isLoading ? "—" : kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.length} agents · Cycle {activeCycle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by CRDTS, alias, or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue" className="text-xs">Sort: Revenue</SelectItem>
            <SelectItem value="calls" className="text-xs">Sort: Calls</SelectItem>
            <SelectItem value="revPerHr" className="text-xs">Sort: Rev/Hr</SelectItem>
            <SelectItem value="profit" className="text-xs">Sort: Profit</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          {filtered.length} agents
        </Badge>
      </div>

      {/* Agent Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No performance data for cycle {activeCycle}</p>
            <p className="text-xs text-muted-foreground mt-1">Upload stats in the Cycle Tracker to see data here.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/cycle-tracker")}>
              Go to Cycle Tracker
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Calls</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Login Hrs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Rev/Hr</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Profit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const vsAvg = teamAvgRevPerHr > 0 ? ((s.avgRevPerHr - teamAvgRevPerHr) / teamAvgRevPerHr) * 100 : 0;
                const TrendIcon = vsAvg > 5 ? ArrowUpRight : vsAvg < -5 ? ArrowDownRight : Minus;
                const trendColor = vsAvg > 5 ? "text-emerald-600" : vsAvg < -5 ? "text-red-600" : "text-muted-foreground";
                return (
                  <tr key={s.crdts} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">{rankBadge(i)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-xs font-mono">{s.crdts}</p>
                        {(s.alias || s.agentCode) && (
                          <p className="text-[10px] text-muted-foreground">{s.alias || s.agentCode}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-xs text-emerald-700">{fmt$(s.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">{s.totalCalls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{fmtHr(s.totalLoginHours)}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs font-medium">{fmt$(s.avgRevPerHr)}</span>
                        <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">{fmt$(s.totalProfit)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">{s.days}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
