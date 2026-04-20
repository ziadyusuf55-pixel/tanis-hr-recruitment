import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  Users,
  Trash2,
  ChevronRight,
  UserMinus,
  UserPlus,
  GraduationCap,
  Calendar,
  User,
  ArrowLeft,
  Search,
  Hash,
  Pencil,
  Check,
  X,
  Copy,
  Phone,
  MessageSquare,
  ClipboardList,
  CalendarRange,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type Batch = {
  id: number;
  name: string;
  trainerName: string | null;
  startDate: number | null;
  endDate: number | null;
  notes: string | null;
  batchNotes: string | null;
  candidateCount: number;
  createdAt: Date;
};

type BatchCandidate = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  wave: number | null;
  traineeCode?: string | null;
  trainerNotes?: string | null;
  attendedSessions?: number;
  totalSessions?: number;
};

const EMPTY_FORM = { name: "", trainerName: "", startDate: "", endDate: "", notes: "", batchNotes: "" };

export default function Training() {
  const utils = trpc.useUtils();

  // Batch list
  const { data: batches = [], isLoading } = trpc.batches.list.useQuery();

  // Selected batch detail
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const { data: batchCandidates = [] } = trpc.batches.listCandidates.useQuery(
    { batchId: selectedBatchId! },
    { enabled: selectedBatchId !== null }
  );
  const selectedBatch = batches.find((b) => b.id === selectedBatchId) as Batch | undefined;

  // WhatsApp Group Added candidates can be assigned to training batches
  const { data: allCandidates = [] } = trpc.candidates.list.useQuery();
  const eligibleCandidates = (allCandidates as unknown as BatchCandidate[]).filter(
    (c) => c.status === "whatsapp_group_added" || c.status === "accepted"
  );

  // Mutations
  const createBatch = trpc.batches.create.useMutation({
    onSuccess: () => { utils.batches.list.invalidate(); toast.success("Batch created"); setCreateOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBatch = trpc.batches.delete.useMutation({
    onSuccess: () => { utils.batches.list.invalidate(); toast.success("Batch deleted"); setSelectedBatchId(null); setDeleteBatchId(null); },
    onError: (e) => toast.error(e.message),
  });
  const assignCandidate = trpc.batches.assignCandidate.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); utils.batches.list.invalidate(); toast.success("Agent assigned to batch"); },
    onError: (e) => toast.error(e.message),
  });
  const removeCandidate = trpc.batches.removeCandidate.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); utils.batches.list.invalidate(); toast.success("Agent removed from batch"); },
    onError: (e) => toast.error(e.message),
  });
  const setTraineeCode = trpc.batches.setTraineeCode.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); toast.success("Trainee code saved"); },
    onError: (e) => toast.error(e.message),
  });
  const setTrainerNotes = trpc.batches.setTrainerNotes.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); toast.success("Notes saved"); },
    onError: (e) => toast.error(e.message),
  });
  const setAttendance = trpc.batches.setAttendance.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); toast.success("Attendance updated"); },
    onError: (e) => toast.error(e.message),
  });
  const updateBatchNotes = trpc.batches.updateBatchNotes.useMutation({
    onSuccess: () => { utils.batches.list.invalidate(); toast.success("Batch notes saved"); setEditingBatchNotes(false); },
    onError: (e) => toast.error(e.message),
  });

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteBatchId, setDeleteBatchId] = useState<number | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  // Trainee code inline editing
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");

  // Trainer notes inline editing
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");

  // Attendance inline editing
  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null);
  const [editingAttended, setEditingAttended] = useState("");
  const [editingTotal, setEditingTotal] = useState("");

  // Batch notes editing
  const [editingBatchNotes, setEditingBatchNotes] = useState(false);
  const [batchNotesValue, setBatchNotesValue] = useState("");

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Batch name is required"); return; }
    createBatch.mutate({
      name: form.name.trim(),
      trainerName: form.trainerName.trim() || undefined,
      startDate: form.startDate ? new Date(form.startDate).getTime() : undefined,
      endDate: form.endDate ? new Date(form.endDate).getTime() : undefined,
      notes: form.notes.trim() || undefined,
      batchNotes: form.batchNotes.trim() || undefined,
    });
  };

  const handleSaveCode = (candidateId: number) => {
    if (!selectedBatchId) return;
    setTraineeCode.mutate({ batchId: selectedBatchId, candidateId, code: editingCodeValue.trim() || null });
    setEditingCodeId(null);
    setEditingCodeValue("");
  };

  const handleSaveNotes = (candidateId: number) => {
    if (!selectedBatchId) return;
    setTrainerNotes.mutate({ batchId: selectedBatchId, candidateId, notes: editingNotesValue.trim() || null });
    setEditingNotesId(null);
    setEditingNotesValue("");
  };

  const handleSaveAttendance = (candidateId: number) => {
    if (!selectedBatchId) return;
    const attended = parseInt(editingAttended) || 0;
    const total = parseInt(editingTotal) || 0;
    setAttendance.mutate({ batchId: selectedBatchId, candidateId, attendedSessions: attended, totalSessions: total });
    setEditingAttendanceId(null);
  };

  const handleCopyPhones = () => {
    const phones = (batchCandidates as BatchCandidate[])
      .map((c) => c.phone)
      .filter(Boolean)
      .join("\n");
    if (!phones) { toast.error("No phone numbers available"); return; }
    navigator.clipboard.writeText(phones).then(() => {
      toast.success(`Copied ${(batchCandidates as BatchCandidate[]).filter(c => c.phone).length} phone numbers`);
    });
  };

  // Candidates not yet in this batch
  const assignedIds = new Set((batchCandidates as BatchCandidate[]).map((c) => c.id));
  const assignableCandidates = eligibleCandidates.filter((c) => {
    if (assignedIds.has(c.id)) return false;
    if (!assignSearch) return true;
    const q = assignSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  // Batch detail view
  if (selectedBatchId !== null && selectedBatch) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBatchId(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Batches
          </Button>
        </div>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              {selectedBatch.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {selectedBatch.trainerName && (
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {selectedBatch.trainerName}</span>
              )}
              {selectedBatch.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(selectedBatch.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {selectedBatch.endDate && (
                    <> → {new Date(selectedBatch.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {batchCandidates.length} agents</span>
            </div>
            {selectedBatch.notes && (
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">{selectedBatch.notes}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={handleCopyPhones} className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50">
              <Phone className="h-4 w-4" /> Copy Phones
            </Button>
            <Button size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setDeleteBatchId(selectedBatch.id)}
            >
              <Trash2 className="h-4 w-4" /> Delete Batch
            </Button>
          </div>
        </div>

        {/* Batch Notes (what has been completed / not) */}
        <div className="mb-5 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />
              Training Progress Notes
            </h3>
            {!editingBatchNotes && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => { setEditingBatchNotes(true); setBatchNotesValue(selectedBatch.batchNotes ?? ""); }}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
          {editingBatchNotes ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                rows={4}
                placeholder="e.g. Week 1: Product knowledge ✓&#10;Week 2: CRM training ✓&#10;Week 3: Live calls — pending"
                value={batchNotesValue}
                onChange={(e) => setBatchNotesValue(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingBatchNotes(false)}>Cancel</Button>
                <Button size="sm" onClick={() => updateBatchNotes.mutate({ id: selectedBatch.id, batchNotes: batchNotesValue.trim() || null })} disabled={updateBatchNotes.isPending}>
                  Save Notes
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {selectedBatch.batchNotes || <span className="italic">No progress notes yet. Click Edit to add what has been completed.</span>}
            </p>
          )}
        </div>

        {/* Agents table */}
        {batchCandidates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No agents assigned yet</p>
            <p className="text-sm mt-1">Click "Add Agent" to assign agents from the WhatsApp Group Added stage</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Wave</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Code</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Attendance</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Trainer Notes</span>
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(batchCandidates as BatchCandidate[]).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors group/row">
                    {/* Name */}
                    <td className="px-4 py-3 font-medium">{c.name}</td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.phone ?? "—"}</td>

                    {/* Wave */}
                    <td className="px-4 py-3">
                      {c.wave ? (
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">W{c.wave}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Trainee Code */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 group/code">
                        {editingCodeId === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              className="h-7 w-28 text-xs"
                              placeholder="e.g. T-001"
                              value={editingCodeValue}
                              onChange={(e) => setEditingCodeValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveCode(c.id);
                                if (e.key === "Escape") { setEditingCodeId(null); setEditingCodeValue(""); }
                              }}
                            />
                            <button onClick={() => handleSaveCode(c.id)} className="p-1 rounded hover:bg-green-50 text-green-600" title="Save">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { setEditingCodeId(null); setEditingCodeValue(""); }} className="p-1 rounded hover:bg-red-50 text-red-500" title="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {c.traineeCode ? (
                              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">{c.traineeCode}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Not set</span>
                            )}
                            <button
                              onClick={() => { setEditingCodeId(c.id); setEditingCodeValue(c.traineeCode ?? ""); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover/code:opacity-100 transition-opacity"
                              title="Edit code"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Attendance */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 group/att">
                        {editingAttendanceId === c.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              type="number"
                              min={0}
                              className="h-7 w-14 text-xs text-center"
                              placeholder="0"
                              value={editingAttended}
                              onChange={(e) => setEditingAttended(e.target.value)}
                            />
                            <span className="text-muted-foreground text-xs">/</span>
                            <Input
                              type="number"
                              min={0}
                              className="h-7 w-14 text-xs text-center"
                              placeholder="0"
                              value={editingTotal}
                              onChange={(e) => setEditingTotal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveAttendance(c.id);
                                if (e.key === "Escape") setEditingAttendanceId(null);
                              }}
                            />
                            <button onClick={() => handleSaveAttendance(c.id)} className="p-1 rounded hover:bg-green-50 text-green-600" title="Save">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingAttendanceId(null)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {(c.totalSessions ?? 0) > 0 ? (
                              <span className={`text-xs font-medium ${(c.attendedSessions ?? 0) >= (c.totalSessions ?? 1) ? "text-emerald-600" : "text-amber-600"}`}>
                                {c.attendedSessions ?? 0}/{c.totalSessions ?? 0}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Not set</span>
                            )}
                            <button
                              onClick={() => {
                                setEditingAttendanceId(c.id);
                                setEditingAttended(String(c.attendedSessions ?? 0));
                                setEditingTotal(String(c.totalSessions ?? 0));
                              }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover/att:opacity-100 transition-opacity"
                              title="Edit attendance"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Trainer Notes */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="flex items-start gap-1.5 group/notes">
                        {editingNotesId === c.id ? (
                          <div className="flex flex-col gap-1.5 w-full">
                            <Textarea
                              autoFocus
                              rows={2}
                              className="text-xs min-h-[56px]"
                              placeholder="Trainer notes..."
                              value={editingNotesValue}
                              onChange={(e) => setEditingNotesValue(e.target.value)}
                            />
                            <div className="flex gap-1">
                              <button onClick={() => handleSaveNotes(c.id)} className="p-1 rounded hover:bg-green-50 text-green-600" title="Save">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => { setEditingNotesId(null); setEditingNotesValue(""); }} className="p-1 rounded hover:bg-red-50 text-red-500" title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {c.trainerNotes ? (
                              <span className="text-xs text-foreground line-clamp-2 flex-1">{c.trainerNotes}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">No notes</span>
                            )}
                            <button
                              onClick={() => { setEditingNotesId(c.id); setEditingNotesValue(c.trainerNotes ?? ""); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover/notes:opacity-100 transition-opacity shrink-0"
                              title="Edit notes"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeCandidate.mutate({ batchId: selectedBatch.id, candidateId: c.id })}
                        title="Remove from batch"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Assign candidate dialog */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Agent to {selectedBatch.name}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-2 mb-3">Showing accepted & WhatsApp Group Added candidates</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                className="pl-9"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {assignableCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {eligibleCandidates.length === 0
                    ? "No accepted or WhatsApp Group Added agents available"
                    : "All eligible agents are already assigned or no matches"}
                </p>
              ) : (
                assignableCandidates.map((c) => (
                  <button
                    key={c.id}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/60 transition-colors text-left"
                    onClick={() => {
                      assignCandidate.mutate({ batchId: selectedBatch.id, candidateId: c.id });
                      setAssignOpen(false);
                      setAssignSearch("");
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "No contact"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.wave && (
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">W{c.wave}</Badge>
                      )}
                      {c.status === "whatsapp_group_added" && (
                        <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">WA Group</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete batch confirm */}
        <AlertDialog open={deleteBatchId !== null} onOpenChange={(o) => !o && setDeleteBatchId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedBatch.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the batch and remove all {batchCandidates.length} agent assignments. Candidates themselves will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteBatchId && deleteBatch.mutate({ id: deleteBatchId })}
              >
                Delete Batch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Batch list view
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Training Batches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organise accepted agents into training cohorts, track attendance and progress
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Batch
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-25" />
          <p className="font-medium text-base">No training batches yet</p>
          <p className="text-sm mt-1 mb-4">Create your first batch to start organising agents for training</p>
          <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" /> Create First Batch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(batches as Batch[]).map((batch) => (
            <button
              key={batch.id}
              className="text-left rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-5 group"
              onClick={() => setSelectedBatchId(batch.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
              </div>
              <h3 className="font-semibold text-foreground mb-1 truncate">{batch.name}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                {batch.trainerName && (
                  <p className="flex items-center gap-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{batch.trainerName}</span>
                  </p>
                )}
                {batch.startDate && (
                  <p className="flex items-center gap-1.5">
                    <CalendarRange className="h-3 w-3 shrink-0" />
                    {new Date(batch.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {batch.endDate && (
                      <> → {new Date(batch.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                    )}
                  </p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{batch.candidateCount}</span>
                <span className="text-xs text-muted-foreground">agents</span>
                {batch.batchNotes && (
                  <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <ClipboardList className="h-3 w-3" /> Notes
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create batch dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Training Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Batch Name <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g. Batch 1, Wave 2 — June"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Trainer Name</label>
              <Input
                placeholder="e.g. Ahmed Hassan"
                value={form.trainerName}
                onChange={(e) => setForm((f) => ({ ...f, trainerName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">End Date</label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">General Notes</label>
              <Textarea
                placeholder="Any general notes about this batch..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Training Progress Notes</label>
              <Textarea
                placeholder="e.g. Week 1: Product knowledge ✓&#10;Week 2: CRM training — pending"
                value={form.batchNotes}
                onChange={(e) => setForm((f) => ({ ...f, batchNotes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBatch.isPending}>
              {createBatch.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
