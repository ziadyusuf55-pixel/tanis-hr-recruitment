import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errorMessage";
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
  MessageCircle,
  ArrowRight,
  AlertTriangle,
  UserX,
  Clock,
  EyeOff,
  Building2,
  Calendar,
  Download,
  RefreshCw,
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
  age: string;
  location: string;
  source: string;
  wave: string;
};

const EMPTY_FORM: CandidateForm = {
  name: "",
  email: "",
  phone: "",
  positionApplied: "Call Center Agent",
  notes: "",
  status: "applied",
  age: "",
  location: "",
  source: "",
  wave: "",
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
    onSuccess: (res) => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      const inserted = res?.inserted ?? csvRows.length;
      const skipped = res?.skipped ?? 0;
      if (skipped > 0) {
        toast.success(`Imported ${inserted} candidates. ${skipped} skipped (already exist).`);
      } else {
        toast.success(`Imported ${inserted} candidates`);
      }
      setImportOpen(false);
      setCsvRows([]);
    },
    onError: (err) => toast.error(`Import failed: ${err.message || "Please check your CSV format and try again"}`),
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

  const handleNoAnswer = (id: number, currentStage: PipelineStage) => {
    // Toggle: if already in no_answer, move back to whatsapp_sent; otherwise move to no_answer
    const targetStage: PipelineStage = currentStage === "no_answer" ? "whatsapp_sent" : "no_answer";
    const candidate = (candidates ?? []).find((c) => c.id === id);
    updateStatus.mutate({ id, status: targetStage, fromStage: candidate?.status as PipelineStage | undefined });
  };

  // Rejection reason state
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectName, setRejectName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  // No Show: pre-fill reason and open reject dialog
  const [isNoShow, setIsNoShow] = useState(false);

  const handleReject = (id: number, name: string, prefillReason?: string) => {
    setRejectId(id);
    setRejectName(name);
    setRejectReason(prefillReason ?? "");
    setIsNoShow(!!prefillReason);
  };

  const handleNoShow = (id: number, name: string) => {
    handleReject(id, name, "No-show — Did not attend interview");
  };

  const confirmReject = () => {
    if (rejectId === null) return;
    if (!rejectReason.trim()) { toast.error("Please enter a rejection reason"); return; }
    const candidate = (candidates ?? []).find((c) => c.id === rejectId);
    updateStatus.mutate({
      id: rejectId,
      status: "rejected",
      fromStage: candidate?.status as PipelineStage | undefined,
      detail: rejectReason.trim(),
    });
    addNote.mutate({ candidateId: rejectId, stage: "rejected", note: `Rejection reason: ${rejectReason.trim()}` });
    setRejectId(null);
    setIsNoShow(false);
  };

  const addNote = trpc.notes.add.useMutation();

  // Blacklist from separated view
  const blacklistMutation = trpc.candidates.blacklist.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      toast.success("Candidate blacklisted");
      setBlacklistId(null);
      setBlacklistReason("");
    },
    onError: (e) => toast.error(e.message),
  });
  const [blacklistId, setBlacklistId] = useState<number | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [separatedStatusFilter, setSeparatedStatusFilter] = useState<"all" | "resigned" | "terminated">("all");

  // Bulk stage move state
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkTargetStage, setBulkTargetStage] = useState<PipelineStage>("whatsapp_sent");

  const handleBulkStageMove = async () => {
    const ids = Array.from(selected);
    // If target is rejected, close bulk confirm and open rejection reason dialog for bulk
    if (bulkTargetStage === "rejected") {
      setBulkStageOpen(false);
      setBulkRejectOpen(true);
      return;
    }
    setBulkStageOpen(false);
    const results = await Promise.allSettled(
      ids.map((id) => updateStatus.mutateAsync({ id, status: bulkTargetStage }))
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    clearSelection();
    if (succeeded > 0) toast.success(`Moved ${succeeded} candidate${succeeded > 1 ? "s" : ""} to ${STAGE_LABELS[bulkTargetStage]}`);
    if (failed > 0) toast.error(`${failed} candidate${failed > 1 ? "s" : ""} failed to update`);
  };

  // Bulk reject with reason
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkRejectIds, setBulkRejectIds] = useState<number[]>([]);

  const openBulkReject = () => {
    setBulkRejectIds(Array.from(selected));
    setBulkRejectReason("");
    setBulkRejectOpen(true);
  };

  const confirmBulkReject = async () => {
    if (!bulkRejectReason.trim()) { toast.error("Please enter a rejection reason"); return; }
    const results = await Promise.allSettled(
      bulkRejectIds.map(async (id) => {
        const candidate = (candidates ?? []).find((c) => c.id === id);
        await updateStatus.mutateAsync({
          id,
          status: "rejected",
          fromStage: candidate?.status as PipelineStage | undefined,
          detail: bulkRejectReason.trim(),
        });
        await addNote.mutateAsync({ candidateId: id, stage: "rejected", note: `Rejection reason: ${bulkRejectReason.trim()}` });
      })
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    clearSelection();
    setBulkRejectOpen(false);
    if (succeeded > 0) toast.success(`Rejected ${succeeded} candidate${succeeded > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} candidate${failed > 1 ? "s" : ""} failed to update`);
  };

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
  const [showRejected, setShowRejected] = useState(false);
  const [showSeparated, setShowSeparated] = useState(false);
  const [hiddenStages, setHiddenStages] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("candidates-hidden-stages");
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const toggleHideStage = (stage: string) => setHiddenStages((prev) => {
    const next = new Set(prev);
    if (next.has(stage)) next.delete(stage); else next.add(stage);
    try { localStorage.setItem("candidates-hidden-stages", JSON.stringify(Array.from(next))); } catch {}
    return next;
  });
  const { data: allActivity = [] } = trpc.activity.listAll.useQuery({ limit: 300 });
  const { data: batchAssignments = {} } = trpc.batches.allAssignments.useQuery();
  const [search, setSearch] = useState("");
  const [waveFilter, setWaveFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [hubspotImportOpen, setHubspotImportOpen] = useState(false);
  const [calendarImportOpen, setCalendarImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<{ name: string; email: string; phone: string; source: string; status: "new" | "duplicate" | "conflict"; existingName?: string }>>([]);
  const [importSelectedIds, setImportSelectedIds] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [form, setForm] = useState<CandidateForm>(EMPTY_FORM);
  const [csvRows, setCsvRows] = useState<CandidateForm[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Duplicate check for manual add form
  const [phoneCheckVal, setPhoneCheckVal] = useState("");
  const { data: dupCheck } = trpc.candidates.checkDuplicate.useQuery(
    { phone: phoneCheckVal },
    { enabled: phoneCheckVal.replace(/[^\d]/g, "").length >= 9 }
  );
  // CSV duplicate flagging
  type CsvRowWithDup = CandidateForm & { isDuplicate?: boolean; existingName?: string; existingStage?: string; isRejected?: boolean };
  const [csvRowsWithDups, setCsvRowsWithDups] = useState<CsvRowWithDup[]>([]);
  const [csvSkipDups, setCsvSkipDups] = useState(true);

  const allCandidates = candidates ?? [];
  // Derive unique wave numbers from all candidates for the filter dropdown
  const waveNumbers = Array.from(new Set(allCandidates.map((c) => (c as unknown as { wave?: number }).wave).filter(Boolean) as number[])).sort((a, b) => a - b);
  const filtered = allCandidates.filter((c) => {
    // If showSeparated is active, show resigned + terminated only
    if (showSeparated) {
      if (c.status !== "resigned" && c.status !== "terminated") return false;
      if (separatedStatusFilter !== "all" && c.status !== separatedStatusFilter) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if ((c.email ?? "").toLowerCase().includes(q)) return true;
      const qDigits = q.replace(/\D/g, "");
      const storedDigits = (c.phone ?? "").replace(/\D/g, "");
      if (qDigits.length >= 4 && storedDigits.endsWith(qDigits)) return true;
      if ((c.phone ?? "").toLowerCase().includes(q)) return true;
      return false;
    }
    // If showRejected is active, show rejected + blacklisted only
    if (showRejected) return c.status === "rejected" || c.status === "blacklisted";
    // Main pipeline: hide all former agents (resigned / terminated / blacklisted)
    if (c.status === "resigned" || c.status === "terminated" || c.status === "blacklisted") return false;
    const matchesSearch = !search || (() => {
      const q = search.toLowerCase();
      if (c.name.toLowerCase().includes(q)) return true;
      if ((c.email ?? "").toLowerCase().includes(q)) return true;
      // Phone suffix matching: strip non-digits from both query and stored number,
      // then check if the stored number ends with the query digits (handles partial entry)
      const qDigits = q.replace(/\D/g, "");
      const storedDigits = (c.phone ?? "").replace(/\D/g, "");
      if (qDigits.length >= 4 && storedDigits.endsWith(qDigits)) return true;
      // Fallback: plain substring match on raw phone string
      if ((c.phone ?? "").toLowerCase().includes(q)) return true;
      return false;
    })();
    const matchesWave = waveFilter === "all" || (c as unknown as { wave?: number }).wave === parseInt(waveFilter);
    return matchesSearch && matchesWave;
  });
  const rejectedCount = allCandidates.filter((c) => c.status === "rejected" || c.status === "blacklisted").length;
  const separatedCount = allCandidates.filter((c) => c.status === "resigned" || c.status === "terminated").length;

  const handleAddSubmit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    const ageNum = form.age ? parseInt(form.age) : undefined;
    if (form.age && (isNaN(ageNum!) || ageNum! < 16 || ageNum! > 80)) {
      toast.error("Age must be between 16 and 80"); return;
    }
    const waveNum = form.wave ? parseInt(form.wave) : undefined;
    if (form.wave && (isNaN(waveNum!) || waveNum! < 1)) {
      toast.error("Wave must be a positive number"); return;
    }
    createCandidate.mutate({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      positionApplied: form.positionApplied.trim(),
      notes: form.notes.trim() || undefined,
      status: form.status,
      age: ageNum,
      location: form.location.trim() || undefined,
      source: (form.source as "linkedin" | "email" | "referral" | "walk_in" | "other") || undefined,
      wave: waveNum,
    });
  };

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, phone: val });
    // Debounce: only trigger check when phone looks complete
    const digits = val.replace(/[^\d]/g, "");
    if (digits.length >= 9) setPhoneCheckVal(val);
    else setPhoneCheckVal("");
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
      const rows: CsvRowWithDup[] = [];
      let skipped = 0;
      const existingPhones = (candidates ?? []).map((c) => (c.phone ?? "").replace(/[^\d]/g, "").slice(-9));
      const rejectedPhones = (candidates ?? []).filter((c) => c.status === "rejected").map((c) => (c.phone ?? "").replace(/[^\d]/g, "").slice(-9));
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(?:"([^"]*)"|([^,]*))(?:,|$)/g)
          ?.map((c) => c.replace(/,$/, "").trim().replace(/^"|"$/g, "")) ?? lines[i].split(",").map((c) => c.trim());
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? (cols[idx] ?? "").trim() : "";
        };
        const name = get("name") || get("fullname") || get("candidatename") || cols[0]?.trim() || "";
        const email = get("email") || cols.find((c) => c.includes("@")) || "";
        const normalizePhone = (raw: string): string => {
          if (!raw) return "";
          let p = raw.replace(/[()\-\s]/g, "");
          if (/^020\d/.test(p)) p = "+20" + p.slice(3);
          if (/^00\d/.test(p)) p = "+" + p.slice(2);
          return p;
        };
        const phoneFromHeader = get("phone") || get("phonenumber") || get("mobile") || get("contact");
        const phoneFromScan = cols.find((c) => {
          const clean = c.replace(/[()\-\s]/g, "");
          return /^[+\d]{7,}$/.test(clean) && !c.includes("@");
        }) || "";
        const rawPhone = phoneFromHeader || phoneFromScan;
        const phone = normalizePhone(rawPhone);
        const positionApplied = get("position") || get("positionapplied") || get("role") || get("jobtitle") || "Call Center Agent";
        const location = get("location") || get("city") || get("address") || "";
        const rawSource = get("source") || get("channel") || "";
        const sourceMap: Record<string, string> = { linkedin: "linkedin", email: "email", referral: "referral", "walk-in": "walk_in", walkin: "walk_in", walk_in: "walk_in", other: "other" };
        const source = sourceMap[rawSource.toLowerCase()] || "";
        const rawAge = get("age") || "";
        const age = rawAge && !isNaN(parseInt(rawAge)) ? rawAge : "";
        const rawWave = get("wave") || "";
        const wave = rawWave && !isNaN(parseInt(rawWave)) && parseInt(rawWave) >= 1 ? rawWave : "";
        if (!name) { skipped++; continue; }
        // Duplicate detection
        const phoneSuffix = phone.replace(/[^\d]/g, "").slice(-9);
        const isDuplicate = existingPhones.includes(phoneSuffix);
        const isRejected = rejectedPhones.includes(phoneSuffix);
        const existing = isDuplicate ? (candidates ?? []).find((c) => (c.phone ?? "").replace(/[^\d]/g, "").slice(-9) === phoneSuffix) : undefined;
        rows.push({
          name, email, phone, positionApplied,
          notes: get("notes") || get("note"),
          status: "applied",
          age,
          location,
          source,
          wave,
          isDuplicate,
          isRejected,
          existingName: existing?.name,
          existingStage: existing?.status,
        });
      }
      if (rows.length === 0) { toast.error("No valid rows found. Make sure your CSV has a 'name' column with at least one non-empty value."); return; }
      if (skipped > 0) toast.info(`${skipped} row${skipped > 1 ? "s" : ""} skipped (missing name)`);
      const dupCount = rows.filter((r) => r.isDuplicate).length;
      if (dupCount > 0) toast.warning(`${dupCount} duplicate${dupCount > 1 ? "s" : ""} detected — review before importing`);
      setCsvRowsWithDups(rows);
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    const toImport = csvSkipDups
      ? csvRowsWithDups.filter((r) => !r.isDuplicate)
      : csvRowsWithDups;
    if (toImport.length === 0) { toast.error("No candidates to import after filtering duplicates"); return; }
    const isValidEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
    bulkImport.mutate(
      toImport.map((r) => ({
        name: r.name,
        email: r.email && isValidEmail(r.email) ? r.email : undefined,
        phone: r.phone || undefined,
        positionApplied: r.positionApplied,
        notes: r.notes || undefined,
        age: r.age ? parseInt(r.age) : undefined,
        location: r.location || undefined,
        source: (r.source as "linkedin" | "email" | "referral" | "walk_in" | "other") || undefined,
        wave: r.wave ? parseInt(r.wave) : undefined,
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
          <Button variant="outline" size="sm" onClick={() => {
            setImportPreview([]);
            setImportSelectedIds(new Set());
            setHubspotImportOpen(true);
          }} className="gap-2 h-9">
            <Building2 className="h-3.5 w-3.5" /> Import HubSpot
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setImportPreview([]);
            setImportSelectedIds(new Set());
            setCalendarImportOpen(true);
          }} className="gap-2 h-9">
            <Calendar className="h-3.5 w-3.5" /> Import Calendar
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
        {/* Wave filter */}
        {waveNumbers.length > 0 && (
          <Select value={waveFilter} onValueChange={setWaveFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="All Waves" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Waves</SelectItem>
              {waveNumbers.map((w) => (
                <SelectItem key={w} value={String(w)} className="text-xs">Wave {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button
          onClick={() => { setShowRejected((v) => !v); setShowSeparated(false); clearSelection(); }}
          className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            showRejected
              ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
              : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-red-300 hover:bg-red-50"
          }`}
        >
          <UserX className="h-3.5 w-3.5" />
          Rejected / Blacklisted{rejectedCount > 0 && <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold ${showRejected ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>{rejectedCount}</span>}
        </button>
        <button
          onClick={() => { setShowSeparated((v) => !v); setShowRejected(false); clearSelection(); }}
          className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            showSeparated
              ? "bg-orange-600 border-orange-600 text-white hover:bg-orange-700"
              : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-orange-300 hover:bg-orange-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Resigned / Terminated{separatedCount > 0 && <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold ${showSeparated ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"}`}>{separatedCount}</span>}
        </button>
        {!showRejected && (
          <Tabs value={view} onValueChange={(v) => { setView(v as "board" | "list"); clearSelection(); }}>
            <TabsList className="h-9">
              <TabsTrigger value="board" className="text-xs px-3">Board</TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3">List</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {/* Select All button — visible in board view */}
        {view === "board" && !showRejected && !showSeparated && (
          <button
            onClick={() => allFilteredSelected ? clearSelection() : toggleSelectAll(filteredIds)}
            className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              allFilteredSelected
                ? "bg-primary border-primary text-white hover:bg-primary/90"
                : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <Checkbox checked={allFilteredSelected} className="h-3 w-3 pointer-events-none" />
            {allFilteredSelected ? `Deselect All (${filteredIds.length})` : `Select All (${filteredIds.length})`}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl flex-wrap">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground flex-1">
            {selected.size} candidate{selected.size > 1 ? "s" : ""} selected
          </span>
          {/* Bulk Move to Stage */}
          <div className="flex items-center gap-1.5">
            <Select value={bulkTargetStage} onValueChange={(v) => setBulkTargetStage(v as PipelineStage)}>
              <SelectTrigger className="h-7 text-xs w-44 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setBulkStageOpen(true)}
            >
              <ArrowRight className="h-3 w-3" />
              Move
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
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
      ) : showSeparated ? (
        <div className="space-y-3">
          {/* Separated filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {(["all", "resigned", "terminated"] as const).map(f => (
                <button key={f} onClick={() => setSeparatedStatusFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    separatedStatusFilter === f
                      ? "bg-gray-800 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No {separatedStatusFilter === "all" ? "resigned or terminated" : separatedStatusFilter} candidates.</div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <button className="font-medium text-xs hover:underline text-left" onClick={() => navigate(`/candidates/${c.id}`)}>{c.name}</button>
                        {c.email && <p className="text-[10px] text-muted-foreground">{c.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          c.status === "resigned" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => { setBlacklistId(c.id); setBlacklistReason(""); }}>
                          <UserX className="h-3 w-3" /> Blacklist
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : showRejected ? (
        <CandidateList
          candidates={filtered}
          selected={selected}
          allSelected={allFilteredSelected}
          onClickCandidate={(id) => navigate(`/candidates/${id}`)}
          onDeleteCandidate={(id, name) => { setDeleteId(id); setDeleteName(name); }}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => toggleSelectAll(filteredIds)}
          batchAssignments={batchAssignments as Record<number, string>}
        />
      ) : view === "board" ? (
        <PipelineBoard
          candidates={filtered}
          selected={selected}
          hiddenStages={hiddenStages}
          onToggleHideStage={toggleHideStage}
          onMoveStage={(id, status) => {
            if (status === "rejected") { handleReject(id, filtered.find((c) => c.id === id)?.name ?? ""); }
            else {
              const candidate = filtered.find((c) => c.id === id);
              updateStatus.mutate({ id, status, fromStage: candidate?.status as PipelineStage | undefined });
            }
          }}
          onNoShow={(id, name) => handleNoShow(id, name)}
          onNoAnswer={(id) => handleNoAnswer(id, filtered.find((c) => c.id === id)?.status as PipelineStage)}
          onClickCandidate={(id) => navigate(`/candidates/${id}`)}
          onDeleteCandidate={(id, name) => { setDeleteId(id); setDeleteName(name); }}
          onToggleSelect={toggleSelect}
          batchAssignments={batchAssignments as Record<number, string>}
        />
      ) : view === "list" ? (
        <CandidateList
          candidates={filtered}
          selected={selected}
          allSelected={allFilteredSelected}
          onClickCandidate={(id) => navigate(`/candidates/${id}`)}
          onDeleteCandidate={(id, name) => { setDeleteId(id); setDeleteName(name); }}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => toggleSelectAll(filteredIds)}
          onReject={handleReject}
          onNoShow={handleNoShow}
          onMoveStage={(id, stage) => {
            const candidate = filtered.find((c) => c.id === id);
            updateStatus.mutate({ id, status: stage, fromStage: candidate?.status as PipelineStage | undefined });
          }}
          batchAssignments={batchAssignments as Record<number, string>}
        />
      ) : null}

      {/* Blacklist Dialog */}
      <Dialog open={blacklistId !== null} onOpenChange={(v) => { if (!v) { setBlacklistId(null); setBlacklistReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blacklist Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This will permanently mark the candidate as blacklisted and block them from re-entering the pipeline.</p>
            <div className="space-y-1.5">
              <Label>Reason for blacklisting <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="e.g. Misconduct, policy violation..."
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlacklistId(null); setBlacklistReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!blacklistReason.trim() || blacklistMutation.isPending}
              onClick={() => { if (blacklistId !== null) blacklistMutation.mutate({ id: blacklistId, reason: blacklistReason.trim() }); }}>
              {blacklistMutation.isPending ? "Blacklisting..." : "Confirm Blacklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Input placeholder="+20 100 000 0000" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} />
                {/* Duplicate warning */}
                {dupCheck && (
                  <div className={`flex items-start gap-2 rounded-lg p-2.5 text-xs mt-1 ${dupCheck.candidate?.status === "rejected" ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${dupCheck.candidate?.status === "rejected" ? "text-red-500" : "text-amber-500"}`} />
                    <div>
                      {dupCheck.candidate?.status === "rejected" ? (
                        <><strong>Previously rejected:</strong> {dupCheck.candidate.name} was rejected from this pipeline. Review their profile before re-adding.</>
                      ) : (
                        <><strong>Duplicate:</strong> {dupCheck.candidate?.name} already exists in the pipeline at stage <strong>{dupCheck.candidate?.status?.replace(/_/g, " ")}</strong>.</>
                      )}
                    </div>
                  </div>
                )}
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
              <Label>Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="number" min={16} max={80} placeholder="e.g. 24" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Cairo" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Source <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.source || "none"} onValueChange={(v) => setForm({ ...form, source: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="How did they apply?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not specified —</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Wave <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="number" min={1} placeholder="e.g. 1" value={form.wave} onChange={(e) => setForm({ ...form, wave: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
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

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectId !== null} onOpenChange={(open) => { if (!open) { setRejectId(null); setIsNoShow(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNoShow ? "Mark as No-Show" : "Reject Candidate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {isNoShow
                ? <><strong>{rejectName}</strong> will be marked as a no-show and rejected from the pipeline.</>  
                : <>You are rejecting <strong>{rejectName}</strong>. A reason is required and will be saved to their profile.</>}
            </p>
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Did not meet language requirements"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus={!isNoShow}
              />
              <p className="text-xs text-muted-foreground">This will be logged in the candidate's activity timeline.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setIsNoShow(false); }}>Cancel</Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmReject}
              disabled={!rejectReason.trim()}
            >
              {isNoShow ? "Confirm No-Show" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Stage Move Confirmation */}
      <AlertDialog open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selected.size} Candidates</AlertDialogTitle>
            <AlertDialogDescription>
              Move <strong>{selected.size} selected candidate{selected.size > 1 ? "s" : ""}</strong> to <strong>{STAGE_LABELS[bulkTargetStage]}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStageMove}>
              Move {selected.size} Candidates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reject with Reason Dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={(open) => { if (!open) setBulkRejectOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {bulkRejectIds.length} Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">You are rejecting <strong>{bulkRejectIds.length} candidates</strong>. A reason is required and will be saved to each candidate's profile.</p>
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Did not meet language requirements"
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">This will be logged in each candidate's activity timeline.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)}>Cancel</Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmBulkReject}
              disabled={!bulkRejectReason.trim()}
            >
              Reject {bulkRejectIds.length} Candidates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {csvRowsWithDups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {csvRowsWithDups.length} candidates ready
                    {csvRowsWithDups.filter((r) => r.isDuplicate).length > 0 && (
                      <span className="ml-2 text-amber-600 font-normal text-xs">
                        ({csvRowsWithDups.filter((r) => r.isDuplicate).length} duplicates detected)
                      </span>
                    )}
                  </p>
                  {csvRowsWithDups.some((r) => r.isDuplicate) && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={csvSkipDups}
                        onChange={(e) => setCsvSkipDups(e.target.checked)}
                        className="rounded"
                      />
                      Skip duplicates ({csvRowsWithDups.filter((r) => r.isDuplicate).length})
                    </label>
                  )}
                </div>
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRowsWithDups.map((r, i) => (
                        <tr key={i} className={`border-t border-border ${r.isDuplicate ? (r.isRejected ? "bg-red-50" : "bg-amber-50") : ""}`}>
                          <td className="px-3 py-2 font-medium">
                            {r.name}
                            {r.isRejected && <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 rounded px-1 py-0.5">Prev. Rejected</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                          <td className="px-3 py-2">
                            {r.isDuplicate ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Exists as {r.existingName}
                              </span>
                            ) : (
                              <span className="text-emerald-600">New</span>
                            )}
                          </td>
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
            <Button onClick={handleImportConfirm} disabled={csvRowsWithDups.length === 0 || bulkImport.isPending}>
              {bulkImport.isPending ? "Importing..." : `Import ${csvSkipDups ? csvRowsWithDups.filter((r) => !r.isDuplicate).length : csvRowsWithDups.length} Candidates`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HubSpot Import Dialog */}
      <Dialog open={hubspotImportOpen} onOpenChange={(v) => { setHubspotImportOpen(v); if (!v) { setImportPreview([]); setImportSelectedIds(new Set()); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-600" /> Import from HubSpot CRM
            </DialogTitle>
          </DialogHeader>
          <HubSpotImportPanel
            preview={importPreview}
            setPreview={setImportPreview}
            selectedIds={importSelectedIds}
            setSelectedIds={setImportSelectedIds}
            loading={importLoading}
            setLoading={setImportLoading}
            onClose={() => setHubspotImportOpen(false)}
            onImported={() => { utils.candidates.list.invalidate(); setHubspotImportOpen(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* Google Calendar Import Dialog */}
      <Dialog open={calendarImportOpen} onOpenChange={(v) => { setCalendarImportOpen(v); if (!v) { setImportPreview([]); setImportSelectedIds(new Set()); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" /> Import from Google Calendar
            </DialogTitle>
          </DialogHeader>
          <CalendarImportPanel
            preview={importPreview}
            setPreview={setImportPreview}
            selectedIds={importSelectedIds}
            setSelectedIds={setImportSelectedIds}
            loading={importLoading}
            setLoading={setImportLoading}
            onClose={() => setCalendarImportOpen(false)}
            onImported={() => { utils.candidates.list.invalidate(); setCalendarImportOpen(false); }}
          />
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
  subStatus?: string | null;
  createdAt: Date;
  wave?: number | null;
};

function PipelineBoard({
  candidates,
  selected,
  onMoveStage,
  onNoShow,
  onNoAnswer,
  onClickCandidate,
  onDeleteCandidate,
  onToggleSelect,
  batchAssignments = {},
  hiddenStages = new Set(),
  onToggleHideStage,
}: {
  candidates: CandidateRow[];
  selected: Set<number>;
  onMoveStage: (id: number, stage: PipelineStage) => void;
  onNoShow: (id: number, name: string) => void;
  onNoAnswer: (id: number) => void;
  onClickCandidate: (id: number) => void;
  onDeleteCandidate: (id: number, name: string) => void;
  onToggleSelect: (id: number) => void;
  batchAssignments?: Record<number, string>;
  hiddenStages?: Set<string>;
  onToggleHideStage?: (stage: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {ACTIVE_STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c) => c.status === stage);
        const isHidden = hiddenStages.has(stage);
        return (
          <div key={stage} className={`flex-shrink-0 rounded-xl border flex flex-col transition-all ${
            isHidden ? "w-12 " + STAGE_BG[stage] : "w-64 " + STAGE_BG[stage]
          }`}>
            {isHidden ? (
              // Collapsed column — vertical label + count
              <button
                onClick={() => onToggleHideStage?.(stage)}
                className="flex flex-col items-center justify-center gap-2 py-4 flex-1 w-full hover:bg-black/5 transition-colors rounded-xl"
                title={`Show ${STAGE_LABELS[stage]}`}
              >
                <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                <span
                  className="text-xs font-semibold text-foreground"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
                >
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-xs font-medium text-muted-foreground bg-white/60 rounded-full px-1.5 py-0.5">
                  {stageCandidates.length}
                </span>
              </button>
            ) : (
              <>
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                    <span className="text-xs font-semibold text-foreground">{STAGE_LABELS[stage]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground bg-white/60 rounded-full px-2 py-0.5">
                      {stageCandidates.length}
                    </span>
                    <button
                      onClick={() => onToggleHideStage?.(stage)}
                      className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 transition-colors"
                      title="Hide column"
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>
                  </div>
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
                        onNoShow={onNoShow}
                        onNoAnswer={onNoAnswer}
                        onClick={() => onClickCandidate(c.id)}
                        onDelete={() => onDeleteCandidate(c.id, c.name)}
                        onToggleSelect={() => onToggleSelect(c.id)}
                        batchName={batchAssignments[c.id]}
                      />
                    ))
                  )}
                </div>
              </>
            )}
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
  onNoShow,
  onNoAnswer,
  onClick,
  onDelete,
  onToggleSelect,
  batchName,
}: {
  candidate: CandidateRow;
  currentStage: PipelineStage;
  isSelected: boolean;
  onMoveStage: (id: number, stage: PipelineStage) => void;
  onNoShow: (id: number, name: string) => void;
  onNoAnswer: (id: number) => void;
  onClick: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
  batchName?: string;
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
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs font-semibold text-foreground truncate">{candidate.name}</p>
            {candidate.wave && (
              <span className="text-[9px] font-bold px-1 py-0 rounded bg-indigo-100 text-indigo-700 shrink-0">W{candidate.wave}</span>
            )}
            {batchName && (
              <span className="text-[9px] font-bold px-1 py-0 rounded bg-emerald-100 text-emerald-700 shrink-0">{batchName}</span>
            )}

          </div>
          <p className="text-[10px] text-muted-foreground truncate">{candidate.phone || candidate.email || "—"}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              const phone = candidate.phone || "";
              const msg = `Hi ${candidate.name}! 👋 This is Tanis BPO. We came across your profile and would love to tell you about an exciting Call Center Agent opportunity with us. We'd like to know more about you — could you please send us a short voice note introducing yourself and your sales experience? Looking forward to hearing from you! 😊`;
              const url = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`;
              window.open(url, "_blank");
            }}
            className="p-1 rounded hover:bg-green-50 text-muted-foreground/40 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Open WhatsApp chat"
          >
            <MessageCircle className="h-3 w-3" />
          </button>
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
        {/* No Show — shown when candidate has an interview scheduled */}
        {currentStage === "interview_scheduled" && (
          <button
            onClick={() => onNoShow(candidate.id, candidate.name)}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 flex items-center gap-0.5"
            title="Mark as no-show"
          >
            <UserX className="h-2 w-2" /> No Show
          </button>
        )}
        {/* No Answer — move to no_answer stage (or back to whatsapp_sent if already there) */}
        {currentStage === "whatsapp_sent" && (
          <button
            onClick={() => onNoAnswer(candidate.id)}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100 flex items-center gap-0.5"
            title="Mark as No Answer — candidate did not respond to WhatsApp"
          >
            <Clock className="h-2 w-2" /> No Answer
          </button>
        )}
        {/* Move back to WhatsApp Sent from No Answer */}
        {currentStage === "no_answer" && (
          <button
            onClick={() => onNoAnswer(candidate.id)}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 transition-colors hover:bg-green-100 flex items-center gap-0.5"
            title="Move back to WhatsApp Sent"
          >
            <MessageCircle className="h-2 w-2" /> ← WA Sent
          </button>
        )}
        {/* WhatsApp Sent — shown when candidate is in Applied stage */}
        {currentStage === "applied" && (
          <button
            onClick={() => onMoveStage(candidate.id, "whatsapp_sent")}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 transition-colors hover:bg-green-100 flex items-center gap-0.5"
            title="Mark WhatsApp message as sent"
          >
            <MessageCircle className="h-2 w-2" /> WA Sent
          </button>
        )}
        {/* Interview Scheduled — shown when candidate is in Voice Note Reviewed stage */}
        {currentStage === "voice_note_reviewed" && (
          <button
            onClick={() => onMoveStage(candidate.id, "interview_scheduled")}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100 flex items-center gap-0.5"
            title="Mark as Interview Scheduled"
          >
            <ArrowRight className="h-2 w-2" /> Interview Scheduled
          </button>
        )}
        {/* Skip to Interview shortcut — shown when candidate is in Applied, WhatsApp Sent, or No Answer stage */}
        {["applied", "whatsapp_sent", "no_answer"].includes(currentStage) && (
          <button
            onClick={() => onMoveStage(candidate.id, "interview_scheduled")}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 flex items-center gap-0.5"
            title="Skip directly to Interview Scheduled"
          >
            <ArrowRight className="h-2 w-2" /> Skip to Interview
          </button>
        )}
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
  onReject,
  onNoShow,
  onMoveStage,
  batchAssignments = {},
}: {
  candidates: CandidateRow[];
  selected: Set<number>;
  allSelected: boolean;
  onClickCandidate: (id: number) => void;
  onDeleteCandidate: (id: number, name: string) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onReject?: (id: number, name: string) => void;
  onNoShow?: (id: number, name: string) => void;
  onMoveStage?: (id: number, stage: PipelineStage) => void;
  batchAssignments?: Record<number, string>;
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
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="font-medium text-foreground text-xs">{c.name}</p>
                      {c.wave && (
                        <span className="text-[9px] font-bold px-1 py-0 rounded bg-indigo-100 text-indigo-700">W{c.wave}</span>
                      )}
                      {batchAssignments[c.id] && (
                        <span className="text-[9px] font-bold px-1 py-0 rounded bg-emerald-100 text-emerald-700">{batchAssignments[c.id]}</span>
                      )}
                    </div>
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
                  {/* No Show — shown for interview_scheduled candidates */}
                  {c.status === "interview_scheduled" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNoShow && onNoShow(c.id, c.name); }}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground/30 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Mark as no-show"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* WA Sent — shown for Applied candidates */}
                  {c.status === "applied" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveStage && onMoveStage(c.id, "whatsapp_sent"); }}
                      className="p-1 rounded hover:bg-green-50 text-muted-foreground/30 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Mark WhatsApp message as sent"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Interview Scheduled — shown for Voice Note Reviewed candidates */}
                  {c.status === "voice_note_reviewed" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveStage && onMoveStage(c.id, "interview_scheduled"); }}
                      className="p-1 rounded hover:bg-purple-50 text-muted-foreground/30 hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Mark as Interview Scheduled"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Skip to Interview — shown for Applied or WhatsApp Sent candidates */}
                  {["applied", "whatsapp_sent"].includes(c.status) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveStage && onMoveStage(c.id, "interview_scheduled"); }}
                      className="p-1 rounded hover:bg-blue-50 text-muted-foreground/30 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Skip to Interview Scheduled"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const phone = c.phone || "";
                      const msg = `Hi ${c.name}! 👋 This is Tanis BPO. We came across your profile and would love to tell you about an exciting Call Center Agent opportunity with us. We'd like to know more about you — could you please send us a short voice note introducing yourself and your sales experience? Looking forward to hearing from you! 😊`;
                      const url = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`;
                      window.open(url, "_blank");
                    }}
                    className="p-1 rounded hover:bg-green-50 text-muted-foreground/30 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Open WhatsApp chat"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
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

// ─── Import Preview Row Type ──────────────────────────────────────────────────
type ImportPreviewRow = {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: "new" | "duplicate" | "conflict";
  existingName?: string;
};

// ─── HubSpot Import Panel ─────────────────────────────────────────────────────
function HubSpotImportPanel({
  preview,
  setPreview,
  selectedIds,
  setSelectedIds,
  loading,
  setLoading,
  onClose,
  onImported,
}: {
  preview: ImportPreviewRow[];
  setPreview: (rows: ImportPreviewRow[]) => void;
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number>) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onClose: () => void;
  onImported: () => void;
}) {
  const utils = trpc.useUtils();
  // Store raw hubspot data alongside preview rows
  type HubSpotRow = ImportPreviewRow & { hubspotId: string; stage: string };
  const [hsRows, setHsRows] = useState<HubSpotRow[]>([]);

  const doImport = trpc.hubspot.importContacts.useMutation({
    onSuccess: (data: { imported: number }) => {
      toast.success(`Imported ${data.imported} candidates`);
      onImported();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const handleFetch = async () => {
    setLoading(true);
    try {
      const result = await utils.client.hubspot.previewContacts.query({ limit: 100 });
      const rows: HubSpotRow[] = result.contacts.map((c: { hubspotId: string; name: string; email: string; phone: string; stage: string; status: "new" | "duplicate" | "conflict"; }) => ({
        hubspotId: c.hubspotId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        source: "HubSpot",
        status: c.status,
        stage: c.stage,
      }));
      setHsRows(rows);
      setPreview(rows);
      const newIds = new Set(rows.map((_, i) => i).filter((i) => rows[i].status === "new"));
      setSelectedIds(newIds);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (i: number) => {
    const next = new Set(selectedIds);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedIds(next);
  };

  const handleImport = () => {
    const rows = Array.from(selectedIds).map((i) => hsRows[i]).filter(Boolean);
    doImport.mutate({ contacts: rows.map((r) => ({ hubspotId: r.hubspotId, name: r.name, email: r.email, phone: r.phone, stage: r.stage })) });
  };

  const statusBadge = (s: ImportPreviewRow["status"]) => {
    if (s === "new") return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">New</span>;
    if (s === "duplicate") return <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Duplicate</span>;
    return <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Conflict</span>;
  };

  return (
    <div className="space-y-4 py-2">
      {preview.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Click "Fetch Contacts" to preview HubSpot contacts before importing.</p>
          <p className="text-xs text-muted-foreground">Duplicates are detected by phone number and email.</p>
          <Button onClick={() => handleFetch()} disabled={loading} className="mt-2">
            {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Fetching...</> : "Fetch Contacts"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{preview.length} contacts fetched — {preview.filter(r => r.status === "new").length} new, {preview.filter(r => r.status === "duplicate").length} duplicates</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const newIds = new Set(preview.map((_, i) => i).filter((i) => preview[i].status === "new"));
                setSelectedIds(newIds);
              }}>Select New Only</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(preview.map((_, i) => i)))}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Deselect All</Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={`border-t ${selectedIds.has(i) ? "bg-primary/5" : ""} ${row.status === "duplicate" ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={selectedIds.has(i)} onCheckedChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.phone || "—"}</td>
                    <td className="px-3 py-2">{statusBadge(row.status)}{row.existingName && <span className="ml-1 text-muted-foreground">({row.existingName})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={selectedIds.size === 0 || doImport.isPending}>
              {doImport.isPending ? "Importing..." : `Import ${selectedIds.size} Candidates`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Google Calendar Import Panel ─────────────────────────────────────────────
function CalendarImportPanel({
  preview,
  setPreview,
  selectedIds,
  setSelectedIds,
  loading,
  setLoading,
  onClose,
  onImported,
}: {
  preview: ImportPreviewRow[];
  setPreview: (rows: ImportPreviewRow[]) => void;
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number>) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onClose: () => void;
  onImported: () => void;
}) {
  // Date range state
  const today = new Date().toISOString().slice(0, 10);
  const [datePreset, setDatePreset] = useState<"tomorrow" | "today" | "yesterday" | "2days" | "7days" | "30days" | "custom">("2days");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  // Raw events from backend (needed for proper import with meetLink etc.)
  type CalEvent = { eventId: string; candidateName: string; candidateEmail: string; candidatePhone: string; interviewDate: string; meetLink: string; status: "new" | "duplicate"; matchedId?: number };
  const [rawEvents, setRawEvents] = useState<CalEvent[]>([]);

  const doImport = trpc.integrations.importCalendarEvents.useMutation({
    onSuccess: (data: { imported: number }) => {
      toast.success(`Imported ${data.imported} candidates from calendar`);
      onImported();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const doPreview = trpc.integrations.previewCalendarEvents.useMutation({
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  // Compute date range from preset
  const getDateRange = () => {
    const d = new Date();
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
    if (datePreset === "tomorrow") { const t = new Date(d); t.setDate(t.getDate() + 1); return { dateFrom: fmt(t), dateTo: fmt(t) }; }
    if (datePreset === "today") return { dateFrom: fmt(d), dateTo: fmt(d) };
    if (datePreset === "yesterday") { const y = new Date(d); y.setDate(y.getDate() - 1); return { dateFrom: fmt(y), dateTo: fmt(y) }; }
    if (datePreset === "2days") { const f = new Date(d); f.setDate(f.getDate() - 2); return { dateFrom: fmt(f), dateTo: fmt(d) }; }
    if (datePreset === "7days") { const f = new Date(d); f.setDate(f.getDate() - 7); return { dateFrom: fmt(f), dateTo: fmt(d) }; }
    if (datePreset === "30days") { const f = new Date(d); f.setDate(f.getDate() - 30); return { dateFrom: fmt(f), dateTo: fmt(d) }; }
    return { dateFrom: customFrom, dateTo: customTo };
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      const result = await doPreview.mutateAsync(range);
      setRawEvents(result.events);
      const rows: ImportPreviewRow[] = result.events.map((e: CalEvent) => ({
        name: e.candidateName,
        email: e.candidateEmail,
        phone: e.candidatePhone,
        source: e.interviewDate ? `Interview ${new Date(e.interviewDate).toLocaleDateString()}` : "Calendar",
        status: e.status === "duplicate" ? "duplicate" : "new",
      }));
      setPreview(rows);
      const newIds = new Set(rows.map((_, i) => i).filter((i) => rows[i].status === "new"));
      setSelectedIds(newIds);
    } catch {
      // error handled by onError above
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (i: number) => {
    const next = new Set(selectedIds);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedIds(next);
  };

  const handleImport = () => {
    const selectedRaw = Array.from(selectedIds).map((i) => rawEvents[i]).filter(Boolean);
    doImport.mutate({ events: selectedRaw.map(e => ({
      eventId: e.eventId,
      candidateName: e.candidateName,
      candidateEmail: e.candidateEmail,
      candidatePhone: e.candidatePhone,
      interviewDate: e.interviewDate,
      meetLink: e.meetLink,
    })) });
  };

  const statusBadge = (s: ImportPreviewRow["status"]) => {
    if (s === "new") return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">New</span>;
    if (s === "duplicate") return <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Duplicate</span>;
    return <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Conflict</span>;
  };

  const PRESETS = [
    { key: "tomorrow", label: "Tomorrow" },
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "2days", label: "Last 2 days" },
    { key: "7days", label: "Last 7 days" },
    { key: "30days", label: "Last 30 days" },
    { key: "custom", label: "Custom" },
  ] as const;

  return (
    <div className="space-y-4 py-2">
      {/* Date range filter */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter by Interview Date</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                datePreset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >{p.label}</button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>
        )}
      </div>

      {preview.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Fetches interview events from your connected Google Calendar within the selected date range.</p>
          <p className="text-xs text-muted-foreground">Extracts candidate name, email, and phone from event attendees and description.</p>
          {loading ? (
            <Button disabled><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Fetching...</Button>
          ) : (
            <Button onClick={handleFetch}>Fetch Calendar Events</Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">{preview.length} interview events found — {preview.filter(r => r.status === "new").length} new candidates</p>
              <button onClick={() => { setPreview([]); setRawEvents([]); setSelectedIds(new Set()); }} className="text-xs text-primary hover:underline">← Change date range</button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const newIds = new Set(preview.map((_, i) => i).filter((i) => preview[i].status === "new"));
                setSelectedIds(newIds);
              }}>Select New Only</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(preview.map((_, i) => i)))}>Select All</Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Interview Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={`border-t ${selectedIds.has(i) ? "bg-primary/5" : ""} ${row.status === "duplicate" ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={selectedIds.has(i)} onCheckedChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.phone || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.source}</td>
                    <td className="px-3 py-2">{statusBadge(row.status)}{row.existingName && <span className="ml-1 text-muted-foreground">({row.existingName})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={selectedIds.size === 0 || doImport.isPending}>
              {doImport.isPending ? "Importing..." : `Import ${selectedIds.size} Candidates`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
