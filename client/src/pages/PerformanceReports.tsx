import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, Search, DollarSign, Phone, Clock, Users, Download,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid,
} from "recharts";

type AgentStat = {
  crdts: string;
  agentCode: string | null;
  alias: string | null;
  teamLeader: string | null;
  totalRevenue: number;
  totalCalls: number;
  totalLoginHours: number;
  totalProfit: number;
  avgRevPerHr: number;
  days: number;
};

function fmt$(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtHr(n: number) { return `${n.toFixed(1)}h`; }

function rankBadge(i: number) {
  if (i === 0) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">1</span>;
  if (i === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">2</span>;
  if (i === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">3</span>;
  return <span className="text-xs text-muted-foreground">{i + 1}</span>;
}

type DailyPoint = { date: string; loginHours: number; revenue: number; totalCalls: number; profit: number; };

function AgentDetailChart({ crdts, cycleKey }: { crdts: string; cycleKey: string }) {
  const { data, isLoading } = trpc.cycleTracker.getAgentDailyStats.useQuery(
    { crdts, cycleKey },
    { enabled: !!crdts && !!cycleKey }
  );
  if (isLoading) return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">Loading chart…</div>;
  if (!data || data.daily.length === 0) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No daily data available</div>;

  const chartData = (data.daily as DailyPoint[]).map(d => ({ ...d, label: d.date.slice(5) }));
  return (
    <div className="px-4 pb-4 space-y-3">
      {data.logoutDates.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">{data.logoutDates.length} client logout{data.logoutDates.length !== 1 ? "s" : ""} this cycle</span>
          <span className="text-muted-foreground">({data.logoutDates.join(", ")})</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Login Hours / Day</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px" }} formatter={(v: number) => [`${v.toFixed(1)}h`, "Hours"]} />
              {data.logoutDates.map((d: string) => <ReferenceLine key={d} x={d.slice(5)} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />)}
              <Line type="monotone" dataKey="loginHours" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Revenue / Day</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px" }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
              {data.logoutDates.map((d: string) => <ReferenceLine key={d} x={d.slice(5)} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />)}
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Profit / Day</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px" }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Profit"]} />
              {data.logoutDates.map((d: string) => <ReferenceLine key={d} x={d.slice(5)} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />)}
              {/* Zero line + red dots make loss days obvious without hovering */}
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
              <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={1.5}
                dot={(p: { cx?: number; cy?: number; payload?: { profit?: number }; index?: number }) =>
                  (p.payload?.profit ?? 0) < 0
                    ? <circle key={`n${p.index}`} cx={p.cx} cy={p.cy} r={3} fill="#dc2626" />
                    : <g key={`p${p.index}`} />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {data.logoutDates.length > 0 && <p className="text-[10px] text-muted-foreground">Red dashed lines = client logout dates.</p>}
    </div>
  );
}

export default function PerformanceReports() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "calls" | "revPerHr" | "profit">("revenue");
  const [cycleKey, setCycleKey] = useState<string>("");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [expandedCrdts, setExpandedCrdts] = useState<Set<string>>(new Set());

  const { data: cycleInfo } = trpc.cycleTracker.getCurrentCycle.useQuery();
  const currentCycle = cycleInfo?.cycleKey ?? "";
  const activeCycle = cycleKey || currentCycle;

  const { data: rawStats = [], isLoading } = trpc.cycleTracker.getTeamStats.useQuery(
    { cycleKey: activeCycle },
    { enabled: !!activeCycle }
  );

  const pastCycles: string[] = [];
  if (currentCycle) {
    const [y, m] = currentCycle.split("-").map(Number);
    for (let i = 0; i < 6; i++) {
      const d = new Date(y, m - 1 - i, 1);
      pastCycles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  // Previous cycle key for comparison
  const prevCycleKey = (() => {
    if (!activeCycle) return "";
    const [y, m] = activeCycle.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const { data: rawPrevStats = [] } = trpc.cycleTracker.getTeamStats.useQuery(
    { cycleKey: prevCycleKey },
    { enabled: !!prevCycleKey }
  );
  const prevStats = rawPrevStats as AgentStat[];
  const prevTeamRevenue = prevStats.reduce((acc, s) => acc + s.totalRevenue, 0);
  // Client logouts for current cycle
  const { data: rawLogouts = [] } = trpc.cycleTracker.getClientLogoutsByCycle.useQuery(
    { cycleKey: activeCycle },
    { enabled: !!activeCycle }
  );
  type LogoutRow = { crdts: string; alias: string | null; agentCode: string | null; };
  const logouts = rawLogouts as LogoutRow[];
  const logoutCountByCrdts = logouts.reduce((acc, l) => { acc[l.crdts] = (acc[l.crdts] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const stats = rawStats as AgentStat[];
  const uniqueTLs = Array.from(new Set(stats.map(s => s.teamLeader).filter(Boolean) as string[])).sort();

  const filtered = stats
    .filter(s => {
      const matchesSearch = !search || [s.crdts, s.alias ?? "", s.agentCode ?? ""].some(v => v.toLowerCase().includes(search.toLowerCase()));
      const matchesTL = tlFilter === "all" || s.teamLeader === tlFilter;
      return matchesSearch && matchesTL;
    })
    .sort((a, b) => {
      if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sortBy === "calls") return b.totalCalls - a.totalCalls;
      if (sortBy === "revPerHr") return b.avgRevPerHr - a.avgRevPerHr;
      if (sortBy === "profit") return b.totalProfit - a.totalProfit;
      return 0;
    });

  const teamTotals = stats.reduce(
    (acc, s) => ({ revenue: acc.revenue + s.totalRevenue, calls: acc.calls + s.totalCalls, loginHours: acc.loginHours + s.totalLoginHours, profit: acc.profit + s.totalProfit }),
    { revenue: 0, calls: 0, loginHours: 0, profit: 0 }
  );
  const teamAvgRevPerHr = teamTotals.loginHours > 0 ? teamTotals.revenue / teamTotals.loginHours : 0;

  function toggleExpand(crdts: string) {
    setExpandedCrdts(prev => { const next = new Set(prev); if (next.has(crdts)) next.delete(crdts); else next.add(crdts); return next; });
  }

  function exportCSV() {
    const header = ["CRDTS", "Agent Code", "Alias", "Revenue ($)", "Login Hours", "Profit ($)", "Rev/Hr ($)"];
    const rows = filtered.map(s => [s.crdts, s.agentCode ?? "", s.alias ?? "", s.totalRevenue.toFixed(2), s.totalLoginHours.toFixed(1), s.totalProfit.toFixed(2), s.avgRevPerHr.toFixed(2)]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `performance-${activeCycle}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Performance Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agent performance by cycle — click a row to expand daily charts</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {stats.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(() => {
              const revChange = prevTeamRevenue > 0 ? ((teamTotals.revenue - prevTeamRevenue) / prevTeamRevenue) * 100 : null;
              return [
                { label: "Team Revenue", value: fmt$(teamTotals.revenue), icon: DollarSign, color: "text-emerald-600", sub: revChange !== null ? `${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}% vs ${prevCycleKey}` : undefined, subColor: revChange !== null ? (revChange >= 0 ? "text-emerald-600" : "text-red-500") : undefined },
                { label: "Login Hours", value: fmtHr(teamTotals.loginHours), icon: Clock, color: "text-purple-600" },
                { label: "Agents", value: stats.length.toString(), icon: Users, color: "text-amber-600" },
              ];
            })().map(card => (
              <Card key={card.label} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-base font-bold">{card.value}</p>
                    {card.sub && <p className={`text-[10px] font-medium ${card.subColor}`}>{card.sub}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Team Summary: Top Performers + Most Logouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top 3 Performers */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top Performers — {activeCycle}</p>
                <div className="space-y-2">
                  {[...stats].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3).map((s, i) => (
                    <div key={s.crdts} className="flex items-center gap-3">
                      {rankBadge(i)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium font-mono truncate">{s.alias || s.crdts}</p>
                        {s.teamLeader && <p className="text-[10px] text-muted-foreground">TL: {s.teamLeader}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-600">{fmt$(s.totalRevenue)}</p>
                        <p className="text-[10px] font-semibold text-indigo-600">{fmt$(s.totalProfit)} profit</p>
                        <p className="text-[10px] text-muted-foreground">{fmt$(s.avgRevPerHr)}/hr</p>
                      </div>
                    </div>
                  ))}
                  {stats.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No data</p>}
                </div>
              </CardContent>
            </Card>

            {/* Most Logouts + Most Deductions */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Client Logouts — {activeCycle}</p>
                {Object.keys(logoutCountByCrdts).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No client logouts this cycle ✓</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(logoutCountByCrdts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([crdts, count]) => {
                        const agent = stats.find(s => s.crdts === crdts);
                        return (
                          <div key={crdts} className="flex items-center gap-3">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium font-mono truncate">{agent?.alias || crdts}</p>
                              {agent?.teamLeader && <p className="text-[10px] text-muted-foreground">TL: {agent.teamLeader}</p>}
                            </div>
                            <span className="text-xs font-bold text-red-600">{count} logout{count !== 1 ? "s" : ""}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search CRDTS, alias…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={cycleKey || currentCycle} onValueChange={v => setCycleKey(v === currentCycle ? "" : v)}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Select cycle" /></SelectTrigger>
          <SelectContent>
            {pastCycles.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {uniqueTLs.length > 0 && (
          <Select value={tlFilter} onValueChange={setTlFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="All TLs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All TLs</SelectItem>
              {uniqueTLs.map(tl => <SelectItem key={tl} value={tl} className="text-xs">{tl}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue" className="text-xs">Sort: Revenue</SelectItem>
            <SelectItem value="revPerHr" className="text-xs">Sort: Rev/Hr</SelectItem>
            <SelectItem value="profit" className="text-xs">Sort: Profit</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{filtered.length} agents</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No performance data for cycle {activeCycle}</p>
            <p className="text-xs text-muted-foreground mt-1">Upload stats in the Cycle Tracker to see data here.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/cycle-tracker")}>Go to Cycle Tracker</Button>
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
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Login Hrs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Rev/Hr</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Profit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Days</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const vsAvg = teamAvgRevPerHr > 0 ? ((s.avgRevPerHr - teamAvgRevPerHr) / teamAvgRevPerHr) * 100 : 0;
                const TrendIcon = vsAvg > 5 ? ArrowUpRight : vsAvg < -5 ? ArrowDownRight : Minus;
                const trendColor = vsAvg > 5 ? "text-emerald-600" : vsAvg < -5 ? "text-red-600" : "text-muted-foreground";
                const isExpanded = expandedCrdts.has(s.crdts);
                return (
                  <>
                    <tr key={s.crdts} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleExpand(s.crdts)}>
                      <td className="px-4 py-3">{rankBadge(i)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs font-mono">{s.crdts}</p>
                        {(s.alias || s.agentCode) && <p className="text-[10px] text-muted-foreground">{s.alias || s.agentCode}</p>}
                        {s.teamLeader && <p className="text-[10px] text-muted-foreground">TL: {s.teamLeader}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-xs text-emerald-700">{fmt$(s.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{fmtHr(s.totalLoginHours)}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs font-medium">{fmt$(s.avgRevPerHr)}</span>
                          <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">{fmt$(s.totalProfit)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">{s.days}</td>
                      <td className="px-4 py-3 text-right">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${s.crdts}-detail`} className="border-b bg-muted/10">
                        <td colSpan={9} className="p-0">
                          <AgentDetailChart crdts={s.crdts} cycleKey={activeCycle} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
