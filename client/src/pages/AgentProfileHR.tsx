import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserCog, Phone, MapPin, Star, AlertCircle, BookOpen, CalendarDays, LogOut, Save } from "lucide-react";

const BRAND = "#FF6A13";

type Agent = {
  id: number; traineeCode: string; fullName: string | null; alias: string | null; crdts: string | null;
  agentStatus: string | null; campaignName?: string | null; teamLeader?: string | null; shiftHours?: string | null;
  phone?: string | null; email?: string | null; address?: string | null;
  emergencyContactName?: string | null; emergencyContactPhone?: string | null; emergencyContactRelation?: string | null;
  salarySettled?: boolean | null;
};

type Viol = { id: number; type?: string | null; date?: unknown; deduction?: string | number | null; hours?: string | number | null; status?: string | null };

export default function AgentProfileHR() {
  const { data: agents = [] } = trpc.workforce.list.useQuery({});
  const list = agents as Agent[];
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(a => [a.fullName, a.alias, a.traineeCode, a.crdts].some(v => (v || "").toLowerCase().includes(q)));
  }, [list, search]);
  const agent = list.find(a => a.traineeCode === selectedCode) || null;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><UserCog className="w-5 h-5" style={{ color: BRAND }} /> Agent Profiles</h1>
        <p className="text-xs text-muted-foreground">Everything about an agent in one place — personal info, leave, quality, adherence, coaching, exit.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search name / alias / code / CRDTS…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <select className="border rounded-md px-2 py-2 text-sm bg-background min-w-[220px]" value={selectedCode} onChange={e => setSelectedCode(e.target.value)}>
          <option value="">Select an agent…</option>
          {filtered.map(a => (
            <option key={a.traineeCode} value={a.traineeCode}>
              {(a.alias || a.fullName || a.traineeCode)}{a.crdts ? ` · ${a.crdts}` : ""}{a.agentStatus && a.agentStatus !== "active" ? ` · ${a.agentStatus}` : ""}
            </option>
          ))}
        </select>
      </div>

      {!agent ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Pick an agent to open their full profile.</p>
      ) : (
        <Profile agent={agent} />
      )}
    </div>
  );
}

function Profile({ agent }: { agent: Agent }) {
  const utils = trpc.useUtils();
  const crdts = agent.crdts || "";
  const code = agent.traineeCode;

  // Deductions live in agent_violations (the payslip source), keyed by CRDTS, split by category.
  // Pass both identifiers — violations may be stored under CRDTS or traineeCode.
  const vKey = { crdts: crdts || undefined, agentCode: code || undefined };
  const { data: adherence = [] } = trpc.violations.list.useQuery({ ...vKey, category: "attendance" });
  const { data: quality = [] } = trpc.violations.list.useQuery({ ...vKey, category: "quality" });
  const { data: coaching = [] } = trpc.coaching.listByCrdts.useQuery({ crdts }, { enabled: !!crdts });
  const { data: balances = [] } = trpc.leave.listBalances.useQuery({});
  const { data: leaveReqs = [] } = trpc.leave.myRequests.useQuery({ traineeCode: code });
  const { data: exitData } = trpc.exit.get.useQuery({ traineeCode: code });

  const bal = (balances as { traineeCode: string; casualTotal: number; annualTotal: number; casualUsed: number; annualUsed: number }[]).find(b => b.traineeCode === code);

  // Editable HR info
  const [hr, setHr] = useState({ address: agent.address ?? "", emergencyContactName: agent.emergencyContactName ?? "", emergencyContactPhone: agent.emergencyContactPhone ?? "", emergencyContactRelation: agent.emergencyContactRelation ?? "" });
  const saveHr = trpc.workforce.updateHrInfo.useMutation({
    onSuccess: () => { toast.success("HR info saved"); utils.workforce.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const isFormer = ["resigned", "terminated", "blacklisted"].includes(agent.agentStatus || "");
  const fmt = (t: unknown) => { const d = new Date(String(t)); return isNaN(d.getTime()) ? String(t ?? "") : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }); };
  const vSum = (arr: Viol[], k: "deduction" | "hours") => arr.reduce((s, r) => s + Number(r[k] || 0), 0);
  const vTitle = (label: string, arr: unknown[]) => { const a = arr as Viol[]; const egp = vSum(a, "deduction"); const hrs = vSum(a, "hours"); const bits = [String(a.length)]; if (egp) bits.push(`${egp.toLocaleString()} EGP`); if (hrs) bits.push(`${hrs}h`); return `${label} (${bits.join(" · ")})`; };
  const vSub = (v: Viol) => { const parts = [fmt(v.date)]; if (Number(v.deduction)) parts.push(`${Number(v.deduction).toLocaleString()} EGP`); if (Number(v.hours)) parts.push(`${v.hours}h`); return parts.filter(Boolean).join(" · "); };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{agent.fullName || agent.alias || code}
            {agent.alias && agent.fullName && <span className="text-muted-foreground font-normal"> · {agent.alias}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{code}{crdts ? ` · CRDTS ${crdts}` : ""}{agent.campaignName ? ` · ${agent.campaignName}` : ""}{agent.teamLeader ? ` · TL: ${agent.teamLeader}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isFormer ? "destructive" : "outline"} className="capitalize">{agent.agentStatus || "active"}</Badge>
          {isFormer && <Badge variant={agent.salarySettled ? "outline" : "destructive"}>{agent.salarySettled ? "settled" : "pending payout"}</Badge>}
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal / HR info */}
        <Card><CardContent className="p-4 space-y-2.5">
          <p className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4" style={{ color: BRAND }} /> Personal &amp; emergency (جهة اتصال للطوارئ)</p>
          <div className="space-y-2">
            <Input placeholder="Address / العنوان" value={hr.address} onChange={e => setHr({ ...hr, address: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Emergency name" value={hr.emergencyContactName} onChange={e => setHr({ ...hr, emergencyContactName: e.target.value })} />
              <Input placeholder="Phone" value={hr.emergencyContactPhone} onChange={e => setHr({ ...hr, emergencyContactPhone: e.target.value })} />
              <Input placeholder="صلة القرابة" value={hr.emergencyContactRelation} onChange={e => setHr({ ...hr, emergencyContactRelation: e.target.value })} />
            </div>
            <Button size="sm" onClick={() => saveHr.mutate({ traineeCode: code, ...hr })} disabled={saveHr.isPending} style={{ background: BRAND }} className="text-white">
              <Save className="w-3.5 h-3.5 mr-1" /> {saveHr.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent></Card>

        {/* Leave */}
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><CalendarDays className="w-4 h-4" style={{ color: BRAND }} /> Leave — {new Date().getFullYear()}</p>
          {bal ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">إجازة عارضة (Casual)</p>
                <p className="font-bold">{bal.casualUsed} / {bal.casualTotal} <span className="text-xs font-normal text-muted-foreground">used · {Math.max(0, bal.casualTotal - bal.casualUsed)} left</span></p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">إجازة اعتيادية (Annual)</p>
                <p className="font-bold">{bal.annualUsed} / {bal.annualTotal} <span className="text-xs font-normal text-muted-foreground">used · {Math.max(0, bal.annualTotal - bal.annualUsed)} left</span></p>
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">No balance set for this year (use Leave Management → mass add).</p>}
          {(leaveReqs as { id: number; startDate: string; endDate: string; days: number; status: string; leaveType: string | null }[]).slice(0, 5).map(r => (
            <p key={r.id} className="text-xs flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
              {r.startDate} → {r.endDate} ({r.days}d){r.leaveType ? ` · ${r.leaveType === "casual" ? "عارضة" : "اعتيادية"}` : ""}
            </p>
          ))}
        </CardContent></Card>
      </div>

      {/* Exit status (if former or in progress) */}
      {(isFormer || exitData) && (
        <Card><CardContent className="p-4 space-y-1.5">
          <p className="text-sm font-semibold flex items-center gap-1.5"><LogOut className="w-4 h-4" style={{ color: BRAND }} /> Exit process</p>
          {exitData ? (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">{exitData.exitType === "resignation" ? "استقالة" : exitData.exitType === "termination" ? "فصل" : exitData.exitType === "contract_end" ? "انتهاء عقد" : "type not set"}</Badge>
              <Badge variant={exitData.exitInterview ? "outline" : "destructive"}>Exit interview {exitData.exitInterview ? "✓" : "✗"}</Badge>
              <Badge variant={exitData.clearance ? "outline" : "destructive"}>Clearance {exitData.clearance ? "✓" : "✗"}</Badge>
              <Badge variant={exitData.assetsReturned ? "outline" : "destructive"}>استلام العهد {exitData.assetsReturned ? "✓" : "✗"}</Badge>
              <Badge variant={exitData.lastWorkingDay ? "outline" : "destructive"}>آخر يوم عمل {exitData.lastWorkingDay || "—"}</Badge>
              <Badge variant={exitData.settlementDone ? "outline" : "destructive"}>Settlement {exitData.settlementDone ? "✓" : "✗"}</Badge>
              {exitData.completedAt && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">Archived ✓</Badge>}
            </div>
          ) : <p className="text-xs text-muted-foreground">No exit process started (manage it from Operations → edit agent).</p>}
        </CardContent></Card>
      )}

      {/* Quality / Adherence / Coaching mirrors — from agent_violations (payslip) by CRDTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MirrorCard icon={<Star className="w-4 h-4" style={{ color: BRAND }} />} title={vTitle("Quality", quality)}
          rows={(quality as Viol[]).map(v => ({ id: v.id, main: v.type || "—", sub: vSub(v) }))} />
        <MirrorCard icon={<AlertCircle className="w-4 h-4" style={{ color: BRAND }} />} title={vTitle("Adherence", adherence)}
          rows={(adherence as Viol[]).map(v => ({ id: v.id, main: v.type || "—", sub: vSub(v) }))} />
        <MirrorCard icon={<BookOpen className="w-4 h-4" style={{ color: BRAND }} />} title={`Coaching (${(coaching as unknown[]).length})`}
          rows={(coaching as { id: number; sessionDate?: unknown; date?: unknown; topic?: string | null; notes?: string | null; coachName?: string | null }[]).map(cr => ({ id: cr.id, main: cr.topic || cr.notes || "—", sub: `${fmt(cr.sessionDate ?? cr.date)}${cr.coachName ? ` · ${cr.coachName}` : ""}` }))} />
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Performance charts live in HR → Performance (same CRDTS).</p>
    </div>
  );
}

function MirrorCard({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: { id: number; main: string; sub: string }[] }) {
  return (
    <Card><CardContent className="p-4 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5">{icon} {title}</p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Nothing logged.</p>}
        {rows.map(r => (
          <div key={r.id} className="text-xs border-l-2 pl-2 py-0.5" style={{ borderColor: "#FF6A1366" }}>
            <p>{r.main}</p>
            <p className="text-[10px] text-muted-foreground">{r.sub}</p>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}
