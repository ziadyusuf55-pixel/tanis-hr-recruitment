import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACTIVE_STAGES,
  STAGE_LABELS,
  STAGE_DOT,
  STAGE_BADGE,
  STAGE_DESCRIPTIONS,
  PipelineStage,
} from "@/lib/pipeline";
import {
  ArrowLeft,
  Mail,
  Phone,
  Link as LinkIcon,
  Calendar,
  Pencil,
  Trash2,
  MoreHorizontal,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Plus,
  StickyNote,
  Send,
} from "lucide-react";
import { toast } from "sonner";

type CandidateEditForm = {
  name: string;
  email: string;
  phone: string;
  positionApplied: string;
  resumeLink: string;
  meetLink: string;
  teamsLink: string;
  notes: string;
};

type InterviewForm = {
  date: string;
  time: string;
  location: string;
  interviewerName: string;
  notes: string;
};

const EMPTY_INTERVIEW: InterviewForm = {
  date: "",
  time: "",
  location: "",
  interviewerName: "",
  notes: "",
};

function getStageBadgeClass(stage: PipelineStage): string {
  return STAGE_BADGE[stage] ?? "";
}

export default function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: candidate, isLoading } = trpc.candidates.get.useQuery({ id });
  const { data: interviews, isLoading: interviewsLoading } = trpc.interviews.listByCandidate.useQuery({ candidateId: id });
  const { data: stageNotes, isLoading: notesLoading } = trpc.notes.list.useQuery({ candidateId: id });

  const updateCandidate = trpc.candidates.update.useMutation({
    onSuccess: () => {
      utils.candidates.get.invalidate({ id });
      utils.candidates.list.invalidate();
      toast.success("Candidate updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to update candidate"),
  });

  const updateStatus = trpc.candidates.updateStatus.useMutation({
    onSuccess: () => {
      utils.candidates.get.invalidate({ id });
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      toast.success("Stage updated");
    },
    onError: () => toast.error("Failed to update stage"),
  });

  const deleteCandidate = trpc.candidates.delete.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      utils.dashboard.kpis.invalidate();
      toast.success("Candidate deleted");
      navigate("/candidates");
    },
    onError: () => toast.error("Failed to delete candidate"),
  });

  const scheduleInterview = trpc.interviews.schedule.useMutation({
    onSuccess: () => {
      utils.interviews.listByCandidate.invalidate({ candidateId: id });
      toast.success("Interview scheduled — email notification sent");
      setInterviewOpen(false);
      setInterviewForm(EMPTY_INTERVIEW);
    },
    onError: () => toast.error("Failed to schedule interview"),
  });

  const addNote = trpc.notes.add.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ candidateId: id });
      toast.success("Note added");
      setNoteText("");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [interviewForm, setInterviewForm] = useState<InterviewForm>(EMPTY_INTERVIEW);
  const [editForm, setEditForm] = useState<CandidateEditForm>({
    name: "",
    email: "",
    phone: "",
    positionApplied: "",
    resumeLink: "",
    meetLink: "",
    teamsLink: "",
    notes: "",
  });
  const [noteText, setNoteText] = useState("");
  const [noteStage, setNoteStage] = useState<PipelineStage>("applied");
  const [activeNotesStage, setActiveNotesStage] = useState<PipelineStage | "all">("all");

  const openEdit = () => {
    if (!candidate) return;
    setEditForm({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? "",
      positionApplied: candidate.positionApplied,
      resumeLink: candidate.resumeLink ?? "",
      meetLink: (candidate as Record<string, unknown>).meetLink as string ?? "",
      teamsLink: (candidate as Record<string, unknown>).teamsLink as string ?? "",
      notes: candidate.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    if (!editForm.email.trim()) { toast.error("Email is required"); return; }
    updateCandidate.mutate({
      id,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim() || undefined,
      positionApplied: editForm.positionApplied.trim(),
      resumeLink: editForm.resumeLink.trim() || undefined,
      meetLink: editForm.meetLink.trim() || undefined,
      teamsLink: editForm.teamsLink.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
    });
  };

  const handleScheduleInterview = () => {
    if (!interviewForm.date || !interviewForm.time) {
      toast.error("Date and time are required");
      return;
    }
    const scheduledAt = new Date(`${interviewForm.date}T${interviewForm.time}`).getTime();
    if (isNaN(scheduledAt)) { toast.error("Invalid date or time"); return; }

    scheduleInterview.mutate({
      candidateId: id,
      scheduledAt,
      location: interviewForm.location.trim() || undefined,
      interviewerName: interviewForm.interviewerName.trim() || undefined,
      notes: interviewForm.notes.trim() || undefined,
      recruiterEmail: user?.email ?? undefined,
      candidateName: candidate?.name ?? "Candidate",
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) { toast.error("Note text is required"); return; }
    addNote.mutate({
      candidateId: id,
      stage: noteStage,
      note: noteText.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Candidate not found</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="mt-3 gap-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidates
        </Button>
      </div>
    );
  }

  const currentStageIndex = ACTIVE_STAGES.indexOf(candidate.status as (typeof ACTIVE_STAGES)[number]);

  const filteredNotes = activeNotesStage === "all"
    ? stageNotes ?? []
    : (stageNotes ?? []).filter((n: { stage: string }) => n.stage === activeNotesStage);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/candidates")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Candidates
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} className="gap-2 h-9">
            <Calendar className="h-3.5 w-3.5" /> Schedule Interview
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={openEdit} className="cursor-pointer">
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteConfirm(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary/80 to-primary/40" />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{candidate.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{candidate.positionApplied}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {candidate.email && (
                  <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" /> {candidate.email}
                  </a>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {candidate.phone}
                  </span>
                )}
                {candidate.resumeLink && (
                  <a href={candidate.resumeLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <LinkIcon className="h-3 w-3" /> View Resume
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline stepper */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Pipeline Stage</p>
            <div className="flex items-center gap-1 flex-wrap">
              {ACTIVE_STAGES.map((stage, idx) => {
                const isActive = candidate.status === stage;
                const isPast = currentStageIndex > idx && candidate.status !== "rejected";
                return (
                  <div key={stage} className="flex items-center gap-1">
                    <button
                      onClick={() => updateStatus.mutate({ id, status: stage })}
                      title={STAGE_DESCRIPTIONS[stage]}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        isActive
                          ? `${getStageBadgeClass(stage)} shadow-sm`
                          : isPast
                          ? "bg-muted/60 text-muted-foreground/60 border-transparent"
                          : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {isActive && <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[stage]}`} />}
                      {STAGE_LABELS[stage]}
                    </button>
                    {idx < ACTIVE_STAGES.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    )}
                  </div>
                );
              })}
              {/* Rejected exit */}
              <button
                onClick={() => updateStatus.mutate({ id, status: "rejected" })}
                className={`ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                  candidate.status === "rejected"
                    ? `${getStageBadgeClass("rejected")} shadow-sm`
                    : "bg-transparent text-muted-foreground border-border hover:border-red-300 hover:text-red-600"
                }`}
              >
                {candidate.status === "rejected" && <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT["rejected"]}`} />}
                Rejected
              </button>
            </div>
            {/* Current stage description */}
            <p className="text-xs text-muted-foreground mt-2.5 italic">
              {STAGE_DESCRIPTIONS[candidate.status as PipelineStage]}
            </p>
          </div>
        </div>
      </div>

      {/* Stage Notes */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Stage Notes</h2>
            {stageNotes && stageNotes.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{stageNotes.length}</span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 flex-wrap">
          <button
            onClick={() => setActiveNotesStage("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              activeNotesStage === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-muted-foreground/40"
            }`}
          >
            All
          </button>
          {ACTIVE_STAGES.map((stage) => {
            const count = (stageNotes ?? []).filter((n: { stage: string }) => n.stage === stage).length;
            return (
              <button
                key={stage}
                onClick={() => setActiveNotesStage(stage)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                  activeNotesStage === stage
                    ? `${getStageBadgeClass(stage)} shadow-sm`
                    : "border-border text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                {STAGE_LABELS[stage]}
                {count > 0 && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Notes list */}
        <div className="px-5 pb-3 min-h-[60px]">
          {notesLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : filteredNotes.length > 0 ? (
            <div className="space-y-2 py-2">
              {filteredNotes.map((note: { id: number; stage: string; note: string; recruiterName?: string | null; createdAt: Date }) => (
                <div key={note.id} className="flex gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStageBadgeClass(note.stage as PipelineStage)}`}>
                        {STAGE_LABELS[note.stage as PipelineStage]}
                      </span>
                      {note.recruiterName && (
                        <span className="text-[10px] text-muted-foreground">{note.recruiterName}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.note}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <StickyNote className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
              <p className="text-xs text-muted-foreground">No notes yet for this stage</p>
            </div>
          )}
        </div>

        {/* Add note form */}
        <div className="px-5 pb-4 border-t border-border pt-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Stage:</span>
                <div className="flex gap-1 flex-wrap">
                  {ACTIVE_STAGES.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => setNoteStage(stage)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                        noteStage === stage
                          ? getStageBadgeClass(stage)
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder={`Add a note for the ${STAGE_LABELS[noteStage]} stage...`}
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 mt-6"
              onClick={handleAddNote}
              disabled={addNote.isPending || !noteText.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Interviews */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Interviews</h2>
          <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3 w-3" /> Schedule
          </Button>
        </div>

        {interviewsLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : interviews && interviews.length > 0 ? (
          <div className="divide-y divide-border">
            {interviews.map((interview: { id: number; scheduledAt: number; location?: string | null; interviewerName?: string | null; notes?: string | null; notificationSent?: number | null }) => {
              const d = new Date(interview.scheduledAt);
              const isPast = d < new Date();
              return (
                <div key={interview.id} className="px-5 py-4 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPast ? "bg-muted" : "bg-primary/10"}`}>
                    <Calendar className={`h-4 w-4 ${isPast ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {interview.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {interview.location}
                        </span>
                      )}
                      {interview.interviewerName && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" /> {interview.interviewerName}
                        </span>
                      )}
                      {interview.notificationSent === 1 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Notified
                        </span>
                      )}
                    </div>
                    {interview.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{interview.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No interviews scheduled</p>
            <Button size="sm" variant="ghost" onClick={() => setInterviewOpen(true)} className="mt-2 text-xs gap-1">
              <Plus className="h-3 w-3" /> Schedule Interview
            </Button>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground/60 flex gap-4">
        <span>Added {new Date(candidate.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        <span>Updated {new Date(candidate.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Resume Link</Label>
                <Input placeholder="https://..." value={editForm.resumeLink} onChange={(e) => setEditForm({ ...editForm, resumeLink: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Google Meet Link</Label>
                <Input placeholder="https://meet.google.com/..." value={editForm.meetLink} onChange={(e) => setEditForm({ ...editForm, meetLink: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Teams Invitation Link</Label>
                <Input placeholder="https://teams.microsoft.com/..." value={editForm.teamsLink} onChange={(e) => setEditForm({ ...editForm, teamsLink: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>General Notes</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={updateCandidate.isPending}>
              {updateCandidate.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      <Dialog open={interviewOpen} onOpenChange={(v) => { setInterviewOpen(v); if (!v) setInterviewForm(EMPTY_INTERVIEW); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg px-4 py-3 text-sm">
              <span className="text-muted-foreground">Candidate: </span>
              <span className="font-medium text-foreground">{candidate.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={interviewForm.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time <span className="text-destructive">*</span></Label>
                <Input
                  type="time"
                  value={interviewForm.time}
                  onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location / Meet Link</Label>
              <Input
                placeholder="e.g. Google Meet link or Office"
                value={interviewForm.location}
                onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer Name</Label>
              <Input
                placeholder="e.g. Ahmed Hassan"
                value={interviewForm.interviewerName}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any preparation notes or agenda..."
                rows={2}
                value={interviewForm.notes}
                onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
              An email notification will be sent to <strong>{user?.email}</strong> when the interview is scheduled.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterviewOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleInterview} disabled={scheduleInterview.isPending}>
              {scheduleInterview.isPending ? "Scheduling..." : "Schedule Interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Candidate</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{candidate.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteCandidate.isPending}
              onClick={() => deleteCandidate.mutate({ id })}
            >
              {deleteCandidate.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
