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
type Company = { id: number; name: string; website: string | null; industry: string | null; country: string | null; source: string | null; notes: string | null };
type Contact = { id: number; company: string; companyId: number | null; contactName: string | null; jobTitle: string | null; email: string | null; phone: string | null };
type Deal = {
  id: number; title: string; ownerId: number; companyId: number | null; contactId: number | null; stage: StageKey;
  serviceType: string | null; seats: number | null; value: string | null; notes: string | null; expectedCloseDate: string | null;
  createdAt: number; lastContactedAt: number | null; reminderDate: string | null; reminderNote: string | null; outcomeReason: string | null; stageChangedAt: number | null;
};
// A deal is "going cold" after this many days with no logged activity
const COLD_DAYS = 14;

export default function BusinessDevelopment() {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.bd.listUsers.useQuery();
  const bdUsers = users as BdUser[];
  const { data: me } = trpc.bd.me.useQuery();
  const isBdUser = me?.kind === "bd";
  const myBdId = isBdUser && me && "bdUser" in me ? (me.bdUser as BdUser).id : null;
  const [ownerId, setOwnerId] = useState<number | "all">("all");
  const [dragId, setDragId] = useState<number | null>(null);
  // BD-role users open on their own pipeline but may browse everyone's (view-only)
  const [defaulted, setDefaulted] = useState(false);
  useEffect(() => { if (myBdId && !defaulted) { setOwnerId(myBdId); setDefaulted(true); } }, [myBdId, defaulted]);
  // A BD user can only edit deals they own; everyone else edits everything
  const canEdit = (d: Deal) => !isBdUser || d.ownerId === myBdId;
  const [view, setView] = useState<"board" | "table">("board");
  const [tab, setTab] = useState<"pipeline" | "companies">("pipeline");

  const { data: deals = [], isLoading } = trpc.bd.listDeals.useQuery(
    ownerId === "all" ? {} : { ownerId }
  );
  const { data: contacts = [] } = trpc.bd.listContacts.useQuery();
  // listCompanies also auto-backfills companies from legacy contact rows on first call
  const { data: companies = [] } = trpc.bd.listCompanies.useQuery();
  const { data: stale = [] } = trpc.bd.staleDeals.useQuery();
  const typedDeals = deals as Deal[];
  const typedContacts = contacts as Contact[];
  const typedCompanies = companies as Company[];
  const [ignoredStale, setIgnoredStale] = useState<Set<number>>(new Set());
  const staleDeals = (stale as (Deal & { daysStale: number })[])
    .filter(d => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .filter(d => ownerId === "all" || d.ownerId === ownerId)
    .filter(d => !ignoredStale.has(d.id));

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
  // Company shown on a deal: linked company first, contact's company as fallback
  const dealCompany = (d: Deal) => (d.companyId ? (typedCompanies.find(c => c.id === d.companyId)?.name ?? "") : "") || contactCompany(d.contactId);

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
          <button onClick={() => setTab("companies")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "companies" ? "bg-foreground text-background" : "bg-background"}`}>Companies</button>
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
              <AddDealDialog bdUsers={bdUsers} companies={typedCompanies} contacts={typedContacts} defaultOwner={ownerId === "all" ? bdUsers[0]?.id : ownerId} onDone={() => utils.bd.listDeals.invalidate()} />
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

          {staleDeals.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-900 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Going cold — no activity for {COLD_DAYS}+ days ({staleDeals.length})</p>
              <div className="space-y-1.5">
                {staleDeals.map(d => (
                  <div key={d.id} className="w-full flex items-center justify-between gap-2 rounded-lg bg-background border px-2.5 py-1.5">
                    <button onClick={() => { const full = typedDeals.find(x => x.id === d.id); if (full) setOpenDeal(full); }} className="flex-1 text-left">
                      <span className="text-sm">
                        <span className="font-medium">{d.title}</span>
                        {dealCompany(d) && <span className="text-muted-foreground"> · {dealCompany(d)}</span>}
                      </span>
                    </button>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{ownerName(d.ownerId)}</Badge>
                      <span className="text-[10px] text-red-600 font-semibold">{d.daysStale}d silent</span>
                      <button onClick={() => setIgnoredStale(prev => new Set([...prev, d.id]))}
                        className="text-[10px] px-2 py-0.5 rounded border text-muted-foreground hover:bg-muted/50">Ignore</button>
                      <button onClick={() => { if (confirm(`Delete "${d.title}"?`)) deleteDeal.mutate({ id: d.id }); }}
                        className="text-[10px] px-2 py-0.5 rounded border text-red-600 hover:bg-red-50">Delete</button>
                    </span>
                  </div>
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
                      <Card key={d.id} className={`border ${canEdit(d) ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === d.id ? "opacity-50" : ""}`} draggable={canEdit(d)}
                        onDragStart={() => canEdit(d) && setDragId(d.id)} onDragEnd={() => setDragId(null)}>
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => setOpenDeal(d)} className="text-sm font-semibold leading-tight text-left hover:underline">{d.title}</button>
                            {canEdit(d) && <button onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                          {dealCompany(d) && <p className="text-xs text-muted-foreground">{dealCompany(d)}</p>}
                          {d.notes && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{d.notes}</p>}
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
                            {canEdit(d) ? (
                              <select
                                value={d.stage}
                                onChange={(e) => handleStage(d, e.target.value as StageKey)}
                                className="text-[11px] border rounded px-1 py-0.5 bg-background"
                              >
                                {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                              </select>
                            ) : (
                              <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5" title="View-only — not your deal">view-only</span>
                            )}
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
                      <td className="px-3 py-2 text-muted-foreground">{dealCompany(d) || "—"}</td>
                      <td className="px-3 py-2">{ownerName(d.ownerId)}</td>
                      <td className="px-3 py-2">
                        {canEdit(d) ? (
                          <select value={d.stage} onChange={(e) => handleStage(d, e.target.value as StageKey)} className="text-xs border rounded px-1 py-0.5 bg-background">
                            {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                          </select>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{STAGES.find(s => s.key === d.stage)?.label ?? d.stage}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{d.value ? `$${d.value}` : "—"}</td>
                      <td className="px-3 py-2 text-right">{canEdit(d) && <button onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}</td>
                    </tr>
                  ))}
                  {typedDeals.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No deals yet.</td></tr>}
                </tbody>
              </table>
            </CardContent></Card>
          )}
        </>
      )}

      {tab === "companies" && <CompaniesPanel companies={typedCompanies} contacts={typedContacts} deals={typedDeals} ownerName={ownerName} onOpenDeal={(d) => setOpenDeal(d)} />}

      {openDeal && (
        <DealDrawer
          deal={openDeal}
          company={dealCompany(openDeal)}
          ownerName={ownerName(openDeal.ownerId)}
          readOnly={!canEdit(openDeal)}
          onClose={() => setOpenDeal(null)}
          onChanged={() => utils.bd.listDeals.invalidate()}
        />
      )}
    </div>
  );
}

// ── Deal detail drawer: activity log + reminder + outcome ──
function DealDrawer({ deal, company, ownerName, readOnly = false, onClose, onChanged }: { deal: Deal; company: string; ownerName: string; readOnly?: boolean; onClose: () => void; onChanged: () => void }) {
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

          {readOnly && (
            <div className="rounded-lg border p-2 text-[11px] text-muted-foreground bg-muted/40">
              👁 View-only — this deal belongs to {ownerName}. You can read everything but not change it.
            </div>
          )}

          {/* Reminder */}
          {!readOnly && (
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
          )}

          {/* Tasks */}
          {!readOnly && <DealTasks dealId={deal.id} />}

          {/* Activity log */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Activity log</p>
            {!readOnly && (
            <div className="flex gap-2">
              <Input placeholder="Left VM / sent proposal / spoke to…" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && note.trim()) addActivity.mutate({ dealId: deal.id, note: note.trim() }); }} />
              <Button size="sm" onClick={() => note.trim() && addActivity.mutate({ dealId: deal.id, note: note.trim() })} disabled={addActivity.isPending} style={{ background: BRAND }} className="text-white">Log</Button>
            </div>
            )}
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
function AddDealDialog({ bdUsers, companies, contacts, defaultOwner, onDone }: { bdUsers: BdUser[]; companies: Company[]; contacts: Contact[]; defaultOwner?: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ownerId: defaultOwner ?? 0, companyId: 0, contactId: 0, serviceType: "", seats: "", value: "", notes: "", expectedCloseDate: "" });
  const add = trpc.bd.addDeal.useMutation({
    onSuccess: () => { toast.success("Deal added"); setOpen(false); setForm({ title: "", ownerId: defaultOwner ?? 0, companyId: 0, contactId: 0, serviceType: "", seats: "", value: "", notes: "", expectedCloseDate: "" }); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  const companyContacts = form.companyId ? contacts.filter(c => c.companyId === form.companyId) : contacts;
  const submit = () => {
    if (!form.title.trim()) return toast.error("Deal name is required");
    if (!form.ownerId) return toast.error("Pick an owner");
    add.mutate({
      title: form.title.trim(), ownerId: Number(form.ownerId),
      companyId: form.companyId ? Number(form.companyId) : undefined,
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
              <select className="border rounded-md px-2 py-2 text-sm bg-background" value={form.companyId} onChange={e => setForm({ ...form, companyId: Number(e.target.value), contactId: 0 })}>
                <option value={0}>Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <select className="w-full border rounded-md px-2 py-2 text-sm bg-background" value={form.contactId} onChange={e => setForm({ ...form, contactId: Number(e.target.value) })}>
              <option value={0}>Primary contact (optional)</option>
              {companyContacts.map(c => <option key={c.id} value={c.id}>{c.contactName || c.company}{c.jobTitle ? ` — ${c.jobTitle}` : ""}</option>)}
            </select>
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

// ── Companies panel: company → contacts → deals tree ──
function CompaniesPanel({ companies, contacts, deals, ownerName, onOpenDeal }: {
  companies: Company[]; contacts: Contact[]; deals: Deal[]; ownerName: (id: number) => string; onOpenDeal: (d: Deal) => void;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editCo, setEditCo] = useState<Company | null>(null);
  const refresh = () => { utils.bd.listCompanies.invalidate(); utils.bd.listContacts.invalidate(); utils.bd.listDeals.invalidate(); };

  const delCompany = trpc.bd.deleteCompany.useMutation({
    onSuccess: () => { refresh(); toast.success("Company deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const contactsOf = (id: number) => contacts.filter(c => c.companyId === id);
  const dealsOf = (id: number) => deals.filter(d => d.companyId === id || (d.contactId && contacts.find(c => c.id === d.contactId)?.companyId === id));
  const stageLabel = (k: string) => STAGES.find(s => s.key === k)?.label ?? k;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {companies.length} companies · shared across the BD team</p>
        <Button onClick={() => setNewOpen(true)} style={{ background: BRAND }} className="text-white"><Plus className="w-4 h-4 mr-1" /> New Company</Button>
      </div>

      <div className="space-y-2">
        {companies.map(co => {
          const cts = contactsOf(co.id);
          const ds = dealsOf(co.id);
          const open = expanded === co.id;
          const openDeals = ds.filter(d => d.stage !== "closed_won" && d.stage !== "closed_lost");
          return (
            <Card key={co.id}>
              <CardContent className="p-3">
                <button className="w-full text-left" onClick={() => setExpanded(open ? null : co.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{co.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[co.industry, co.country].filter(Boolean).join(" · ") || "—"}
                        {" · "}{cts.length} contact{cts.length === 1 ? "" : "s"} · {ds.length} deal{ds.length === 1 ? "" : "s"}
                        {openDeals.length > 0 && <span className="text-emerald-700 font-medium"> ({openDeals.length} open)</span>}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{open ? "▾" : "▸"}</span>
                  </div>
                </button>

                {open && (
                  <div className="mt-3 pt-3 border-t space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {co.website && <a href={co.website.startsWith("http") ? co.website : `https://${co.website}`} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: BRAND }}>{co.website}</a>}
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditCo(co)}>Edit</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" disabled={delCompany.isPending}
                        onClick={() => { if (confirm(`Delete ${co.name}? Only possible when it has no contacts or deals.`)) delCompany.mutate({ id: co.id }); }}>
                        Delete
                      </Button>
                    </div>
                    {co.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{co.notes}</p>}

                    {/* Contacts under this company */}
                    <div>
                      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Contacts</p>
                      {cts.length === 0 && <p className="text-xs text-muted-foreground mb-1.5">No contacts yet.</p>}
                      <div className="space-y-1 mb-2">
                        {cts.map(c => <ContactRow key={c.id} contact={c} onChanged={refresh} />)}
                      </div>
                      <AddContactInline companyId={co.id} onDone={refresh} />
                    </div>

                    {/* Activity timeline: company notes + all its deals' activity */}
                    <CompanyTimeline companyId={co.id} />

                    {/* Deals under this company */}
                    <div>
                      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> Deals</p>
                      {ds.length === 0 ? <p className="text-xs text-muted-foreground">No deals yet — add one from the Pipeline tab.</p> : (
                        <div className="space-y-1">
                          {ds.map(d => (
                            <button key={d.id} onClick={() => onOpenDeal(d)} className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-1.5 hover:bg-muted/50">
                              <span className="text-xs font-medium flex-1 min-w-0 truncate">{d.title}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{stageLabel(d.stage)}</Badge>
                              <span className="text-[10px] text-muted-foreground shrink-0">{ownerName(d.ownerId)}{d.value ? ` · $${d.value}` : ""}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {companies.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No companies yet — add one to start building the tree.</CardContent></Card>
        )}
      </div>

      <CompanyDialog open={newOpen} onClose={() => setNewOpen(false)} onDone={refresh} />
      {editCo && <CompanyDialog open company={editCo} onClose={() => setEditCo(null)} onDone={refresh} />}
    </div>
  );
}

function ContactRow({ contact, onChanged }: { contact: Contact; onChanged: () => void }) {
  const del = trpc.bd.deleteContact.useMutation({
    onSuccess: () => { onChanged(); toast.success("Contact deleted"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{contact.contactName || "—"}{contact.jobTitle && <span className="font-normal text-muted-foreground"> · {contact.jobTitle}</span>}</p>
        <p className="text-[11px] text-muted-foreground truncate">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "no email / phone"}</p>
      </div>
      <button onClick={() => { if (confirm("Delete this contact?")) del.mutate({ id: contact.id }); }} className="text-muted-foreground hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function AddContactInline({ companyId, onDone }: { companyId: number; onDone: () => void }) {
  const [show, setShow] = useState(false);
  const blank = { contactName: "", jobTitle: "", email: "", phone: "" };
  const [f, setF] = useState(blank);
  const add = trpc.bd.addContact.useMutation({
    onSuccess: () => { toast.success("Contact added"); setF(blank); setShow(false); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  if (!show) return <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShow(true)}><Plus className="w-3 h-3 mr-1" /> Add contact</Button>;
  return (
    <div className="rounded-lg border border-dashed p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-8" placeholder="Name *" value={f.contactName} onChange={e => setF({ ...f, contactName: e.target.value })} />
        <Input className="h-8" placeholder="Job title" value={f.jobTitle} onChange={e => setF({ ...f, jobTitle: e.target.value })} />
        <Input className="h-8" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <Input className="h-8" placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShow(false)}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs text-white" style={{ background: BRAND }} disabled={add.isPending}
          onClick={() => {
            if (!f.contactName.trim()) return toast.error("Name is required");
            add.mutate({ companyId, contactName: f.contactName.trim(), jobTitle: f.jobTitle || undefined, email: f.email || undefined, phone: f.phone || undefined });
          }}>
          {add.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </div>
  );
}

function CompanyTimeline({ companyId }: { companyId: number }) {
  const utils = trpc.useUtils();
  const { data: activity = [] } = trpc.bd.listCompanyActivity.useQuery({ companyId });
  const acts = activity as { id: number; note: string; createdAt: number; dealTitle: string | null }[];
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const add = trpc.bd.addCompanyActivity.useMutation({
    onSuccess: () => { setNote(""); utils.bd.listCompanyActivity.invalidate({ companyId }); toast.success("Logged"); },
    onError: (e) => toast.error(e.message),
  });
  const fmt = (t: number) => new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const shown = showAll ? acts : acts.slice(0, 5);
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Activity</p>
      <div className="flex gap-2 mb-1.5">
        <Input className="h-8" placeholder="Company-level note (call, email, meeting…)" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && note.trim()) add.mutate({ companyId, note: note.trim() }); }} />
        <Button size="sm" className="h-8 text-xs text-white" style={{ background: BRAND }} disabled={add.isPending} onClick={() => note.trim() && add.mutate({ companyId, note: note.trim() })}>Log</Button>
      </div>
      {acts.length === 0 ? <p className="text-xs text-muted-foreground">No activity yet.</p> : (
        <div className="space-y-1.5">
          {shown.map(a => (
            <div key={a.id} className="text-xs border-l-2 pl-2.5 py-0.5" style={{ borderColor: `${BRAND}66` }}>
              <p>{a.dealTitle && <span className="font-medium text-muted-foreground">[{a.dealTitle}] </span>}{a.note}</p>
              <p className="text-[10px] text-muted-foreground">{fmt(a.createdAt)}</p>
            </div>
          ))}
          {acts.length > 5 && (
            <button className="text-[11px] underline text-muted-foreground" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show less" : `Show all ${acts.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CompanyDialog({ open, company, onClose, onDone }: { open: boolean; company?: Company; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: company?.name ?? "", website: company?.website ?? "", industry: company?.industry ?? "",
    country: company?.country ?? "", source: company?.source ?? "", notes: company?.notes ?? "",
  });
  const add = trpc.bd.addCompany.useMutation({
    onSuccess: () => { toast.success("Company added"); onClose(); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  const upd = trpc.bd.updateCompany.useMutation({
    onSuccess: () => { toast.success("Company updated"); onClose(); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!f.name.trim()) return toast.error("Company name is required");
    const payload = { name: f.name.trim(), website: f.website || undefined, industry: f.industry || undefined, country: f.country || undefined, source: f.source || undefined, notes: f.notes || undefined };
    if (company) upd.mutate({ id: company.id, ...payload });
    else add.mutate(payload);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{company ? "Edit Company" : "New Company"}</DialogTitle></DialogHeader>
        <div className="space-y-2.5">
          <Input placeholder="Company name *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Industry / vertical" value={f.industry} onChange={e => setF({ ...f, industry: e.target.value })} />
            <Input placeholder="Country" value={f.country} onChange={e => setF({ ...f, country: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Website" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
            <Input placeholder="Source (where lead came from)" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} />
          </div>
          <Textarea placeholder="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending || upd.isPending} style={{ background: BRAND }} className="text-white">
            {company ? (upd.isPending ? "Saving…" : "Save") : (add.isPending ? "Adding…" : "Add Company")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
