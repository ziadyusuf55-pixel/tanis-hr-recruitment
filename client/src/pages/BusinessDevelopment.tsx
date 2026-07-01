import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LayoutGrid, Table2, Plus, Users, Trash2, Building2 } from "lucide-react";
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
};

export default function BusinessDevelopment() {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.bd.listUsers.useQuery();
  const bdUsers = users as BdUser[];
  const [ownerId, setOwnerId] = useState<number | "all">("all");
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
              <button onClick={() => setOwnerId("all")} className={`text-xs px-2.5 py-1 rounded-full border ${ownerId === "all" ? "text-white" : "bg-background"}`} style={ownerId === "all" ? { background: BRAND } : {}}>All</button>
              {bdUsers.map(u => (
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

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading pipeline…</p>
          ) : view === "board" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {STAGES.map(s => (
                <div key={s.key} className="rounded-xl border bg-muted/30 p-2 min-h-[120px]">
                  <div className="flex items-center justify-between px-1 py-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{byStage[s.key]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(byStage[s.key] ?? []).map(d => (
                      <Card key={d.id} className="border">
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight">{d.title}</p>
                            <button onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          {contactCompany(d.contactId) && <p className="text-xs text-muted-foreground">{contactCompany(d.contactId)}</p>}
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            {d.value && <span className="font-semibold text-emerald-700">${d.value}</span>}
                            {d.seats != null && <span className="text-muted-foreground">{d.seats} seats</span>}
                            {d.serviceType && <span className="text-muted-foreground">· {d.serviceType}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <Badge variant="outline" className="text-[10px]">{ownerName(d.ownerId)}</Badge>
                            <select
                              value={d.stage}
                              onChange={(e) => moveStage.mutate({ id: d.id, stage: e.target.value as StageKey })}
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
                      <td className="px-3 py-2 font-medium">{d.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{contactCompany(d.contactId) || "—"}</td>
                      <td className="px-3 py-2">{ownerName(d.ownerId)}</td>
                      <td className="px-3 py-2">
                        <select value={d.stage} onChange={(e) => moveStage.mutate({ id: d.id, stage: e.target.value as StageKey })} className="text-xs border rounded px-1 py-0.5 bg-background">
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

      {tab === "contacts" && <ContactsPanel contacts={typedContacts} onDone={() => utils.bd.listContacts.invalidate()} />}
    </div>
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
function ContactsPanel({ contacts, onDone }: { contacts: Contact[]; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: "", contactName: "", jobTitle: "", email: "", phone: "", website: "", source: "", notes: "" });
  const add = trpc.bd.addContact.useMutation({
    onSuccess: () => { toast.success("Contact added"); setOpen(false); setForm({ company: "", contactName: "", jobTitle: "", email: "", phone: "", website: "", source: "", notes: "" }); onDone(); },
    onError: (e) => toast.error(e.message),
  });
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
            {contacts.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{c.company}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.contactName || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.email || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => { if (confirm("Delete this contact?")) del.mutate({ id: c.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!form.company.trim()) return toast.error("Company is required"); add.mutate(form); }} disabled={add.isPending} style={{ background: BRAND }} className="text-white">{add.isPending ? "Adding…" : "Add Contact"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
