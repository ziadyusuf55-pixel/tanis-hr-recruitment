// Advances.tsx — HR view for salary advances (سلفة)
// Agents who borrow money from the company; deducted from payroll.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PlusCircle, Wallet, CheckCircle2, XCircle } from "lucide-react";

type Advance = {
  id: number;
  traineeCode: string;
  amountEgp: string;
  issuedDate: string;
  reason: string | null;
  status: "pending" | "deducted" | "cancelled";
  deductCycle: string | null;
  deductedAt: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: number;
  alias: string | null;
  fullName: string | null;
};

function statusBadge(status: Advance["status"]) {
  if (status === "pending")  return <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">Pending</Badge>;
  if (status === "deducted") return <Badge variant="outline" className="text-emerald-700 border-emerald-400 bg-emerald-50">Deducted</Badge>;
  return <Badge variant="outline" className="text-slate-500 border-slate-300">Cancelled</Badge>;
}

function agentName(a: Advance) {
  return a.fullName ?? a.alias ?? a.traineeCode;
}

export default function Advances() {
  const utils = trpc.useUtils();
  const { data: advances = [], isLoading } = trpc.advances.list.useQuery({});

  // ── Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showDeduct, setShowDeduct] = useState<Advance | null>(null);

  // ── Create form state
  const [form, setForm] = useState({
    traineeCode: "", amountEgp: "", issuedDate: "", reason: "", deductCycle: "", notes: "",
  });

  // ── Mutations
  const createMut = trpc.advances.create.useMutation({
    onSuccess: () => {
      utils.advances.list.invalidate();
      setShowCreate(false);
      setForm({ traineeCode: "", amountEgp: "", issuedDate: "", reason: "", deductCycle: "", notes: "" });
      toast.success("Advance recorded");
    },
    onError: (e) => toast.error(e.message),
  });

  const deductMut = trpc.advances.deduct.useMutation({
    onSuccess: () => {
      utils.advances.list.invalidate();
      setShowDeduct(null);
      toast.success("Advance marked as deducted");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMut = trpc.advances.cancel.useMutation({
    onSuccess: () => { utils.advances.list.invalidate(); toast.success("Advance cancelled"); },
    onError: (e) => toast.error(e.message),
  });

  const [deductCycle, setDeductCycle] = useState("");

  const pending   = (advances as Advance[]).filter(a => a.status === "pending");
  const resolved  = (advances as Advance[]).filter(a => a.status !== "pending");

  const totalPending = pending.reduce((s, a) => s + parseFloat(a.amountEgp), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-orange-500" /> Salary Advances <span className="text-base font-normal text-muted-foreground">(سلفة)</span>
          </h1>
          {pending.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {pending.length} pending · <span className="font-medium text-amber-700">{totalPending.toLocaleString()} EGP</span> outstanding
            </p>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <PlusCircle className="w-4 h-4" /> New Advance
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Pending Deduction</h2>
          <div className="rounded-xl border divide-y">
            {pending.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{agentName(a)}</p>
                  <p className="text-xs text-muted-foreground">{a.traineeCode} · {a.issuedDate}</p>
                  {a.reason && <p className="text-xs text-muted-foreground italic truncate max-w-xs">{a.reason}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-semibold text-amber-700">{parseFloat(a.amountEgp).toLocaleString()} EGP</span>
                  {statusBadge(a.status)}
                  <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-400 hover:bg-emerald-50 gap-1"
                    onClick={() => { setDeductCycle(""); setShowDeduct(a); }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Deduct
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                    onClick={() => { if (confirm(`Cancel advance of ${parseFloat(a.amountEgp).toLocaleString()} EGP for ${agentName(a)}?`)) cancelMut.mutate({ id: a.id }); }}>
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">History</h2>
          <div className="rounded-xl border divide-y">
            {resolved.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 opacity-75">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{agentName(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.traineeCode} · {a.issuedDate}
                    {a.deductCycle && <> · deducted from <span className="font-medium">{a.deductCycle}</span></>}
                  </p>
                  {a.reason && <p className="text-xs text-muted-foreground italic truncate max-w-xs">{a.reason}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-muted-foreground">{parseFloat(a.amountEgp).toLocaleString()} EGP</span>
                  {statusBadge(a.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && (advances as Advance[]).length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">No salary advances recorded yet.</p>
      )}

      {/* ── Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Salary Advance</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Agent Trainee Code *</label>
              <Input placeholder="e.g. TC-0123" value={form.traineeCode}
                onChange={e => setForm(f => ({ ...f, traineeCode: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Amount (EGP) *</label>
              <Input type="number" min="1" step="0.01" placeholder="e.g. 3000" value={form.amountEgp}
                onChange={e => setForm(f => ({ ...f, amountEgp: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date Issued *</label>
              <Input type="date" value={form.issuedDate}
                onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Reason</label>
              <Input placeholder="Optional" value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Deduct from Pay Cycle (YYYY-MM)</label>
              <Input placeholder="e.g. 2026-10" value={form.deductCycle}
                onChange={e => setForm(f => ({ ...f, deductCycle: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
              <Textarea rows={2} placeholder="Optional" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!form.traineeCode || !form.amountEgp || !form.issuedDate || createMut.isPending}
              onClick={() => createMut.mutate({
                traineeCode: form.traineeCode.trim(),
                amountEgp:   form.amountEgp,
                issuedDate:  form.issuedDate,
                reason:      form.reason || null,
                deductCycle: form.deductCycle || null,
                notes:       form.notes || null,
              })}>
              {createMut.isPending ? "Saving…" : "Save Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deduct modal */}
      {showDeduct && (
        <Dialog open onOpenChange={() => setShowDeduct(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark as Deducted</DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-3">
              <p className="text-sm">
                Confirm deduction of <span className="font-semibold">{parseFloat(showDeduct.amountEgp).toLocaleString()} EGP</span> from <span className="font-semibold">{agentName(showDeduct)}</span>'s salary.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Pay Cycle (YYYY-MM) *</label>
                <Input placeholder="e.g. 2026-10" value={deductCycle}
                  onChange={e => setDeductCycle(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeduct(null)}>Cancel</Button>
              <Button
                disabled={!/^\d{4}-\d{2}$/.test(deductCycle) || deductMut.isPending}
                onClick={() => deductMut.mutate({ id: showDeduct.id, deductCycle })}>
                {deductMut.isPending ? "Saving…" : "Confirm Deduction"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
