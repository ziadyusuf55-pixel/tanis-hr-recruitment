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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_DOT,
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
} from "lucide-react";
import { toast } from "sonner";

type CandidateEditForm = {
  name: string;
  email: string;
  phone: string;
  positionApplied: string;
  resumeLink: string;
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

export default function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: candidate, isLoading } = trpc.candidates.byId.useQuery({ id });
  const { data: interviews, isLoading: interviewsLoading } = trpc.interviews.byCandidateId.useQuery({ candidateId: id });

  const updateCandidate = trpc.candidates.update.useMutation({
    onSuccess: () => {
      utils.candidates.byId.invalidate({ id });
      utils.candidates.list.invalidate();
      toast.success("Candidate updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to update candidate"),
  });

  const updateStatus = trpc.candidates.updateStatus.useMutation({
    onSuccess: () => {
      utils.candidates.byId.invalidate({ id });
      utils.candidates.list.invalidate();
      utils.dashboard.pipelineCounts.invalidate();
      toast.success("Stage updated");
    },
    onError: () => toast.error("Failed to update stage"),
  });

  const deleteCandidate = trpc.candidates.delete.useMutation({
    onSuccess: () => {
      utils.candidates.list.invalidate();
      utils.dashboard.pipelineCounts.invalidate();
      toast.success("Candidate deleted");
      navigate("/candidates");
    },
    onError: () => toast.error("Failed to delete candidate"),
  });

  const scheduleInterview = trpc.interviews.schedule.useMutation({
    onSuccess: () => {
      utils.interviews.byCandidateId.invalidate({ candidateId: id });
      toast.success("Interview scheduled — email notification sent");
      setInterviewOpen(false);
      setInterviewForm(EMPTY_INTERVIEW);
    },
    onError: () => toast.error("Failed to schedule interview"),
  });

  const deleteInterview = trpc.interviews.delete.useMutation({
    onSuccess: () => {
      utils.interviews.byCandidateId.invalidate({ candidateId: id });
      toast.success("Interview removed");
    },
    onError: () => toast.error("Failed to remove interview"),
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
    notes: "",
  });

  const openEdit = () => {
    if (!candidate) return;
    setEditForm({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? "",
      positionApplied: candidate.positionApplied,
      resumeLink: candidate.resumeLink ?? "",
      notes: candidate.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    if (!editForm.email.trim()) { toast.error("Email is required"); return; }
    updateCandidate.mutate({
      id,
      data: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        positionApplied: editForm.positionApplied.trim(),
        resumeLink: editForm.resumeLink.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      },
    });
  };

  const handleScheduleInterview = () => {
    if (!interviewForm.date || !interviewForm.time) {
      toast.error("Date and time are required");
      return;
    }
    if (!user?.email) {
      toast.error("Recruiter email not found. Please ensure you are logged in.");
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
      recruiterEmail: user.email,
      recruiterName: user.name ?? "Recruiter",
      candidateName: candidate?.name ?? "Candidate",
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

  const currentStageIndex = PIPELINE_STAGES.indexOf(candidate.status as PipelineStage);

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
        {/* Header stripe */}
        <div className="h-2 bg-gradient-to-r from-primary/80 to-primary/40" />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
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
              {PIPELINE_STAGES.map((stage, idx) => {
                const isActive = candidate.status === stage;
                const isPast = currentStageIndex > idx && candidate.status !== "rejected";
                const isRejected = candidate.status === "rejected";
                return (
                  <div key={stage} className="flex items-center gap-1">
                    <button
                      onClick={() => updateStatus.mutate({ id, status: stage })}
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
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {candidate.notes && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.notes}</p>
        </div>
      )}

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
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : interviews && interviews.length > 0 ? (
          <div className="divide-y divide-border">
            {interviews.map((interview) => {
              const d = new Date(interview.scheduledAt);
              const isPast = d < new Date();
              return (
                <div key={interview.id} className="px-5 py-4 flex items-start justify-between gap-4 group">
                  <div className="flex items-start gap-3">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => deleteInterview.mutate({ id: interview.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
                <Label>Position Applied For <span className="text-destructive">*</span></Label>
                <Input value={editForm.positionApplied} onChange={(e) => setEditForm({ ...editForm, positionApplied: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Resume Link</Label>
                <Input placeholder="https://..." value={editForm.resumeLink} onChange={(e) => setEditForm({ ...editForm, resumeLink: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
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
              <Label>Location</Label>
              <Input
                placeholder="e.g. Office, Google Meet, Zoom"
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

function getStageBadgeClass(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    applied: "bg-blue-50 text-blue-700 border-blue-200",
    shortlisted: "bg-sky-50 text-sky-700 border-sky-200",
    interviewed: "bg-violet-50 text-violet-700 border-violet-200",
    offered: "bg-amber-50 text-amber-700 border-amber-200",
    hired: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-600 border-red-200",
  };
  return map[stage] ?? "";
}
