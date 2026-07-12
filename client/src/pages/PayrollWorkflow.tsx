import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle, Clock, Gift, Check, X, ClipboardList } from "lucide-react";

const BRAND = "#FF6A13";
const APPROVERS = ["owner", "admin", "ops_manager", "hr"];

const BONUS_TYPES = [
  { v: "coaching", l: "Coaching" },
  { v: "team_support", l: "Team Support" },
  { v: "system_issues", l: "System Issues" },
  { v: "hr_meeting", l: "HR Meeting" },
  { v: "one_to_one", l: "One-to-One" },
  { v: "other", l: "Other" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

type Agent = { traineeCode: string; crdts: string | null; alias: string | null; fullName: string | null; agentStatus: string | null };

export default function PayrollWorkflow() {
  const { user } = useAuth();
  const role = String((user as { role?: string } | null)?.role || "");
  const canApprove = APPROVERS.includes(role);

  const [tab, setTab] = useState<"queue" | "adherence" | "ot" | "bonus">(canApprove ? "queue" : "adherence");

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5" style={{ color: BRAND }} /> Deductions, OT &amp; Bonuses
        </h1>
        <p className="text-xs text-muted-foreground">
          Log an item and it waits for approval. Once approved by Ops Manager / HR / Owner it lands on the agent's payslip.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {canApprove && <TabBtn active={tab === "queue"} onClick={() => setTab("queue")} icon={<Check className="w-3.5 h-3.5" />} label="Approvals" />}
        <TabBtn active={tab === "adherence"} onClick={() => setTab("adherence")} icon={<AlertCircle className="w-3.5 h-3.5" />} label="Adherence" />
        <TabBtn active={tab === "ot"} onClick={() => setTab("ot")} icon={<Clock className="w-3.5 h-3.5" />} label="Overtime" />
        <TabBtn active={tab === "bonus"} onClick={() => setTab("bonus")} icon={<Gift className="w-3.5 h-3.5" />} label="Bonuses" />
      </div>

      {tab === "queue" && <ApprovalQueue />}
      {tab === "adherence" && <AdherenceForm />}
      {tab === "ot" && <OTForm />}
      {tab === "bonus" && <BonusForm />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
        active ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
      style={active ? { background: BRAND } : undefined}>
      {icon} {label}
    </button>
  );
}

function useAgents() {
  const { data = [] } = trpc.workforce.list.useQuery({});
  return (data as Agent[]).filter(a => (a.agentStatus ?? "active") === "active");
}

function AgentPicker({ value, onChange }: { value: string; onChange: (crdts: string, a: Agent | null) => void }) {
  const agents = useAgents();
  return (
    <select className="border rounded-md px-2 py-2 text-sm bg-background w-full"
      value={value}
      onChange={(e) => {
        const a = agents.find(x => (x.crdts || x.traineeCode) === e.target.value) || null;
        onChange(e.target.value, a);
      }}>
      <option value="">Select agent…</option>
      {agents.map(a => (
        <option key={a.traineeCode} value={a.crdts || a.traineeCode}>
          {(a.alias || a.fullName || a.traineeCode)}{a.crdts ? ` · ${a.crdts}` : ""}
        </option>
      ))}
    </select>
  );
}

// ───────────────────────── ADHERENCE ─────────────────────────
function AdherenceForm() {
  const utils = trpc.useUtils();
  const { data: matrix = [] } = trpc.payrollWorkflow.listMatrix.useQuery();
  const types = useMemo(() => Array.from(new Set((matrix as { violationType: string }[]).map(m => m.violationType))), [matrix]);

  const [crdts, setCrdts] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [date, setDate] = useState(today());
  const [type, setType] = useState("");
  const [details, setDetails] = useState("");
  const [override, setOverride] = useState("");

  const month = date.slice(0, 7);
  const { data: next } = trpc.payrollWorkflow.nextOffense.useQuery(
    { crdts, violationType: type, month },
    { enabled: !!crdts && !!type },
  );

  const rule = next?.rule as { hours: string; egp: string; useHoursRate: boolean; penaltyLabel: string | null } | null | undefined;
  const suggestedHours = rule ? Number(rule.hours || 0) : 0;
  const effHours = override !== "" ? Number(override) : suggestedHours;
  const deduction = rule
    ? (rule.useHoursRate ? effHours * 75 : Number(rule.egp || 0))
    : effHours * 75;

  const log = trpc.payrollWorkflow.logAdherence.useMutation({
    onSuccess: () => {
      toast.success("Logged — waiting for approval");
      utils.payrollWorkflow.pending.invalidate();
      utils.payrollWorkflow.pendingCount.invalidate();
      setDetails(""); setOverride("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm font-semibold">Log an adherence / attendance violation</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><p className="text-xs text-muted-foreground mb-1">Agent</p>
          <AgentPicker value={crdts} onChange={(c, a) => { setCrdts(c); setAgent(a); }} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">Date</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">Violation type</p>
          <select className="border rounded-md px-2 py-2 text-sm bg-background w-full" value={type} onChange={e => { setType(e.target.value); setOverride(""); }}>
            <option value="">Select…</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {types.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No matrix rules yet — add them in Settings → Escalation Matrix.</p>}
        </div>
        <div><p className="text-xs text-muted-foreground mb-1">Override hours <span className="opacity-60">(optional)</span></p>
          <Input type="number" step="0.25" min="0" placeholder={suggestedHours ? String(suggestedHours) : "—"} value={override} onChange={e => setOverride(e.target.value)} /></div>
      </div>

      <div><p className="text-xs text-muted-foreground mb-1">Details — what happened</p>
        <Textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe the incident…" /></div>

      {crdts && type && (
        <div className="rounded-lg border p-3 text-sm flex flex-wrap gap-x-5 gap-y-1 bg-muted/40">
          <span>Offense this cycle: <b>#{next?.offenseNo ?? 1}</b></span>
          {rule?.penaltyLabel && <span>Penalty: <b>{rule.penaltyLabel}</b></span>}
          <span>Hours: <b>{effHours}</b>{override !== "" && <span className="text-amber-600"> (overridden)</span>}</span>
          <span>Deduction: <b>{deduction.toLocaleString()} EGP</b></span>
        </div>
      )}

      <Button
        disabled={!crdts || !type || log.isPending}
        onClick={() => log.mutate({
          crdts, agentCode: agent?.traineeCode, date, type, details,
          hours: suggestedHours,
          overrideHours: override !== "" ? Number(override) : undefined,
          deduction, offenseNo: next?.offenseNo,
        })}
        style={{ background: BRAND }} className="text-white">
        {log.isPending ? "Saving…" : "Log violation"}
      </Button>
    </CardContent></Card>
  );
}

// ───────────────────────── OT ─────────────────────────
function OTForm() {
  const utils = trpc.useUtils();
  const [crdts, setCrdts] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [date, setDate] = useState(today());
  const [otType, setOtType] = useState<"1.5x" | "2x" | "3x">("1.5x");
  const [hours, setHours] = useState("");
  const [details, setDetails] = useState("");

  const mult = otType === "1.5x" ? 1.5 : otType === "2x" ? 2 : 3;
  const egp = Math.round((Number(hours) || 0) * 75 * mult * 100) / 100;

  const log = trpc.payrollWorkflow.logOT.useMutation({
    onSuccess: () => {
      toast.success("OT logged — waiting for approval");
      utils.payrollWorkflow.pending.invalidate();
      utils.payrollWorkflow.pendingCount.invalidate();
      setHours(""); setDetails("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm font-semibold">Log overtime</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><p className="text-xs text-muted-foreground mb-1">Agent</p>
          <AgentPicker value={crdts} onChange={(c, a) => { setCrdts(c); setAgent(a); }} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">Date</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">OT type</p>
          <select className="border rounded-md px-2 py-2 text-sm bg-background w-full" value={otType} onChange={e => setOtType(e.target.value as "1.5x" | "2x" | "3x")}>
            <option value="1.5x">OT 1.5x — extra hours above threshold</option>
            <option value="2x">OT 2x — worked on a day off</option>
            <option value="3x">OT 3x — public holiday</option>
          </select></div>
        <div><p className="text-xs text-muted-foreground mb-1">Hours</p>
          <Input type="number" step="0.25" min="0" value={hours} onChange={e => setHours(e.target.value)} /></div>
      </div>
      <div><p className="text-xs text-muted-foreground mb-1">Details</p>
        <Textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder="Why was the OT worked?" /></div>

      {Number(hours) > 0 && (
        <div className="rounded-lg border p-3 text-sm bg-muted/40">
          {hours} hrs × 75 EGP × {mult} = <b>{egp.toLocaleString()} EGP</b>
        </div>
      )}

      <Button disabled={!crdts || !Number(hours) || log.isPending}
        onClick={() => log.mutate({ crdts, agentCode: agent?.traineeCode, alias: agent?.alias ?? undefined, date, otType, hours: Number(hours), egpAmount: egp, details })}
        style={{ background: BRAND }} className="text-white">
        {log.isPending ? "Saving…" : "Log overtime"}
      </Button>
    </CardContent></Card>
  );
}

// ───────────────────────── BONUS ─────────────────────────
function BonusForm() {
  const utils = trpc.useUtils();
  const [crdts, setCrdts] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [date, setDate] = useState(today());
  const [bonusType, setBonusType] = useState<typeof BONUS_TYPES[number]["v"]>("coaching");
  const [hours, setHours] = useState("");
  const [egp, setEgp] = useState("");
  const [details, setDetails] = useState("");

  const log = trpc.payrollWorkflow.logBonus.useMutation({
    onSuccess: () => {
      toast.success("Bonus logged — waiting for approval");
      utils.payrollWorkflow.pending.invalidate();
      utils.payrollWorkflow.pendingCount.invalidate();
      setEgp(""); setHours(""); setDetails("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm font-semibold">Log a bonus <span className="font-normal text-muted-foreground">— anything that adds money for the agent</span></p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><p className="text-xs text-muted-foreground mb-1">Agent</p>
          <AgentPicker value={crdts} onChange={(c, a) => { setCrdts(c); setAgent(a); }} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">Date</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">Bonus type</p>
          <select className="border rounded-md px-2 py-2 text-sm bg-background w-full" value={bonusType} onChange={e => setBonusType(e.target.value as typeof bonusType)}>
            {BONUS_TYPES.map(b => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select></div>
        <div><p className="text-xs text-muted-foreground mb-1">Hours <span className="opacity-60">(optional)</span></p>
          <Input type="number" step="0.25" min="0" value={hours}
            onChange={e => { setHours(e.target.value); if (e.target.value) setEgp(String(Math.round(Number(e.target.value) * 75 * 100) / 100)); }} />
          <p className="text-[11px] text-muted-foreground mt-0.5">Filling hours auto-calculates EGP at 75/hr.</p></div>
      </div>
      <div><p className="text-xs text-muted-foreground mb-1">Amount (EGP)</p>
        <Input type="number" step="1" min="0" value={egp} onChange={e => setEgp(e.target.value)} className="max-w-[200px]" /></div>
      <div><p className="text-xs text-muted-foreground mb-1">Details — the agent will see this</p>
        <Textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder="What is this bonus for?" /></div>

      <Button disabled={!crdts || !Number(egp) || log.isPending}
        onClick={() => log.mutate({ crdts, agentCode: agent?.traineeCode, alias: agent?.alias ?? undefined, date, bonusType, details, hours: hours ? Number(hours) : undefined, egp: Number(egp) })}
        style={{ background: BRAND }} className="text-white">
        {log.isPending ? "Saving…" : "Log bonus"}
      </Button>
    </CardContent></Card>
  );
}

// ───────────────────────── APPROVAL QUEUE ─────────────────────────
type PendingRow = {
  id: number; crdts: string; alias?: string | null; date: string;
  type?: string; details?: string | null; hours?: string | null;
  deduction?: string | null; egpAmount?: string | null; egp?: string | null;
  otType?: string; bonusType?: string; offenseNo?: number | null;
  overrideHours?: string | null; loggedBy?: string | null;
};

function ApprovalQueue() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.payrollWorkflow.pending.useQuery(undefined, { refetchInterval: 60000 });

  const decide = trpc.payrollWorkflow.decide.useMutation({
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approved" ? "Approved — added to the payslip" : "Rejected");
      utils.payrollWorkflow.pending.invalidate();
      utils.payrollWorkflow.pendingCount.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;
  const total = data?.total ?? 0;
  if (!total) return (
    <Card><CardContent className="p-8 text-center">
      <Check className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
      <p className="text-sm font-medium">Nothing waiting for approval.</p>
    </CardContent></Card>
  );

  const Section = ({ title, rows, kind, money, icon }: {
    title: string; rows: PendingRow[]; kind: "adherence" | "ot" | "bonus"; money: (r: PendingRow) => string; icon: React.ReactNode;
  }) => rows.length === 0 ? null : (
    <Card><CardContent className="p-4 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5">{icon} {title} ({rows.length})</p>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {r.alias || r.crdts} <span className="text-muted-foreground font-normal">· {r.crdts} · {r.date}</span>
              </p>
              <p className="text-sm mt-0.5">
                <b>{r.type || (r.otType ? `OT ${r.otType}` : "") || (r.bonusType ? BONUS_TYPES.find(b => b.v === r.bonusType)?.l : "")}</b>
                {r.offenseNo ? <Badge variant="outline" className="ml-1.5 text-[10px]">offense #{r.offenseNo}</Badge> : null}
                {r.overrideHours ? <Badge variant="outline" className="ml-1.5 text-[10px] text-amber-600 border-amber-300">override {r.overrideHours}h</Badge> : null}
                {r.hours ? <span className="text-muted-foreground"> · {Number(r.hours)}h</span> : null}
                <span className={kind === "adherence" ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}> · {money(r)}</span>
              </p>
              {r.details && <p className="text-xs text-muted-foreground mt-0.5">{r.details}</p>}
              {r.loggedBy && <p className="text-[11px] text-muted-foreground mt-0.5">Logged by {r.loggedBy}</p>}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ kind, id: r.id, decision: "rejected" })}>
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ kind, id: r.id, decision: "approved" })}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{total} item{total === 1 ? "" : "s"} waiting. Approving pushes the amount onto the agent's payslip.</p>
      <Section title="Adherence" kind="adherence" icon={<AlertCircle className="w-4 h-4 text-red-600" />}
        rows={(data?.adherence ?? []) as PendingRow[]} money={r => `-${Number(r.deduction || 0).toLocaleString()} EGP`} />
      <Section title="Overtime" kind="ot" icon={<Clock className="w-4 h-4 text-emerald-600" />}
        rows={(data?.ot ?? []) as PendingRow[]} money={r => `+${Number(r.egpAmount || 0).toLocaleString()} EGP`} />
      <Section title="Bonuses" kind="bonus" icon={<Gift className="w-4 h-4 text-emerald-600" />}
        rows={(data?.bonuses ?? []) as PendingRow[]} money={r => `+${Number(r.egp || 0).toLocaleString()} EGP`} />
    </div>
  );
}
