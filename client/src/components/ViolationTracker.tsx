import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertCircle, Clock, TrendingUp, Users, Search } from "lucide-react";

const BRAND = "#FF6A13";

export type ViolationRow = {
  id: number; crdts: string; agentCode: string | null; date: string; month: string | null;
  type: string; category: string; hours: string | null; deduction: string | null;
  description: string | null; status: string; approvedBy: string | null;
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${MONTH_NAMES[Number(mm) - 1] ?? mm} ${y}`;
};

/**
 * Shared tracker for the pushed violation data (adherence + quality).
 * Data arrives nightly from the sheets — DISPLAY ONLY, no payroll effect.
 */
export function ViolationTracker({
  category, title, subtitle, icon,
}: {
  category: "attendance" | "quality";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [q, setQ] = useState("");

  const { data: all = [], isLoading } = trpc.violations.list.useQuery({ category });
  const { data: agents = [] } = trpc.workforce.list.useQuery({});

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    (agents as { crdts: string | null; alias: string | null; fullName: string | null }[])
      .forEach(a => { if (a.crdts) m.set(a.crdts, a.alias || a.fullName || a.crdts); });
    return m;
  }, [agents]);

  const months = useMemo(() => {
    const s = new Set<string>();
    (all as ViolationRow[]).forEach(r => { if (r.month) s.add(r.month); });
    return Array.from(s).sort().reverse();
  }, [all]);

  const rows = useMemo(() => {
    let r = (all as ViolationRow[]).filter(x => x.month === month);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x =>
        x.crdts.includes(t) ||
        (nameOf.get(x.crdts) || "").toLowerCase().includes(t) ||
        (x.type || "").toLowerCase().includes(t));
    }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [all, month, q, nameOf]);

  const num = (v: unknown) => Number(v || 0);
  const totalEgp = rows.reduce((s, r) => s + num(r.deduction), 0);
  const totalHrs = rows.reduce((s, r) => s + num(r.hours), 0);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.type || "—", (m.get(r.type || "—") || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byAgent = useMemo(() => {
    const m = new Map<string, { n: number; egp: number }>();
    rows.forEach(r => {
      const c = m.get(r.crdts) || { n: 0, egp: 0 };
      c.n++; c.egp += num(r.deduction);
      m.set(r.crdts, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n);
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">{icon} {title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded-md px-2 py-1.5 text-sm bg-background"
          value={month} onChange={e => setMonth(e.target.value)}>
          {months.length === 0 && <option value={month}>{monthLabel(month)}</option>}
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Agent, CRDTS or type…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<AlertCircle className="w-4 h-4" />} label="Violations" value={rows.length} />
        <Stat icon={<Users className="w-4 h-4" />} label="Agents involved" value={byAgent.length} />
        <Stat icon={<Clock className="w-4 h-4" />} label="Hours deducted" value={totalHrs ? totalHrs.toFixed(1) : "0"} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="EGP deducted" value={totalEgp.toLocaleString()} tone="red" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm font-medium">Nothing logged for {monthLabel(month)}.</p>
          <p className="text-xs text-muted-foreground mt-1">Data syncs nightly from the sheet.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">By type</p>
              <div className="space-y-1.5">
                {byType.map(([t, n]) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{t}</span>
                    <div className="h-1.5 rounded-full bg-muted w-24 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / rows.length) * 100}%`, background: BRAND }} />
                    </div>
                    <span className="text-xs font-semibold w-6 text-right">{n}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">Most flagged agents</p>
              <div className="space-y-1.5">
                {byAgent.slice(0, 8).map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">
                      {nameOf.get(c) || "—"} <span className="text-muted-foreground">· {c}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">{v.n}</Badge>
                    <span className="text-red-600 font-semibold w-20 text-right">{v.egp ? `${v.egp.toLocaleString()} EGP` : "—"}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>

          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Agent</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Details</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Hrs</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">EGP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{r.date}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{nameOf.get(r.crdts) || "—"}</span>
                        <span className="text-muted-foreground text-xs"> · {r.crdts}</span>
                      </td>
                      <td className="px-3 py-2">{r.type}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate" title={r.description || ""}>{r.description || "—"}</td>
                      <td className="px-3 py-2 text-right">{num(r.hours) || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">{num(r.deduction) ? num(r.deduction).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: "red" }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${BRAND}1a`, color: BRAND }}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${tone === "red" ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
