import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookOpen, Users, Clock, TrendingUp, Search, AlertTriangle } from "lucide-react";

const BRAND = "#FF6A13";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const mLabel = (m: string) => { const [y, mm] = m.split("-"); return `${MONTHS[Number(mm) - 1] ?? mm} ${y}`; };

type Session = {
  id: number; crdts: string; alias: string | null; sessionDate: string; cycleKey: string;
  coachingHours: string | null; bonusAmount: string | null; sessionType: string | null;
  notes: string | null; status: string;
};

/** Groups the free-text session topics into the categories that matter operationally. */
function categoryOf(topic: string | null): "Coaching" | "System issue" | "Call dropped" | "Other" {
  const t = (topic || "").toLowerCase();
  if (t.includes("dialer") || t.includes("network") || t.includes("system")) return "System issue";
  if (t.includes("drop")) return "Call dropped";
  if (t.includes("coach")) return "Coaching";
  return "Other";
}

const CAT_COLOR: Record<string, string> = {
  "Coaching": "#0ea5e9",
  "System issue": "#f59e0b",
  "Call dropped": "#ef4444",
  "Other": "#8b5cf6",
};

/**
 * Coaching — the landing page for the nightly push from the Coaching sheet.
 * Shows paid coaching sessions, system issues and dropped calls: who, how long,
 * how much, and the trend. DISPLAY ONLY — payroll is calculated separately in
 * Python from the same sheet.
 */
export default function CoachingAdmin() {
  const now = new Date();
  // Cycle runs 26th → 25th, so before the 26th we're still in the previous cycle's key.
  const cycleOf = (d: Date) => {
    const dd = new Date(d);
    if (dd.getDate() >= 26) dd.setMonth(dd.getMonth() + 1);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
  };
  const [cycle, setCycle] = useState(cycleOf(now));
  const [q, setQ] = useState("");

  // Offer the last 8 cycles in the picker.
  const cycles = useMemo(() => {
    const out: string[] = [];
    const d = new Date(now);
    for (let i = 0; i < 8; i++) { out.push(cycleOf(d)); d.setMonth(d.getMonth() - 1); }
    return out;
  }, []);

  const { data: all = [], isLoading } = trpc.coaching.listByCycle.useQuery({ cycleKey: cycle });
  const { data: agents = [] } = trpc.workforce.list.useQuery({});

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    (agents as { crdts: string | null; alias: string | null; fullName: string | null }[])
      .forEach(a => { if (a.crdts) m.set(a.crdts, a.alias || a.fullName || a.crdts); });
    return m;
  }, [agents]);

  const rows = useMemo(() => {
    let r = all as Session[];
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x =>
        x.crdts.includes(t) ||
        (x.alias || nameOf.get(x.crdts) || "").toLowerCase().includes(t) ||
        (x.sessionType || "").toLowerCase().includes(t));
    }
    return [...r].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  }, [all, q, nameOf]);

  const n = (v: unknown) => Number(v || 0);
  const totalHrs = rows.reduce((s, r) => s + n(r.coachingHours), 0);
  const totalEgp = rows.reduce((s, r) => s + n(r.bonusAmount), 0);

  const byCat = useMemo(() => {
    const m = new Map<string, { n: number; hrs: number; egp: number }>();
    rows.forEach(r => {
      const k = categoryOf(r.sessionType);
      const c = m.get(k) || { n: 0, hrs: 0, egp: 0 };
      c.n++; c.hrs += n(r.coachingHours); c.egp += n(r.bonusAmount);
      m.set(k, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].egp - a[1].egp);
  }, [rows]);

  const byAgent = useMemo(() => {
    const m = new Map<string, { n: number; hrs: number; egp: number }>();
    rows.forEach(r => {
      const c = m.get(r.crdts) || { n: 0, hrs: 0, egp: 0 };
      c.n++; c.hrs += n(r.coachingHours); c.egp += n(r.bonusAmount);
      m.set(r.crdts, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n);
  }, [rows]);

  // Agents coached repeatedly this cycle — usually a sign of a deeper performance issue.
  const repeat = byAgent.filter(([, v]) => v.n >= 3);
  const unapproved = rows.filter(r => (r.status || "").toLowerCase() !== "approved").length;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" style={{ color: BRAND }} /> Coaching &amp; Sessions
        </h1>
        <p className="text-xs text-muted-foreground">
          Synced nightly from the Coaching sheet — coaching, system issues and dropped calls. Reference only; payroll is calculated separately.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded-md px-2 py-1.5 text-sm bg-background" value={cycle} onChange={e => setCycle(e.target.value)}>
          {cycles.map(c => <option key={c} value={c}>{mLabel(c)} cycle</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Agent, CRDTS or topic…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <S icon={<BookOpen className="w-4 h-4" />} label="Sessions" value={rows.length} />
        <S icon={<Users className="w-4 h-4" />} label="Agents" value={byAgent.length} />
        <S icon={<Clock className="w-4 h-4" />} label="Total hours" value={totalHrs.toFixed(2)} />
        <S icon={<TrendingUp className="w-4 h-4" />} label="Total EGP" value={totalEgp.toLocaleString()} green />
      </div>

      {unapproved > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{unapproved}</span> session{unapproved === 1 ? "" : "s"} not marked approved in the sheet yet.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm font-medium">No sessions in the {mLabel(cycle)} cycle.</p>
          <p className="text-xs text-muted-foreground mt-1">Data syncs nightly from the Coaching sheet.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">By type</p>
              <div className="space-y-2">
                {byCat.map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate" style={{ color: CAT_COLOR[c] }}>● {c}</span>
                    <div className="h-1.5 rounded-full bg-muted flex-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(v.egp / (totalEgp || 1)) * 100}%`, background: CAT_COLOR[c] }} />
                    </div>
                    <span className="text-muted-foreground w-8 text-right">{v.n}</span>
                    <span className="font-semibold text-emerald-600 w-20 text-right">{v.egp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">
                Most sessions {repeat.length > 0 && <span className="text-xs font-normal text-amber-600">· {repeat.length} coached 3+ times</span>}
              </p>
              <div className="space-y-1.5">
                {byAgent.slice(0, 8).map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{nameOf.get(c) || "—"} <span className="text-muted-foreground">· {c}</span></span>
                    <Badge variant={v.n >= 3 ? "destructive" : "outline"} className="text-[10px]">{v.n}</Badge>
                    <span className="text-muted-foreground w-12 text-right">{v.hrs.toFixed(2)}h</span>
                    <span className="font-semibold text-emerald-600 w-16 text-right">{v.egp.toLocaleString()}</span>
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
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Topic</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Notes</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Hrs</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">EGP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const cat = categoryOf(r.sessionType);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{r.sessionDate}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.alias || nameOf.get(r.crdts) || "—"}</span>
                          <span className="text-muted-foreground text-xs"> · {r.crdts}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs" style={{ color: CAT_COLOR[cat] }}>●</span> {r.sessionType || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate" title={r.notes || ""}>{r.notes || "—"}</td>
                        <td className="px-3 py-2 text-right">{n(r.coachingHours).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">{n(r.bonusAmount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
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
