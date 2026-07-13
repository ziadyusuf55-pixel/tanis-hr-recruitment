import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Users, TrendingUp, Search, Zap } from "lucide-react";

const BRAND = "#FF6A13";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const mLabel = (m: string) => { const [y, mm] = m.split("-"); return `${MONTHS[Number(mm) - 1] ?? mm} ${y}`; };

type OT = { id: number; crdts: string; alias: string | null; date: string; cycleKey: string; otType: string; hours: string | null; egpAmount: string | null };

/**
 * Overtime — the landing page for the nightly push from the OT sheet.
 * Shows how much OT is being granted, of which type, to whom, and the trend.
 * DISPLAY ONLY: payroll is calculated in Python from the same sheet.
 */
export default function OTLog() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [q, setQ] = useState("");

  const { data: all = [], isLoading } = trpc.ot.list.useQuery({});
  const { data: agents = [] } = trpc.workforce.list.useQuery({});

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    (agents as { crdts: string | null; alias: string | null; fullName: string | null }[])
      .forEach(a => { if (a.crdts) m.set(a.crdts, a.alias || a.fullName || a.crdts); });
    return m;
  }, [agents]);

  const months = useMemo(() => {
    const s = new Set<string>();
    (all as OT[]).forEach(r => { if (r.cycleKey) s.add(r.cycleKey); });
    return Array.from(s).sort().reverse();
  }, [all]);

  const rows = useMemo(() => {
    let r = (all as OT[]).filter(x => x.cycleKey === month);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x => x.crdts.includes(t) || (x.alias || nameOf.get(x.crdts) || "").toLowerCase().includes(t));
    }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [all, month, q, nameOf]);

  const num = (v: unknown) => Number(v || 0);
  const totalHrs = rows.reduce((s, r) => s + num(r.hours), 0);
  const totalEgp = rows.reduce((s, r) => s + num(r.egpAmount), 0);

  const byType = useMemo(() => {
    const m = new Map<string, { n: number; hrs: number; egp: number }>();
    rows.forEach(r => {
      const k = r.otType || "—";
      const c = m.get(k) || { n: 0, hrs: 0, egp: 0 };
      c.n++; c.hrs += num(r.hours); c.egp += num(r.egpAmount);
      m.set(k, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].egp - a[1].egp);
  }, [rows]);

  const byAgent = useMemo(() => {
    const m = new Map<string, { hrs: number; egp: number }>();
    rows.forEach(r => {
      const c = m.get(r.crdts) || { hrs: 0, egp: 0 };
      c.hrs += num(r.hours); c.egp += num(r.egpAmount);
      m.set(r.crdts, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].egp - a[1].egp);
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: BRAND }} /> Overtime
        </h1>
        <p className="text-xs text-muted-foreground">
          Synced nightly from the OT sheet. Reference only — payroll is calculated separately.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded-md px-2 py-1.5 text-sm bg-background" value={month} onChange={e => setMonth(e.target.value)}>
          {months.length === 0 && <option value={month}>{mLabel(month)}</option>}
          {months.map(m => <option key={m} value={m}>{mLabel(m)}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Agent or CRDTS…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <S icon={<Clock className="w-4 h-4" />} label="OT entries" value={rows.length} />
        <S icon={<Users className="w-4 h-4" />} label="Agents" value={byAgent.length} />
        <S icon={<Clock className="w-4 h-4" />} label="Total hours" value={totalHrs.toFixed(1)} />
        <S icon={<TrendingUp className="w-4 h-4" />} label="Total EGP" value={totalEgp.toLocaleString()} green />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm font-medium">No overtime for {mLabel(month)}.</p>
          <p className="text-xs text-muted-foreground mt-1">Data syncs nightly from the OT sheet.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">By OT type</p>
              <div className="space-y-2">
                {byType.map(([t, v]) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] w-12 justify-center">{t}</Badge>
                    <div className="h-1.5 rounded-full bg-muted flex-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(v.egp / (totalEgp || 1)) * 100}%`, background: BRAND }} />
                    </div>
                    <span className="text-muted-foreground w-14 text-right">{v.hrs.toFixed(1)}h</span>
                    <span className="font-semibold text-emerald-600 w-20 text-right">{v.egp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">Most overtime</p>
              <div className="space-y-1.5">
                {byAgent.slice(0, 8).map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{nameOf.get(c) || "—"} <span className="text-muted-foreground">· {c}</span></span>
                    <span className="text-muted-foreground w-12 text-right">{v.hrs.toFixed(1)}h</span>
                    <span className="font-semibold text-emerald-600 w-20 text-right">{v.egp.toLocaleString()} EGP</span>
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
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Hours</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">EGP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.alias || nameOf.get(r.crdts) || "—"}</span>
                        <span className="text-muted-foreground text-xs"> · {r.crdts}</span>
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.otType}</Badge></td>
                      <td className="px-3 py-2 text-right">{num(r.hours).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{num(r.egpAmount).toLocaleString()}</td>
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

function S({ icon, label, value, green }: { icon: React.ReactNode; label: string; value: string | number; green?: boolean }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${BRAND}1a`, color: BRAND }}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${green ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  );
}
