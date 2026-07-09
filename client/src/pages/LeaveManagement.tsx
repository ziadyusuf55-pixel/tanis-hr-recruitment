import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, Plus, Check, X } from "lucide-react";

const BRAND = "#FF6A13";

type LeaveReq = { id: number; traineeCode: string; startDate: string; endDate: string; days: number; reason: string | null; leaveType: "casual" | "annual" | null; status: string; createdAt: number };
type Bal = { id: number; traineeCode: string; casualTotal: number; annualTotal: number; casualUsed: number; annualUsed: number };
type Agent = { traineeCode: string; fullName: string | null; alias: string | null; agentStatus: string | null };

export default function LeaveManagement() {
  const utils = trpc.useUtils();
  const { data: requests = [] } = trpc.leave.listRequests.useQuery({});
  const { data: balances = [] } = trpc.leave.listBalances.useQuery({});
  const { data: agents = [] } = trpc.workforce.list.useQuery({});
  const reqs = requests as LeaveReq[];
  const bals = balances as Bal[];
  const ags = agents as Agent[];
  const agentName = (code: string) => { const a = ags.find(x => x.traineeCode === code); return a ? (a.alias || a.fullName || code) : code; };

  const [tab, setTab] = useState<"requests" | "balances">("requests");
  const pending = reqs.filter(r => r.status === "pending");
  const decided = reqs.filter(r => r.status !== "pending").slice(0, 30);

  // Per-request chosen type before approving
  const [types, setTypes] = useState<Record<number, "casual" | "annual">>({});
  const decide = trpc.leave.decide.useMutation({
    onSuccess: () => { utils.leave.listRequests.invalidate(); utils.leave.listBalances.invalidate(); toast.success("Decision saved"); },
    onError: (e) => toast.error(e.message),
  });

  // Mass add
  const [massOpen, setMassOpen] = useState(false);
  const [mass, setMass] = useState({ casual: "", annual: "" });
  const massAdd = trpc.leave.massAdd.useMutation({
    onSuccess: (r) => { toast.success(`Balances added — ${r.created} created, ${r.updated} updated`); setMassOpen(false); utils.leave.listBalances.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5" style={{ color: BRAND }} /> Leave Management</h1>
          <p className="text-xs text-muted-foreground">إجازة عارضة (casual) &amp; إجازة اعتيادية (annual) — agents request, HR classifies &amp; approves. Agents never see balances.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("requests")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "requests" ? "bg-foreground text-background" : "bg-background"}`}>Requests {pending.length > 0 && `(${pending.length})`}</button>
          <button onClick={() => setTab("balances")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "balances" ? "bg-foreground text-background" : "bg-background"}`}>Balances</button>
        </div>
      </div>

      {tab === "requests" && (
        <div className="space-y-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Agent</th><th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Days</th><th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Type (HR sets)</th><th className="px-3 py-2 font-medium text-right">Decision</th>
              </tr></thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{agentName(r.traineeCode)} <span className="text-xs text-muted-foreground">({r.traineeCode})</span></td>
                    <td className="px-3 py-2">{r.startDate} → {r.endDate}</td>
                    <td className="px-3 py-2">{r.days}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate">{r.reason || "—"}</td>
                    <td className="px-3 py-2">
                      <select className="border rounded px-1.5 py-1 text-xs bg-background" value={types[r.id] ?? ""} onChange={e => setTypes({ ...types, [r.id]: e.target.value as "casual" | "annual" })}>
                        <option value="">Pick…</option>
                        <option value="casual">عارضة (Casual)</option>
                        <option value="annual">اعتيادية (Annual)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                      <Button size="sm" className="text-white h-7" style={{ background: "#059669" }}
                        onClick={() => { const t = types[r.id]; if (!t) return toast.error("Pick the leave type first"); decide.mutate({ id: r.id, status: "approved", leaveType: t }); }}
                        disabled={decide.isPending}><Check className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200"
                        onClick={() => decide.mutate({ id: r.id, status: "rejected" })} disabled={decide.isPending}><X className="w-3.5 h-3.5" /></Button>
                    </td>
                  </tr>
                ))}
                {pending.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No pending requests. 🎉</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>

          {decided.length > 0 && (
            <Card><CardContent className="p-4">
              <p className="text-sm font-semibold mb-2">Recent decisions</p>
              <div className="space-y-1">
                {decided.map(r => (
                  <p key={r.id} className="text-xs flex items-center gap-2">
                    <Badge variant={r.status === "approved" ? "outline" : "destructive"} className="capitalize text-[10px]">{r.status}</Badge>
                    <span className="font-medium">{agentName(r.traineeCode)}</span> {r.startDate} → {r.endDate} ({r.days}d)
                    {r.leaveType && <span className="text-muted-foreground">· {r.leaveType === "casual" ? "عارضة" : "اعتيادية"}</span>}
                  </p>
                ))}
              </div>
            </CardContent></Card>
          )}
        </div>
      )}

      {tab === "balances" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setMassOpen(true)} style={{ background: BRAND }} className="text-white"><Plus className="w-4 h-4 mr-1" /> Mass add balances</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">عارضة — الرصيد</th><th className="px-3 py-2 font-medium">المستخدم</th><th className="px-3 py-2 font-medium">المتبقي</th>
                <th className="px-3 py-2 font-medium">اعتيادية — الرصيد</th><th className="px-3 py-2 font-medium">المستخدم</th><th className="px-3 py-2 font-medium">المتبقي</th>
              </tr></thead>
              <tbody>
                {bals.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{agentName(b.traineeCode)} <span className="text-xs text-muted-foreground">({b.traineeCode})</span></td>
                    <td className="px-3 py-2">{b.casualTotal}</td><td className="px-3 py-2">{b.casualUsed}</td>
                    <td className="px-3 py-2 font-semibold">{Math.max(0, b.casualTotal - b.casualUsed)}</td>
                    <td className="px-3 py-2">{b.annualTotal}</td><td className="px-3 py-2">{b.annualUsed}</td>
                    <td className="px-3 py-2 font-semibold">{Math.max(0, b.annualTotal - b.annualUsed)}</td>
                  </tr>
                ))}
                {bals.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No balances yet — use "Mass add balances" to set the year's allowance for all agents.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </div>
      )}

      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mass add leave balances ({new Date().getFullYear()})</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Adds days on top of every active agent's current totals (former agents excluded).</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium block mb-1">عارضة (Casual) days</label><Input type="number" min={0} value={mass.casual} onChange={e => setMass({ ...mass, casual: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">اعتيادية (Annual) days</label><Input type="number" min={0} value={mass.annual} onChange={e => setMass({ ...mass, annual: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassOpen(false)}>Cancel</Button>
            <Button onClick={() => { const c = Number(mass.casual || 0), a = Number(mass.annual || 0); if (c <= 0 && a <= 0) return toast.error("Enter at least one number"); massAdd.mutate({ casual: c, annual: a }); }} disabled={massAdd.isPending} style={{ background: BRAND }} className="text-white">{massAdd.isPending ? "Adding…" : "Add to all agents"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
