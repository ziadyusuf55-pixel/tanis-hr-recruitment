import { useState } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { KeyRound, Copy, RotateCcw } from "lucide-react";

type Batch = {
  id: number;
  name: string;
  trainerName: string | null;
  startDate: number | null;
  notes: string | null;
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
  slackJoined?: boolean;
};

const EMPTY_FORM = { name: "", trainerName: "", startDate: "", notes: "" };

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
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  // Only WhatsApp Group Added candidates can be assigned to training batches
  const { data: allCandidates = [] } = trpc.candidates.list.useQuery();
  const acceptedCandidates = (allCandidates as unknown as BatchCandidate[]).filter(
    (c) => c.status === "whatsapp_group_added"
  );

  // Mutations
  const createBatch = trpc.batches.create.useMutation({
    onSuccess: () => { utils.batches.list.invalidate(); toast.success("Batch created"); setCreateOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const deleteBatch = trpc.batches.delete.useMutation({
    onSuccess: () => { utils.batches.list.invalidate(); toast.success("Batch deleted"); setSelectedBatchId(null); setDeleteBatchId(null); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const assignCandidate = trpc.batches.assignCandidate.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); utils.batches.list.invalidate(); toast.success("Agent assigned to batch"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const removeCandidate = trpc.batches.removeCandidate.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); utils.batches.list.invalidate(); toast.success("Agent removed from batch"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const setTraineeCode = trpc.batches.setTraineeCode.useMutation({
    onSuccess: () => { utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! }); toast.success("Trainee code saved"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const [bulkCredentials, setBulkCredentials] = useState<Array<{ traineeCode: string; password: string }> | null>(null);
  const [resetResult, setResetResult] = useState<{ traineeCode: string; password: string } | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const resetPasswordMutation = trpc.agent.resetPassword.useMutation({
    onSuccess: (data) => { setResetResult(data); setResetDialogOpen(true); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const bulkGenerateMutation = trpc.batches.bulkGenerateCredentials.useMutation({
    onSuccess: (data) => {
      if (data.generated === 0) {
        toast.error("No agents with trainee codes found. Assign trainee codes first.");
      } else {
        setBulkCredentials(data.credentials);
        toast.success(`Credentials generated for ${data.generated} agent(s)`);
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const toggleSlackJoined = trpc.batches.toggleSlackJoined.useMutation({
    onSuccess: (_data, vars) => {
      utils.batches.listCandidates.invalidate({ batchId: selectedBatchId! });
      toast.success(vars.value ? "Mock call passed" : "Mock call pending");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Transfer to Operations
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferCandidate, setTransferCandidate] = useState<BatchCandidate | null>(null);
  const [transferForm, setTransferForm] = useState({ alias: "", campaignId: "", shiftHours: "", teamLeader: "", offDay1: "", offDay2: "" });
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();
  const createWorkforce = trpc.workforce.create.useMutation({
    onSuccess: () => {
      toast.success("Agent transferred to Operations");
      setTransferDialogOpen(false);
      setTransferCandidate(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteBatchId, setDeleteBatchId] = useState<number | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  // Trainee code inline editing
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Batch name is required"); return; }
    createBatch.mutate({
      name: form.name.trim(),
      trainerName: form.trainerName.trim() || undefined,
      startDate: form.startDate ? new Date(form.startDate).getTime() : undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const handleSaveCode = (candidateId: number) => {
    if (!selectedBatchId) return;
    setTraineeCode.mutate({
      batchId: selectedBatchId,
      candidateId,
      code: editingCodeValue.trim() || null,
    });
    setEditingCodeId(null);
    setEditingCodeValue("");
  };

  // Candidates not yet in this batch
  const assignedIds = new Set((batchCandidates as BatchCandidate[]).map((c) => c.id));
  const assignableCandidates = acceptedCandidates.filter((c) => {
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

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              {selectedBatch.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {selectedBatch.trainerName && (
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {selectedBatch.trainerName}</span>
              )}
              {selectedBatch.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(selectedBatch.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {batchCandidates.length} agents</span>
            </div>
            {selectedBatch.notes && (
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">{selectedBatch.notes}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
              onClick={() => bulkGenerateMutation.mutate({ batchId: selectedBatch.id })}
              disabled={bulkGenerateMutation.isPending}
            >
              <KeyRound className="h-4 w-4" /> {bulkGenerateMutation.isPending ? "Generating..." : "Generate All Credentials"}
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

        {/* Agents table */}
        {batchCandidates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No agents assigned yet</p>
            <p className="text-sm mt-1">Click "Add Agent" to assign agents who have been added to the WhatsApp group</p>
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
                    <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Trainee Code</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mock Call</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...(batchCandidates as BatchCandidate[])].sort((a, b) => {
                    if (!a.traineeCode && !b.traineeCode) return 0;
                    if (!a.traineeCode) return 1;
                    if (!b.traineeCode) return -1;
                    const numA = parseInt(a.traineeCode.replace(/\D/g, ""), 10) || 0;
                    const numB = parseInt(b.traineeCode.replace(/\D/g, ""), 10) || 0;
                    if (numA !== numB) return numA - numB;
                    return a.traineeCode.localeCompare(b.traineeCode);
                  }).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.wave ? (
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">W{c.wave}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {editingCodeId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            className="h-7 w-32 text-xs"
                            placeholder="e.g. T-001"
                            value={editingCodeValue}
                            onChange={(e) => setEditingCodeValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveCode(c.id);
                              if (e.key === "Escape") { setEditingCodeId(null); setEditingCodeValue(""); }
                            }}
                          />
                          <button
                            onClick={() => handleSaveCode(c.id)}
                            className="p-1 rounded hover:bg-green-50 text-green-600"
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingCodeId(null); setEditingCodeValue(""); }}
                            className="p-1 rounded hover:bg-red-50 text-red-500"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group/code">
                          {c.traineeCode ? (
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">{c.traineeCode}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Not assigned</span>
                          )}
                          <button
                            onClick={() => { setEditingCodeId(c.id); setEditingCodeValue(c.traineeCode ?? ""); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover/code:opacity-100 transition-opacity"
                            title="Edit trainee code"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.slackJoined ?? false}
                          onCheckedChange={(val) => {
                            if (!selectedBatchId) return;
                            toggleSlackJoined.mutate({ batchId: selectedBatchId, candidateId: c.id, value: val });
                          }}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                        <span className={`text-xs font-medium ${
                          c.slackJoined ? "text-emerald-600" : "text-muted-foreground"
                        }`}>
                          {c.slackJoined ? "Passed" : "Pending"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.slackJoined && c.traineeCode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1"
                            onClick={() => {
                              setTransferCandidate(c);
                              setTransferForm({ alias: "", campaignId: "", shiftHours: "", teamLeader: "", offDay1: "", offDay2: "" });
                              setTransferDialogOpen(true);
                            }}
                            title="Transfer to Operations"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Operations</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                          onClick={() => resetPasswordMutation.mutate({ candidateId: c.id })}
                          title="Reset password"
                          disabled={resetPasswordMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeCandidate.mutate({ batchId: selectedBatch.id, candidateId: c.id })}
                          title="Remove from batch"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                  {acceptedCandidates.length === 0
                    ? "No agents with WhatsApp Group Added status available"
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
                    {c.wave && (
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">W{c.wave}</Badge>
                    )}
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

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={(o) => { setResetDialogOpen(o); if (!o) setResetResult(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-600" /> Password Reset</DialogTitle>
            </DialogHeader>
            {resetResult && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">New credentials generated. Share these with the agent — the password is shown only once.</p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Trainee ID</span>
                    <span className="font-mono text-sm font-medium">{resetResult.traineeCode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">New Password</span>
                    <span className="font-mono text-sm font-medium text-amber-700">{resetResult.password}</span>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(`Trainee ID: ${resetResult!.traineeCode}\nPassword: ${resetResult!.password}`); toast.success("Copied to clipboard!"); }}
                >
                  <Copy className="h-4 w-4" /> Copy Credentials
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Transfer to Operations Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={(o) => { setTransferDialogOpen(o); if (!o) setTransferCandidate(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" /> Transfer to Operations</DialogTitle>
            </DialogHeader>
            {transferCandidate && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Transferring <strong>{transferCandidate.name}</strong> ({transferCandidate.traineeCode}) to the Operations workforce.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">English Alias</label>
                    <Input placeholder="e.g. Jordan" value={transferForm.alias} onChange={e => setTransferForm(f => ({ ...f, alias: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={transferForm.campaignId} onChange={e => setTransferForm(f => ({ ...f, campaignId: e.target.value }))}>
                      <option value="">Select campaign...</option>
                      {(campaigns as Array<{id:number;name:string}>).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Hours</label>
                    <Input placeholder="e.g. 9AM–5PM" value={transferForm.shiftHours} onChange={e => setTransferForm(f => ({ ...f, shiftHours: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Leader</label>
                    <Input placeholder="Team leader name" value={transferForm.teamLeader} onChange={e => setTransferForm(f => ({ ...f, teamLeader: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 1</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={transferForm.offDay1} onChange={e => setTransferForm(f => ({ ...f, offDay1: e.target.value }))}>
                      <option value="">Select day...</option>
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 2</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={transferForm.offDay2} onChange={e => setTransferForm(f => ({ ...f, offDay2: e.target.value }))}>
                      <option value="">Select day...</option>
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    disabled={createWorkforce.isPending}
                    onClick={() => {
                      if (!transferCandidate?.traineeCode) { toast.error("Trainee code required"); return; }
                      createWorkforce.mutate({
                        traineeCode: transferCandidate.traineeCode!,
                        candidateId: transferCandidate.id,
                        fullName: transferCandidate.name,
                        alias: transferForm.alias || undefined,
                        campaignId: transferForm.campaignId ? Number(transferForm.campaignId) : undefined,
                        shiftHours: transferForm.shiftHours || undefined,
                        teamLeader: transferForm.teamLeader || undefined,
                        offDay1: transferForm.offDay1 !== "" ? Number(transferForm.offDay1) : undefined,
                        offDay2: transferForm.offDay2 !== "" ? Number(transferForm.offDay2) : undefined,
                        joinDate: Date.now(),
                      });
                    }}
                  >
                    <UserPlus className="h-4 w-4" /> Transfer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Credentials Dialog */}
        <Dialog open={bulkCredentials !== null} onOpenChange={(o) => !o && setBulkCredentials(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-indigo-600" /> Generated Credentials</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">Share these credentials with each agent. Passwords are shown only once.</p>
            <div className="rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Trainee Code</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Password</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(bulkCredentials ?? []).map((cred) => (
                    <tr key={cred.traineeCode}>
                      <td className="px-3 py-2 font-mono text-xs">{cred.traineeCode}</td>
                      <td className="px-3 py-2 font-mono text-xs">{cred.password}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${cred.traineeCode} / ${cred.password}`); toast.success("Copied!"); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-3">
              <Button variant="outline" size="sm" onClick={() => {
                const text = (bulkCredentials ?? []).map(c => `${c.traineeCode} / ${c.password}`).join("\n");
                navigator.clipboard.writeText(text);
                toast.success("All credentials copied!");
              }} className="gap-1.5"><Copy className="h-4 w-4" /> Copy All</Button>
              <Button size="sm" onClick={() => setBulkCredentials(null)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  // Batch list vieww
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Training Batches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organise agents (WhatsApp Group Added) into training cohorts and assign trainee codes
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
                    <Calendar className="h-3 w-3 shrink-0" />
                    {new Date(batch.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{batch.candidateCount}</span>
                <span className="text-xs text-muted-foreground">agents</span>
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
            <div>
              <label className="text-sm font-medium mb-1.5 block">Start Date</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea
                placeholder="Any notes about this batch..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
