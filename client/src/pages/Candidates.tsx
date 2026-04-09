import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PIPELINE_STAGES,
  ACTIVE_STAGES,
  STAGE_LABELS,
  STAGE_DOT,
  STAGE_BG,
  STAGE_BADGE,
  PipelineStage,
} from "@/lib/pipeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  Search,
  Upload,
  Trash2,
  ChevronRight,
  CheckSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CandidateForm = {
  name: string;
  email: string;
  phone: string;
  positionApplied: string;
  notes: string;
  status: PipelineStage;
};

const EMPTY_FORM: CandidateForm = {
  name: "",
  email: "",
  phone: "",
  positionApplied: "Call Center Agent",
  notes: "",
  status: "applied",
};

export default function Candidates() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: candidates, isLoading } = trpc.candidates.list.useQuery();

  const createCandidate = trpc.candidates.create.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      toast.success("Candidate added");
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Failed to add candidate"),
  });

  const bulkImport = trpc.candidates.bulkImport.useMutation({
    onSuccess: (res: { imported: number } | void) => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      const count = (res as { imported: number } | undefined)?.imported ?? csvRows.length;
      toast.success(`Imported ${count} candidates`);
      setImportOpen(false);
      setCsvRows([]);
    },
    onError: () => toast.error("Failed to import candidates"),
  });

  const deleteCandidate = trpc.candidates.delete.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      toast.success("Candidate deleted");
    },
    onError: () => toast.error("Failed to delete candidate"),
  });

  const updateStatus = trpc.candidates.updateStatus.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Single delete
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // Multi-select state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: number[]) => {
    if (ids.every((id) => selected.has(id))) {
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    }
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await deleteCandidate.mutateAsync({ id });
    }
    clearSelection();
    setBulkDeleteOpen(false);
    toast.success(`Deleted ${ids.length} candidate${ids.length > 1 ? "s" : ""}`);
  };

  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(EMPTY_FORM);
  const [csvRows, setCsvRows] = useState<CandidateForm[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = candidates?.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleAddSubmit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    createCandidate.mutate({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      positionApplied: form.positionApplied.trim(),
      notes: form.notes.trim() || undefined,
      status: form.status,
    });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
      const rows: CandidateForm[] = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(?:"([^"]*)"|([^,]*))(?:,|$)/g)
          ?.map((c) => c.replace(/,$/, "").trim().replace(/^"|"$/g, "")) ?? lines[i].split(",").map((c) => c.trim());
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? (cols[idx] ?? "").trim() : "";
        };
        // Name: header-based first, fallback to col 0
        const name = get("name") || get("fullname") || get("candidatename") || cols[0]?.trim() || "";
        // Email: optional — try header-based, then scan for @
        const email = get("email") || cols.find((c) => c.includes("@")) || "";
        // Phone normalization
        const normalizePhone = (raw: string): string => {
          if (!raw) return "";
          let p = raw.replace(/[()\-\s]/g, "");
          if (/^020\d/.test(p)) p = "+20" + p.slice(3);
          if (/^00\d/.test(p)) p = "+" + p.slice(2);
          return p;
        };
        const phoneFromHeader = get("phone") || get("phonenumber") || get("mobile") || get("contact");
        // Scan all columns for a phone-like value if no header match
        const phoneFromScan = cols.find((c) => {
          const clean = c.replace(/[()\-\s]/g, "");
          return /^[+\d]{7,}$/.test(clean) && !c.includes("@");
        }) || "";
        const rawPhone = phoneFromHeader || phoneFromScan;
        const phone = normalizePhone(rawPhone);
        const positionApplied = get("position") || get("positionapplied") || get("role") || get("jobtitle") || "Call Center Agent";
        // Required: name + phone
        if (!name || !phone) { skipped++; continue; }
        rows.push({
          name,
          email,
          phone,
          positionApplied,
          notes: get("notes") || get("note"),
          status: "applied",
        });
      }
      if (rows.length === 0) { toast.error("No valid rows found. Check that your CSV has name and phone columns."); return; }
      if (skipped > 0) toast.info(`${skipped} row${skipped > 1 ? "s" : ""} skipped (missing name or phone)`);
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    bulkImport.mutate(
      csvRows.map((r) => ({
        name: r.name,
        email: r.email || undefined,
        phone: r.phone || undefined,
        positionApplied: r.positionApplied,
        notes: r.notes || undefined,
      }))
    );
  };

  const filteredIds = filtered.map((c) => c.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${candidates?.length ?? 0} total candidate${candidates?.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-2 h-9">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2 h-9">
            <Plus className="h-3.5 w-3.5" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Tabs value={view} onValueChange={(v) => { setView(v as "board" | "list"); clearSelection(); }}>
          <TabsList className="h-9">
            <TabsTrigger value="board" className="text-xs px-3">Board</TabsTrigger>
            <TabsTrigger value="list" className="text-xs px-3">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground flex-1">
            {selected.size} candidate{selected.size > 1 ? "s" : ""} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Delete Selected
          </Button>
          <button onClick={clearSelection} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : view === "board" ? (
        <PipelineBoard
          candidates={filtered}
          selected={selected}
          onMoveStage={(id, status) => updateStatus.mutate({ id, status })}
          onClickCandidate={(id) => navigate(`/candidates/${id}`)}
          onDeleteCandidate={(id, name) => { setDeleteId(id); setDeleteName(name); }}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <CandidateList
          candidates={filtered}
          selected={selected}
          allSelected={allFilteredSelected}
          onClickCandidate={(id) => navigate(`/candidates/${id}`)}
          onDeleteCandidate={(id, name) => { setDeleteId(id); setDeleteName(name); }}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => toggleSelectAll(filteredIds)}
        />
      )}

      {/* Add Candidate Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input placeholder="+20 100 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" placeholder="jane@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Pipeline Stage</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PipelineStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="Any additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} disabled={createCandidate.isPending}>
              {createCandidate.isPending ? "Adding..." : "Add Candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be undone and will permanently remove all their data, notes, and interview history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId !== null) { deleteCandidate.mutate({ id: deleteId }); setDeleteId(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Candidates</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selected.size} selected candidate{selected.size > 1 ? "s" : ""}</strong>? This cannot be undone and will remove all their data, notes, and interview history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete {selected.size} Candidates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setCsvRows([]); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Candidates from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm mb-2">CSV Format</p>
              <p>Required columns: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">phone</code></p>
              <p>Optional: <code className="bg-muted px-1 rounded">email</code>, <code className="bg-muted px-1 rounded">notes</code>, <code className="bg-muted px-1 rounded">position</code></p>
              <p className="text-muted-foreground/70">Phone numbers with country codes (020, +20, 0020) and parentheses are handled automatically. Position defaults to "Call Center Agent".</p>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            </div>

            {csvRows.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{csvRows.length} candidates ready to import</p>
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{r.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImportConfirm} disabled={csvRows.length === 0 || bulkImport.isPending}>
              {bulkImport.isPending ? "Importing..." : `Import ${csvRows.length} Candidates`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Pipeline Board ────────────────────────────────────────────────────────────

type CandidateRow = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  positionApplied: string;
  status: string;
  createdAt: Date;
};

function PipelineBoard({
  candidates,
  selected,
  onMoveStage,
  onClickCandidate,
  onDeleteCandidate,
  onToggleSelect,
}: {
  candidates: CandidateRow[];
  selected: Set<number>;
  onMoveStage: (id: number, stage: PipelineStage) => void;
  onClickCandidate: (id: number) => void;
  onDeleteCandidate: (id: number, name: string) => void;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {ACTIVE_STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c) => c.status === stage);
        return (
          <div key={stage} className={`flex-shrink-0 w-64 rounded-xl border ${STAGE_BG[stage]} flex flex-col`}>
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                <span className="text-xs font-semibold text-foreground">{STAGE_LABELS[stage]}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-white/60 rounded-full px-2 py-0.5">
                {stageCandidates.length}
              </span>
            </div>
            <div className="p-2 flex flex-col gap-2 flex-1 min-h-[120px]">
              {stageCandidates.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/50">No candidates</p>
                </div>
              ) : (
                stageCandidates.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    currentStage={stage}
                    isSelected={selected.has(c.id)}
                    onMoveStage={onMoveStage}
                    onClick={() => onClickCandidate(c.id)}
                    onDelete={() => onDeleteCandidate(c.id, c.name)}
                    onToggleSelect={() => onToggleSelect(c.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CandidateCard({
  candidate,
  currentStage,
  isSelected,
  onMoveStage,
  onClick,
  onDelete,
  onToggleSelect,
}: {
  candidate: CandidateRow;
  currentStage: PipelineStage;
  isSelected: boolean;
  onMoveStage: (id: number, stage: PipelineStage) => void;
  onClick: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
}) {
  const initials = candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div
      className={`bg-white rounded-lg p-3 shadow-sm border transition-all group cursor-pointer hover:shadow-md ${isSelected ? "border-primary/50 ring-1 ring-primary/20" : "border-white/80"}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <div onClick={(e) => { e.stopPropagation(); onToggleSelect(); }} className="mt-0.5 shrink-0">
          <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{candidate.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{candidate.phone || candidate.email || "—"}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            title="Delete candidate"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="flex gap-1 mt-2.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {ACTIVE_STAGES.filter((s) => s !== currentStage).slice(0, 3).map((s) => (
          <button
            key={s}
            onClick={() => onMoveStage(candidate.id, s)}
            className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border transition-colors hover:opacity-80 ${STAGE_BADGE[s] ?? ""}`}
          >
            → {STAGE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CandidateList({
  candidates,
  selected,
  allSelected,
  onClickCandidate,
  onDeleteCandidate,
  onToggleSelect,
  onToggleSelectAll,
}: {
  candidates: CandidateRow[];
  selected: Set<number>;
  allSelected: boolean;
  onClickCandidate: (id: number) => void;
  onDeleteCandidate: (id: number, name: string) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
}) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
        <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">No candidates found</p>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or add a new candidate.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 w-8">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                className="h-3.5 w-3.5"
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidate</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Added</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => (
            <tr
              key={c.id}
              className={`group border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${selected.has(c.id) ? "bg-primary/5" : i % 2 === 0 ? "" : "bg-muted/10"}`}
              onClick={() => onClickCandidate(c.id)}
            >
              <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onToggleSelect(c.id); }}>
                <Checkbox checked={selected.has(c.id)} className="h-3.5 w-3.5" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {c.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.email || "—"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{c.phone || "—"}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${STAGE_BADGE[c.status as PipelineStage] ?? ""}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[c.status as PipelineStage]}`} />
                  {STAGE_LABELS[c.status as PipelineStage]}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCandidate(c.id, c.name); }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete candidate"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
