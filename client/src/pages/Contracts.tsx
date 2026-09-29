import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Plus, Search, AlertCircle, CheckCircle2, XCircle, Pencil } from "lucide-react";

type ContractType = "permanent" | "fixed_term" | "freelance";

const CONTRACT_LABELS: Record<ContractType, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed-Term",
  freelance: "Freelance",
};

const CONTRACT_COLORS: Record<ContractType, string> = {
  permanent: "bg-green-100 text-green-800",
  fixed_term: "bg-blue-100 text-blue-800",
  freelance: "bg-purple-100 text-purple-800",
};

interface ContractRow {
  id: number;
  traineeCode: string;
  contractType: ContractType;
  startDate: string | null;
  endDate: string | null;
  probationEndDate: string | null;
  isMedicallyInsured: boolean;
  isSociallyInsured: boolean;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: number;
  alias: string | null;
  fullName: string | null;
  campaignId: number | null;
  agentStatus: string | null;
}

interface MissingAgent {
  traineeCode: string;
  alias: string | null;
  fullName: string | null;
  campaignId: number | null;
}

const emptyForm = {
  traineeCode: "",
  contractType: "permanent" as ContractType,
  startDate: "",
  endDate: "",
  probationEndDate: "",
  isMedicallyInsured: false,
  isSociallyInsured: false,
  notes: "",
};

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState<"all" | "missing">("all");

  const { data: contracts = [], isLoading, refetch } = trpc.contracts.listAll.useQuery();
  const { data: missing = [], refetch: refetchMissing } = trpc.contracts.listMissing.useQuery();
  const upsert = trpc.contracts.upsert.useMutation({
    onSuccess: () => {
      toast.success("Contract saved");
      setShowForm(false);
      setEditTarget(null);
      void refetch();
      void refetchMissing();
    },
    onError: (e) => toast.error(e.message),
  });

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (tab === "missing") {
      return (missing as MissingAgent[]).filter(
        (a) => !q || a.traineeCode.toLowerCase().includes(q) || (a.alias ?? "").toLowerCase().includes(q) || (a.fullName ?? "").toLowerCase().includes(q)
      );
    }
    return (contracts as ContractRow[]).filter(
      (c) => !q || c.traineeCode.toLowerCase().includes(q) || (c.alias ?? "").toLowerCase().includes(q) || (c.fullName ?? "").toLowerCase().includes(q)
    );
  }, [contracts, missing, search, tab]);

  function openNew(prefillCode?: string) {
    setEditTarget(null);
    setForm({ ...emptyForm, traineeCode: prefillCode ?? "" });
    setShowForm(true);
  }

  function openEdit(c: ContractRow) {
    setEditTarget(c);
    setForm({
      traineeCode: c.traineeCode,
      contractType: c.contractType,
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      probationEndDate: c.probationEndDate ?? "",
      isMedicallyInsured: c.isMedicallyInsured,
      isSociallyInsured: c.isSociallyInsured,
      notes: c.notes ?? "",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.traineeCode.trim()) { toast.error("CRDTS / trainee code is required"); return; }
    upsert.mutate({
      traineeCode: form.traineeCode.trim(),
      contractType: form.contractType,
      startDate:       form.startDate || null,
      endDate:         form.endDate || null,
      probationEndDate: form.probationEndDate || null,
      isMedicallyInsured: form.isMedicallyInsured,
      isSociallyInsured:  form.isSociallyInsured,
      notes: form.notes || null,
    });
  }

  const totalContracts  = contracts.length;
  const totalMissing    = missing.length;
  const medicalCount    = (contracts as ContractRow[]).filter(c => c.isMedicallyInsured).length;
  const socialCount     = (contracts as ContractRow[]).filter(c => c.isSociallyInsured).length;

  function fmt(date: string | null) {
    if (!date) return "—";
    try { return new Date(date).toLocaleDateString("en-GB"); } catch { return date; }
  }

  function agentName(row: { alias: string | null; fullName: string | null; traineeCode: string }) {
    return row.alias || row.fullName || row.traineeCode;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Contracts
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track employment contract metadata for active agents</p>
        </div>
        <Button onClick={() => openNew()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Contract
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Contracted</p>
          <p className="text-2xl font-bold">{totalContracts}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Missing Contracts</p>
          <p className="text-2xl font-bold text-orange-600">{totalMissing}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Medically Insured</p>
          <p className="text-2xl font-bold">{medicalCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Socially Insured</p>
          <p className="text-2xl font-bold">{socialCount}</p>
        </CardContent></Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          <button
            className={`px-4 py-2 ${tab === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setTab("all")}
          >All ({totalContracts})</button>
          <button
            className={`px-4 py-2 ${tab === "missing" ? "bg-orange-500 text-white" : "hover:bg-muted"}`}
            onClick={() => setTab("missing")}
          >Missing ({totalMissing})</button>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or CRDTS…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
      ) : tab === "missing" ? (
        <Card>
          <CardHeader><CardTitle className="text-base text-orange-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Agents Without Contracts ({(displayed as MissingAgent[]).length})
          </CardTitle></CardHeader>
          <CardContent className="p-0">
            {(displayed as MissingAgent[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">All active agents have contracts 🎉</p>
            ) : (
              <div className="divide-y">
                {(displayed as MissingAgent[]).map((a) => (
                  <div key={a.traineeCode} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                    <div>
                      <p className="font-medium text-sm">{agentName(a)}</p>
                      <p className="text-xs text-muted-foreground">{a.traineeCode}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openNew(a.traineeCode)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Contract Type</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Start</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">End</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Probation End</th>
                <th className="text-center px-3 py-3 font-medium">Medical</th>
                <th className="text-center px-3 py-3 font-medium">Social</th>
                <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Updated by</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(displayed as ContractRow[]).length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-10">
                  {search ? "No results" : 'No contracts yet. Click "Add Contract" to start.'}
                </td></tr>
              ) : (
                (displayed as ContractRow[]).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{agentName(c)}</p>
                      <p className="text-xs text-muted-foreground">{c.traineeCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_COLORS[c.contractType]}`}>
                        {CONTRACT_LABELS[c.contractType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{fmt(c.startDate)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{fmt(c.endDate)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{fmt(c.probationEndDate)}</td>
                    <td className="px-3 py-3 text-center">
                      {c.isMedicallyInsured
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        : <XCircle className="h-4 w-4 text-muted-foreground/40 inline" />}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {c.isSociallyInsured
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        : <XCircle className="h-4 w-4 text-muted-foreground/40 inline" />}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {c.updatedBy ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Contract" : "Add Contract"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* CRDTS */}
            <div className="space-y-1.5">
              <Label>Agent CRDTS / Trainee Code *</Label>
              <Input
                placeholder="e.g. TC-001"
                value={form.traineeCode}
                onChange={(e) => setForm(f => ({ ...f, traineeCode: e.target.value }))}
                disabled={!!editTarget}
              />
            </div>

            {/* Contract Type */}
            <div className="space-y-1.5">
              <Label>Contract Type *</Label>
              <Select value={form.contractType} onValueChange={(v) => setForm(f => ({ ...f, contractType: v as ContractType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="fixed_term">Fixed-Term</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                  placeholder="Leave blank for open-ended"
                />
              </div>
            </div>

            {/* Probation End */}
            <div className="space-y-1.5">
              <Label>Probation End Date</Label>
              <Input
                type="date"
                value={form.probationEndDate}
                onChange={(e) => setForm(f => ({ ...f, probationEndDate: e.target.value }))}
              />
            </div>

            {/* Insurance toggles */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={form.isMedicallyInsured}
                  onChange={(e) => setForm(f => ({ ...f, isMedicallyInsured: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium">Medical Insurance</p>
                  <p className="text-xs text-muted-foreground">Medically insured</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={form.isSociallyInsured}
                  onChange={(e) => setForm(f => ({ ...f, isSociallyInsured: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium">Social Insurance</p>
                  <p className="text-xs text-muted-foreground">Socially insured</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes…"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditTarget(null); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Save Contract"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
