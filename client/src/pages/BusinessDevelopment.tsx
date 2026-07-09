import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LayoutGrid, Table2, Plus, Users, Trash2, Building2, Clock, Bell, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const BRAND = "#FF6A13";

const STAGES = [
  { key: "follow_up", label: "Follow Up", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "negotiations", label: "Negotiations", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "review", label: "Review", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "partners_consultants", label: "Partners & Consultants", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "closed_won", label: "Closed Won", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "closed_lost", label: "Closed Lost", color: "bg-red-100 text-red-700 border-red-200" },
] as const;
type StageKey = typeof STAGES[number]["key"];

type BdUser = { id: number; name: string; role: string };
type Contact = { id: number; company: string; contactName: string | null; email: string | null; phone: string | null };
type Deal = {
  id: number; title: string; ownerId: number; contactId: number | null; stage: StageKey;
  serviceType: string | null; seats: number | null; value: string | null; notes: string | null; expectedCloseDate: string | null;
  createdAt: number; lastContactedAt: number | null; reminderDate: string | null; reminderNote: string | null; outcomeReason: string | null; stageChangedAt: number | null;
};
const COLD_DAYS = 7;

export default function BusinessDevelopment() {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.bd.listUsers.useQuery();
  const bdUsers = users as BdUser[];
  const { data: me } = trpc.bd.me.useQuery();
  const isBdUser = me?.kind === "bd";
  const myBdId = isBdUser && me && "bdUser" in me ? (me.bdUser as BdUser).id : null;
  const [ownerId, setOwnerId] = useState<number | "all">("all");
  const [dragId, setDragId] = useState<number | null>(null);
  // BD-role users are locked to their own pipeline
  useEffect(() => { if (myBdId && ownerId !== myBdId) setOwnerId(myBdId); }, [myBdId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<"board" | "table">("board");
  const [tab, setTab] = useState<"pipeline" | "contacts">("pipeline");

  const { data: deals = [], isLoading } = trpc.bd.listDeals.useQuery(
    ownerId === "all" ? {} : { ownerId }
  );
  const { data: contacts = [] } = trpc.bd.listContacts.useQuery();
  const typedDeals = deals as Deal[];
  const typedContacts = contacts as Contact[];

  const seedUsers = trpc.bd.seedUsers.useMutation({
    onSuccess: () => { utils.bd.listUsers.invalidate(); toast.success("BD team ready"); },
    onError: (e) => toast.error(e.message),
  });
  const moveStage = trpc.bd.moveStage.useMutation({
    onSuccess: () => utils.bd.listDeals.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteDeal = trpc.bd.deleteDeal.useMutation({
    onSuccess: () => { utils.bd.listDeals.invalidate(); toast.success("Deal deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const ownerName = (id: number) => bdUsers.find(u => u.id === id)?.name ?? "—";
  const contactCompany = (id: number | null) => id ? (typedContacts.find(c => c.id === id)?.company ?? "") : "";

  const [openDeal, setOpenDeal] = useState<Deal | null>(null);
  const isCold = (d: Deal) => {
    if (d.stage === "closed_won" || d.stage === "closed_lost") return false;
    const ref = d.lastContactedAt ?? d.createdAt ?? 0;
    return ref > 0 && (Date.now() - ref) > COLD_DAYS * 86400000;
  };
  const daysInStage = (d: Deal) => Math.floor((Date.now() - (d.stageChangedAt ?? d.createdAt ?? Date.now())) / 86400000);
  const reminderOverdue = (d: Deal) => d.reminderDate ? new Date(d.reminderDate + "T23:59:59").getTime() < Date.now() : false;
  const todayISO = new Date().toISOString().slice(0, 10);
  const dueReminders = typedDeals
    .filter(d => d.reminderDate && d.stage !== "closed_won" && d.stage !== "closed_lost" && d.reminderDate <= todayISO)
    .sort((a, b) => (a.reminderDate! < b.reminderDate! ? -1 : 1));
  const handleStage = (d: Deal, stage: StageKey) => {
    if ((stage === "closed_won" || stage === "closed_lost") && stage !== d.stage) {
      const reason = window.prompt(stage === "closed_won" ? "Nice! Why did this one close? (optional)" : "What was the reason it was lost? (optional)") ?? undefined;
      moveStage.mutate({ id: d.id, stage, reason });
    } else {
      moveStage.mutate({ id: d.id, stage });
    }
  };

  const byStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    STAGES.forEach(s => (m[s.key] = []));
    typedDeals.forEach(d => { (m[d.stage] ?? (m[d.stage] = [])).push(d); });
    return m;
  }, [typedDeals]);

  // First-run: no BD users yet
  if (bdUsers.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">Business Development</h1>
        <p className="text-sm text-muted-foreground">Set up your BD team (Ziad, Malak, Ali) to start building pipelines. Contacts are shared; each person gets their own pipeline.</p>
        <Button onClick={() => seedUsers.mutate()} disabled={seedUsers.isPending} style={{ background: BRAND }} className="text-white">
          {seedUsers.isPending ? "Setting up…" : "Set up BD team"}
        </Button>
      </div>
    );
  }

  if (me?.kind === "unlinked") {
    return <ClaimLogin candidates={("candidates" in me ? me.candidates : []) as BdUser[]} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="w-5 h-5" style={{ color: BRAND }} /> Business Development</h1>
          <p className="text-xs text-muted-foreground">Pipeline &amp; shared contacts — call-center service sales</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab("pipeline")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "pipeline" ? "bg-foreground text-background" : "bg-background"}`}>Pipeline</button>
          <button onClick={() => setTab("contacts")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "contacts" ? "bg-foreground text-background" : "bg-background"}`}>Contacts</button>
        </div>
      </div>

      {tab === "pipeline" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Owner filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isBdUser && <button onClick={() => setOwnerId("all")} className={`text-xs px-2.5 py-1 rounded-full border ${ownerId === "all" ? "text-white" : "bg-background"}`} style={ownerId === "all" ? { background: BRAND } : {}}>All</button>}
              {(isBdUser ? bdUsers.filter(u => u.id === myBdId) : bdUsers).map(u => (
                <button key={u.id} onClick={() => setOwnerId(u.id)} className={`text-xs px-2.5 py-1 rounded-full border ${ownerId === u.id ? "text-white" : "bg-background"}`} style={ownerId === u.id ? { background: BRAND } : {}}>{u.name}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border overflow-hidden">
                <button onClick={() => setView("board")} className={`px-2.5 py-1.5 ${view === "board" ? "bg-muted" : ""}`} title="Board"><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setView("table")} className={`px-2.5 py-1.5 ${view === "table" ? "bg-muted" : ""}`} title="Table"><Table2 className="w-4 h-4" /></button>
              </div>
              <AddDealDialog bdUsers={bdUsers} contacts={typedContacts} defaultOwner={ownerId === "all" ? bdUsers[0]?.id : ownerId} onDone={() => utils.bd.listDeals.invalidate()} />
            </div>
          </div>

          {dueReminders.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Follow-ups due ({dueReminders.length})</p>
              <div className="space-y-1.5">
                {dueReminders.map(d => (
                  <button key={d.id} onClick={() => setOpenDeal(d)} className="w-full text-left flex items-center justify-between gap-2 rounded-lg bg-background border px-2.5 py-1.5 hover:bg-muted/50">
                    <span className="text-sm">
                      <span className="font-medium">{d.title}</span>
                      {contactCompany(d.contactId) && <span className="text-muted-foreground"> · {contactCompany(d.contactId)}</span>}
                      {d.reminderNote && <span className="text-muted-foreground"> — {d.reminderNote}</span>}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{ownerName(d.ownerId)}</Badge>
                      <span className={`text-[10px] ${reminderOverdue(d) ? "text-red-600 font-semibold" : "text-amber-700"}`}>{reminderOverdue(d) ? "overdue" : "today"} · {d.reminderDate}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading pipeline…</p>
          ) : view === "board" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {STAGES.map(s => (
                <div key={s.key} className="rounded-xl border bg-muted/30 p-2 min-h-[120px]"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragId != null) { const d = typedDeals.find(x => x.id === dragId); if (d && d.stage !== s.key) handleStage(d, s.key); setDragId(null); } }}>
                  <div className="flex items-center justify-between px-1 py-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{byStage[s.key]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(byStage[s.key] ?? []).map(d => (
                      <Card key={d.id} className={`border cursor-grab active:cursor-grabbing ${dragId === d.id ? "opacity-50" : ""}`} draggable
                        onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)}>
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => setOpenDeal(d)} className="text-sm font-semibold leading-tight text-left hover:underline">{d.title}</button>
                            <button onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          {contactCompany(d.contactId) && <p className="text-xs text-muted-foreground">{contactCompany(d.contactId)}</p>}
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            {d.value && <span className="font-semibold text-emerald-700">${d.value}</span>}
                            {d.seats != null && <span className="text-muted-foreground">{d.seats} seats</span>}
                            {d.serviceType && <span className="text-muted-foreground">· {d.serviceType}</span>}
                          </div>
                          {(isCold(d) || d.reminderDate) && (
                            <div className="flex flex-wrap gap-1.5">
                              {isCold(d) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> going cold</span>}
                              {d.reminderDate && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${reminderOverdue(d) ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}><Bell className="w-2.5 h-2.5" /> {d.reminderDate}</span>}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">{ownerName(d.ownerId)}</Badge>
                              <span className="text-[10px] text-muted-foreground">{daysInStage(d)}d in stage</span>
                            </span>
                            <select
                              value={d.stage}
                              onChange={(e) => handleStage(d, e.target.value as StageKey)}
                              className="text-[11px] border rounded px-1 py-0.5 bg-background"
                            >
                              {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                            </select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {(byStage[s.key] ?? []).length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Empty</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Deal</th><th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Owner</th><th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium text-right">Value</th><th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {typedDeals.map(d => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        <button onClick={() => setOpenDeal(d)} className="hover:underline text-left">{d.title}</button>
                        {isCold(d) && <span className="ml-1.5 text-[10px] text-amber-700">● cold</span>}
                        {d.reminderDate && <span className={`ml-1.5 text-[10px] ${reminderOverdue(d) ? "text-red-600" : "text-blue-600"}`}>⏰ {d.reminderDate}</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{contactCompany(d.contactId) || "—"}</td>
                      <td className="px-3 py-2">{ownerName(d.ownerId)}</td>
                      <td className="px-3 py-2">
                        <select value={d.stage} onChange={(e) => handleStage(d, e.target.value as StageKey)} className="text-xs border rounded px-1 py-0.5 bg-background">
                          {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">{d.value ? `$${d.value}` : "—"}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                  {typedDeals.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No deals yet.</td></tr>}
                </tbody>
              </table>
            </CardContent></Card>
          )}
        </>
      )}

      {tab === "contacts" && <ContactsPanel contacts={typedContacts} bdUsers={bdUsers} onDone={() => utils.bd.listContacts.invalidate()} />}

      {openDeal && (
        <DealDrawer
          deal={openDeal}
          company={contactCompany(openDeal.contactId)}
          ownerName={ownerName(openDeal.ownerId)}
          onClose={() => setOpenDeal(null)}
          onChanged={() => utils.bd.listDeals.invalidate()}
        />
      )}
    </div>
  );
}

// ── Deal detail drawer: activity log + reminder + outcome ──
function DealDrawer({ deal, company, ownerName, onClose, onChanged }: { deal: Deal; company: string; ownerName: string; onClose: () => void; onChanged: () => void }) {
  const utils = trpc.useUtils();
  const { data: activity = [] } = trpc.bd.listActivity.useQuery({ dealId: deal.id });
  const acts = activity as { id: number; note: string; createdAt: number }[];
  const [note, setNote] = useState("");
  const [rDate, setRDate] = useState(deal.reminderDate ?? "");
  const [rNote, setRNote] = useState(deal.reminderNote ?? "");

  const addActivity = trpc.bd.addActivity.useMutation({
    onSuccess: () => { setNote(""); utils.bd.listActivity.invalidate({ dealId: deal.id }); onChanged(); toast.success("Logged"); },
    onError: (e) => toast.error(e.message),
  });
  const setReminder = trpc.bd.setReminder.useMutation({
    onSuccess: () => { onChanged(); toast.success("Reminder saved"); },
    onError: (e) => toast.error(e.message),
  });
  const fmt = (t: number) => new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const stageLabel = STAGES.find(s => s.key === deal.stage)?.label ?? deal.stage;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">{company || "—"} · {ownerName} · {stageLabel}{deal.value ? ` · $${deal.value}` : ""}</p>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {deal.outcomeReason && (
            <div className="rounded-lg border p-2.5 text-xs bg-muted/40">
              <span className="font-semibold">Outcome:</span> {deal.outcomeReason}
            </div>
          )}

          {/* Reminder */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Follow-up reminder</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={rDate} onChange={e => setRDate(e.target.value)} />
              <Input placeholder="e.g. call back re: pricing" value={rNote} onChange={e => setRNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setReminder.mutate({ id: deal.id, reminderDate: rDate || undefined, reminderNote: rNote || undefined })} disabled={setReminder.isPending} style={{ background: BRAND }} className="text-white">Save reminder</Button>
              {deal.reminderDate && <Button size="sm" variant="outline" onClick={() => { setRDate(""); setRNote(""); setReminder.mutate({ id: deal.id }); }}>Clear</Button>}
            </div>
          </div>

          {/* Tasks */}
          <DealTasks dealId={deal.id} />

          {/* Activity log */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Activity log</p>
            <div className="flex gap-2">
              <Input placeholder="Left VM / sent proposal / spoke to…" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && note.trim()) addActivity.mutate({ dealId: deal.id, note: note.trim() }); }} />
              <Button size="sm" onClick={() => note.trim() && addActivity.mutate({ dealId: deal.id, note: note.trim() })} disabled={addActivity.isPending} style={{ background: BRAND }} className="text-white">Log</Button>
            </div>
            <div className="space-y-1.5 pt-1">
              {acts.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
              {acts.map(a => (
                <div key={a.id} className="text-xs border-l-2 pl-2.5 py-0.5" style={{ borderColor: `${BRAND}66` }}>
                  <p>{a.note}</p>
                  <p className="text-[10px] text-muted-foreground">{fmt(a.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Deal dialog ──
function AddDealDialog({ bdUsers, contacts, defaultOwner, onDone }: { bdUsers: BdUser[]; contacts: Contact[]; defaultOwner?: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ownerId: defaultOwner ?? 0, contactId: 0, serviceType: "", seats: "", value: "", notes: "", expectedCloseDate: "" });
  const add = trpc.bd.addDeal.useMutation({
    onSuccess: () => { toast.success("Deal added"); setOpen(false); setForm({ title: "", ownerId: defaultOwner ?? 0, contactId: 0, serviceType: "", seats: "", value: "", notes: "", expectedCloseDate: "" }); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!form.title.trim()) return toast.error("Deal name is required");
    if (!form.ownerId) return toast.error("Pick an owner");
    add.mutate({
      title: form.title.trim(), ownerId: Number(form.ownerId),
      contactId: form.contactId ? Number(form.contactId) : undefined,
      serviceType: form.serviceType || undefined,
      seats: form.seats ? Number(form.seats) : undefined,
      value: form.value || undefined, notes: form.notes || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
    });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)} style={{ background: BRAND }} className="text-white"><Plus className="w-4 h-4 mr-1" /> New Deal</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input placeholder="Deal name *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="border rounded-md px-2 py-2 text-sm bg-background" value={form.ownerId} onChange={e => setForm({ ...form, ownerId: Number(e.target.value) })}>
                <option value={0}>Owner *</option>
                {bdUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className="border rounded-md px-2 py-2 text-sm bg-background" value={form.contactId} onChange={e => setForm({ ...form, contactId: Number(e.target.value) })}>
                <option value={0}>Company / contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <Input placeholder="Service being sold (e.g. inbound support, lead gen)" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Value (USD)" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              <Input placeholder="Seats / agents" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} />
            </div>
            <Input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} />
            <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={add.isPending} style={{ background: BRAND }} className="text-white">{add.isPending ? "Adding…" : "Add Deal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Contacts panel (shared) ──
function ContactDealsRow({ contactId, ownerName }: { contactId: number; ownerName: (id: number) => string }) {
  const { data: deals = [] } = trpc.bd.listDeals.useQuery({});
  const mine = (deals as Deal[]).filter(d => d.contactId === contactId);
  const stageLabel = (k: string) => STAGES.find(s => s.key === k)?.label ?? k;
  return (
    <tr className="bg-muted/30"><td colSpan={5} className="px-4 py-2">
      {mine.length === 0 ? <p className="text-xs text-muted-foreground">No deals linked to this contact yet.</p> : (
        <div className="space-y-1">
          {mine.map(d => (
            <p key={d.id} className="text-xs flex items-center gap-2">
              <span className="font-medium">{d.title}</span>
              <Badge variant="outline" className="text-[10px]">{stageLabel(d.stage)}</Badge>
              <span className="text-muted-foreground">{ownerName(d.ownerId)}{d.value ? ` · $${d.value}` : ""}</span>
            </p>
          ))}
        </div>
      )}
    </td></tr>
  );
}

function ClaimLogin({ candidates }: { candidates: BdUser[] }) {
  const utils = trpc.useUtils();
  const link = trpc.bd.linkLogin.useMutation({
    onSuccess: () => { toast.success("Linked! Loading your pipeline…"); utils.bd.me.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="p-6 max-w-md mx-auto text-center space-y-4">
      <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-bold">Who are you?</h1>
      <p className="text-sm text-muted-foreground">Link this login to your BD profile — one time only.</p>
      <div className="space-y-2">
        {candidates.map(c => (
          <Button key={c.id} className="w-full text-white" style={{ background: BRAND }} onClick={() => link.mutate({ bdUserId: c.id })} disabled={link.isPending}>
            I'm {c.name}
          </Button>
        ))}
        {candidates.length === 0 && <p className="text-xs text-muted-foreground">No unlinked BD profiles — ask the admin.</p>}
      </div>
    </div>
  );
}

function ContactsPanel({ contacts, bdUsers, onDone }: { contacts: Contact[]; bdUsers: BdUser[]; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const nameOf = (id: number) => bdUsers.find(u => u.id === id)?.name ?? "—";
  const blank = { company: "", contactName: "", jobTitle: "", email: "", phone: "", website: "", source: "", notes: "", stage: "", ownerId: 0 };
  const [form, setForm] = useState(blank);
  const add = trpc.bd.addContact.useMutation({ onError: (e) => toast.error(e.message) });
  const addDeal = trpc.bd.addDeal.useMutation({ onError: (e) => toast.error(e.message) });
  const submit = async () => {
    if (!form.company.trim()) return toast.error("Company is required");
    if (form.stage && !form.ownerId) return toast.error("Pick an owner to add this to a pipeline");
    try {
      const res = await add.mutateAsync({
        company: form.company, contactName: form.contactName || undefined, jobTitle: form.jobTitle || undefined,
        email: form.email || undefined, phone: form.phone || undefined, website: form.website || undefined,
        source: form.source || undefined, notes: form.notes || undefined,
      });
      if (form.stage && form.ownerId && res?.id) {
        await addDeal.mutateAsync({
          title: form.company, ownerId: Number(form.ownerId), contactId: res.id,
          stage: form.stage as "follow_up" | "negotiations" | "review" | "partners_consultants" | "closed_won" | "closed_lost",
        });
        utils.bd.listDeals.invalidate();
      }
      toast.success(form.stage ? "Contact added & placed in pipeline" : "Contact added");
      setOpen(false); setForm(blank); onDone();
    } catch { /* surfaced by onError */ }
  };
  const del = trpc.bd.deleteContact.useMutation({ onSuccess: () => { utils.bd.listContacts.invalidate(); toast.success("Contact deleted"); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Shared across the BD team</p>
        <Button onClick={() => setOpen(true)} style={{ background: BRAND }} className="text-white"><Plus className="w-4 h-4 mr-1" /> New Contact</Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Company</th><th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Phone</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {contacts.map(c => (<>
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-medium"><button className="hover:underline" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>{c.company}</button></td>
                <td className="px-3 py-2 text-muted-foreground">{c.contactName || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.email || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => { if (confirm("Delete this contact?")) del.mutate({ id: c.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
              {expanded === c.id && <ContactDealsRow contactId={c.id} ownerName={nameOf} />}
            </>))}
            {contacts.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No contacts yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input placeholder="Company *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Contact name" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
              <Input placeholder="Job title" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              <Input placeholder="Source (where lead came from)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
            </div>
            <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className="rounded-lg border p-2.5 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Add straight to a pipeline? (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded-md px-2 py-2 text-sm bg-background" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                  <option value="">Don't add to pipeline</option>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select className="border rounded-md px-2 py-2 text-sm bg-background" value={form.ownerId} onChange={e => setForm({ ...form, ownerId: Number(e.target.value) })} disabled={!form.stage}>
                  <option value={0}>Owner</option>
                  {bdUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={add.isPending || addDeal.isPending} style={{ background: BRAND }} className="text-white">{add.isPending ? "Adding…" : "Add Contact"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ── Tasks per deal ("send proposal by Thu") ──
function DealTasks({ dealId }: { dealId: number }) {
  const utils = trpc.useUtils();
  const { data: tasks = [] } = trpc.bd.listTasks.useQuery({ dealId });
  const list = tasks as { id: number; title: string; dueDate: string | null; done: boolean }[];
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = trpc.bd.addTask.useMutation({ onSuccess: () => { setTitle(""); setDue(""); utils.bd.listTasks.invalidate({ dealId }); }, onError: (e) => toast.error(e.message) });
  const toggle = trpc.bd.toggleTask.useMutation({ onSuccess: () => utils.bd.listTasks.invalidate({ dealId }), onError: (e) => toast.error(e.message) });
  const del = trpc.bd.deleteTask.useMutation({ onSuccess: () => utils.bd.listTasks.invalidate({ dealId }), onError: (e) => toast.error(e.message) });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Tasks</p>
      <div className="flex gap-2">
        <Input placeholder="e.g. Send proposal" value={title} onChange={e => setTitle(e.target.value)} />
        <Input type="date" className="w-36" value={due} onChange={e => setDue(e.target.value)} />
        <Button size="sm" onClick={() => title.trim() && add.mutate({ dealId, title: title.trim(), dueDate: due || undefined })} disabled={add.isPending} style={{ background: BRAND }} className="text-white">Add</Button>
      </div>
      <div className="space-y-1 pt-0.5">
        {list.length === 0 && <p className="text-xs text-muted-foreground">No tasks.</p>}
        {list.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={t.done} onChange={e => toggle.mutate({ id: t.id, done: e.target.checked })} />
            <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
            {t.dueDate && <span className={`text-[10px] ${!t.done && t.dueDate < today ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>due {t.dueDate}</span>}
            <button onClick={() => del.mutate({ id: t.id })} className="ml-auto text-muted-foreground hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
