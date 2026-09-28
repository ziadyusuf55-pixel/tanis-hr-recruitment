// Clients.tsx — Client management page (list, create, edit, assign campaigns)
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlusCircle, Building2, Pencil, Link2 } from "lucide-react";

type Client = {
  id: number;
  name: string;
  shortCode: string;
  colorHex: string;
  isActive: boolean;
};

type Campaign = {
  id: number;
  name: string;
  clientId: number | null;
};

const DEFAULT_COLOR = "#6366f1";

export default function Clients() {
  const utils = trpc.useUtils();
  const { data: clients = [], isLoading: loadingClients } = trpc.clients.list.useQuery();
  const { data: campaigns = [], isLoading: loadingCampaigns } = trpc.campaigns.list.useQuery();

  // ── Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [assigning, setAssigning] = useState<Client | null>(null);

  // ── Create / Edit form
  const [form, setForm] = useState({ name: "", shortCode: "", colorHex: DEFAULT_COLOR });

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, shortCode: c.shortCode, colorHex: c.colorHex });
  }

  function openCreate() {
    setForm({ name: "", shortCode: "", colorHex: DEFAULT_COLOR });
    setShowCreate(true);
  }

  // ── Mutations
  const createMut = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setShowCreate(false);
      toast.success("Client added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setEditing(null);
      toast.success("Client updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const assignMut = trpc.clients.assignCampaign.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success("Campaign assigned");
    },
    onError: (e) => toast.error(e.message),
  });

  // Campaigns grouped by clientId
  const campaignsByClient = (campaigns as Campaign[]).reduce<Record<number | string, Campaign[]>>((acc, c) => {
    const key = c.clientId ?? "unassigned";
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const unassigned: Campaign[] = campaignsByClient["unassigned"] ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" /> Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(clients as Client[]).length} client{(clients as Client[]).length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <PlusCircle className="w-4 h-4" /> New Client
        </Button>
      </div>

      {(loadingClients || loadingCampaigns) && (
        <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>
      )}

      {/* Client cards */}
      <div className="space-y-4">
        {(clients as Client[]).map(c => {
          const cams: Campaign[] = campaignsByClient[c.id] ?? [];
          return (
            <div key={c.id} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.colorHex }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">{c.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">{c.shortCode}</Badge>
                      {!c.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cams.length} campaign{cams.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setAssigning(c)}>
                    <Link2 className="w-3.5 h-3.5" /> Assign Campaign
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {cams.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cams.map(cam => (
                    <span
                      key={cam.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: c.colorHex + "22", color: c.colorHex }}
                    >
                      {cam.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned campaigns */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed p-4 space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Unassigned Campaigns</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map(cam => (
              <span key={cam.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                {cam.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Name *</label>
              <Input placeholder="e.g. Acme Corp" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Short Code *</label>
              <Input placeholder="e.g. ACM" maxLength={20} value={form.shortCode}
                onChange={e => setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.colorHex}
                  onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
                  className="w-8 h-8 cursor-pointer rounded border" />
                <Input placeholder="#6366f1" value={form.colorHex}
                  onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))} className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!form.name || !form.shortCode || createMut.isPending}
              onClick={() => createMut.mutate(form)}>
              {createMut.isPending ? "Saving…" : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit modal */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Short Code *</label>
                <Input maxLength={20} value={form.shortCode}
                  onChange={e => setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.colorHex}
                    onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
                    className="w-8 h-8 cursor-pointer rounded border" />
                  <Input placeholder="#6366f1" value={form.colorHex}
                    onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))} className="font-mono text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="isActive" checked={editing.isActive}
                  onChange={e => setEditing(prev => prev ? { ...prev, isActive: e.target.checked } : prev)} />
                <label htmlFor="isActive" className="text-sm">Active</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                disabled={!form.name || !form.shortCode || updateMut.isPending}
                onClick={() => updateMut.mutate({ id: editing.id, ...form, isActive: editing.isActive })}>
                {updateMut.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Assign campaign modal */}
      {assigning && (
        <Dialog open onOpenChange={() => setAssigning(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Campaign to {assigning.name}</DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-2">
              <p className="text-sm text-muted-foreground">Select a campaign to assign to this client.</p>
              {(campaigns as Campaign[]).map(cam => {
                const currentClient = (clients as Client[]).find(cl => cl.id === cam.clientId);
                const isAssigned = cam.clientId === assigning.id;
                return (
                  <div key={cam.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{cam.name}</p>
                      {currentClient && !isAssigned && (
                        <p className="text-xs text-muted-foreground">Currently: {currentClient.name}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isAssigned ? "secondary" : "outline"}
                      disabled={assignMut.isPending}
                      onClick={() => {
                        if (isAssigned) {
                          assignMut.mutate({ campaignId: cam.id, clientId: null });
                        } else {
                          assignMut.mutate({ campaignId: cam.id, clientId: assigning.id });
                        }
                      }}>
                      {isAssigned ? "Unassign" : "Assign"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssigning(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
