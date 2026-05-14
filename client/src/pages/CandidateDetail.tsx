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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  getNextStage,
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
  Star,
  FileText,
  Activity,
  Briefcase,
  UserCheck,
  ExternalLink,
  UserX,
  Layers,
  Paperclip,
  Upload,
  X as XIcon,
  Download,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type CandidateEditForm = {
  name: string;
  email: string;
  phone: string;
  positionApplied: string;
  resumeLink: string;
  meetLink: string;
  teamsLink: string;
  notes: string;
  age: string;
  location: string;
  source: string;
  wave: string;
  voiceNoteRating: number | null;
  screeningNotes: string;
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

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  referral: "Referral",
  walk_in: "Walk-in",
  other: "Other",
};

// ─── Star Rating Component ────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover ?? value ?? 0) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(null)}
            className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
      {value && (
        <span className="ml-1 text-xs text-muted-foreground font-medium">{value}/5</span>
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60 bg-muted/20">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground font-medium">{value ?? <span className="text-muted-foreground/50 font-normal">—</span>}</span>
    </div>
  );
}

// ─── Activity Icon ────────────────────────────────────────────────────────────

function activityIcon(action: string) {
  if (action === "stage_change") return <ChevronRight className="h-3.5 w-3.5 text-primary" />;
  if (action === "candidate_created") return <UserCheck className="h-3.5 w-3.5 text-emerald-500" />;
  if (action === "interview_scheduled") return <Calendar className="h-3.5 w-3.5 text-violet-500" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}

function activityLabel(entry: {
  action: string;
  fromStage?: string | null;
  toStage?: string | null;
  detail?: string | null;
}) {
  if (entry.action === "candidate_created") {
    return `Added to pipeline as ${STAGE_LABELS[(entry.toStage as PipelineStage) ?? "applied"] ?? entry.toStage}`;
  }
  if (entry.action === "stage_change") {
    const from = entry.fromStage ? STAGE_LABELS[entry.fromStage as PipelineStage] ?? entry.fromStage : null;
    const to = entry.toStage ? STAGE_LABELS[entry.toStage as PipelineStage] ?? entry.toStage : null;
    if (from && to) return `Moved from ${from} → ${to}`;
    if (to) return `Stage set to ${to}`;
  }
  if (entry.action === "interview_scheduled") return "Interview scheduled";
  return entry.action.replace(/_/g, " ");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: candidate, isLoading } = trpc.candidates.get.useQuery({ id });
  const { data: interviews, isLoading: interviewsLoading } = trpc.interviews.listByCandidate.useQuery({ candidateId: id });
  const { data: stageNotes, isLoading: notesLoading } = trpc.notes.list.useQuery({ candidateId: id });
  const { data: activityEntries } = trpc.activity.list.useQuery({ candidateId: id });
  const { data: credentials, refetch: refetchCredentials } = trpc.agent.hasCredentials.useQuery({ candidateId: id });
  const { data: performanceRecords } = trpc.agent.getPerformance.useQuery({ candidateId: id });

  const generateCredentialsMutation = trpc.agent.generateCredentials.useMutation({
    onSuccess: () => {
      refetchCredentials();
      toast.success("Agent credentials generated");
    },
    onError: () => toast.error("Failed to generate credentials"),
  });
  const resetPasswordMutation = trpc.agent.resetPassword.useMutation({
    onSuccess: (data) => {
      setShowGeneratedPassword(data.password);
      toast.success("Password reset — new temporary password generated");
    },
    onError: () => toast.error("Failed to reset password"),
  });

  const upsertPerformanceMutation = trpc.agent.upsertPerformance.useMutation({
    onSuccess: () => {
      utils.agent.getPerformance.invalidate({ candidateId: id });
      toast.success("Performance record saved");
      setPerfDialogOpen(false);
    },
    onError: () => toast.error("Failed to save performance record"),
  });

  const deletePerformanceMutation = trpc.agent.deletePerformance.useMutation({
    onSuccess: () => {
      utils.agent.getPerformance.invalidate({ candidateId: id });
      toast.success("Performance record deleted");
    },
    onError: () => toast.error("Failed to delete performance record"),
  });

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
      utils.activity.list.invalidate({ candidateId: id });
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
      utils.activity.list.invalidate({ candidateId: id });
      toast.success("Interview scheduled — email notification sent");
      setInterviewOpen(false);
      setInterviewForm(EMPTY_INTERVIEW);
    },
    onError: () => toast.error("Failed to schedule interview"),
  });

  const uploadCv = trpc.candidates.uploadCv.useMutation({
    onSuccess: () => {
      utils.candidates.get.invalidate({ id });
      toast.success("CV uploaded successfully");
    },
    onError: () => toast.error("Failed to upload CV"),
  });

  const removeCv = trpc.candidates.removeCv.useMutation({
    onSuccess: () => {
      utils.candidates.get.invalidate({ id });
      toast.success("CV removed");
    },
    onError: () => toast.error("Failed to remove CV"),
  });

  const addNote = trpc.notes.add.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ candidateId: id });
      toast.success("Note added");
      setNoteText("");
    },
    onError: () => toast.error("Failed to add note"),
  });

  // ─── State ─────────────────────────────────────────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isNoShow, setIsNoShow] = useState(false);
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
    age: "",
    location: "",
    source: "",
    wave: "",
    voiceNoteRating: null,
    screeningNotes: "",
  });
  const [noteText, setNoteText] = useState("");
  const [noteStage, setNoteStage] = useState<PipelineStage>("applied");
  const [activeNotesStage, setActiveNotesStage] = useState<PipelineStage | "all">("all");
  const [showGeneratedPassword, setShowGeneratedPassword] = useState<string | null>(null);
  const [perfDialogOpen, setPerfDialogOpen] = useState(false);
  const [perfForm, setPerfForm] = useState({ period: "", callsMade: "", leadsGenerated: "", targetsHit: "", totalTargets: "", qualityScore: "", attendanceRate: "", notes: "" });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openEdit = () => {
    if (!candidate) return;
    const c = candidate as Record<string, unknown>;
    setEditForm({
      name: candidate.name,
      email: candidate.email ?? "",
      phone: candidate.phone ?? "",
      positionApplied: candidate.positionApplied,
      resumeLink: (c.resumeLink as string) ?? "",
      meetLink: (c.meetLink as string) ?? "",
      teamsLink: (c.teamsLink as string) ?? "",
      notes: candidate.notes ?? "",
      age: c.age != null ? String(c.age) : "",
      location: (c.location as string) ?? "",
      source: (c.source as string) ?? "",
      wave: c.wave != null ? String(c.wave) : "",
      voiceNoteRating: (c.voiceNoteRating as number | null) ?? null,
      screeningNotes: (c.screeningNotes as string) ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    const ageNum = editForm.age ? parseInt(editForm.age) : null;
    if (editForm.age && (isNaN(ageNum!) || ageNum! < 16 || ageNum! > 80)) {
      toast.error("Age must be between 16 and 80");
      return;
    }
    const waveNum = editForm.wave ? parseInt(editForm.wave) : null;
    if (editForm.wave && (isNaN(waveNum!) || waveNum! < 1)) {
      toast.error("Wave must be a positive number"); return;
    }
    updateCandidate.mutate({
      id,
      name: editForm.name.trim(),
      email: editForm.email.trim() || undefined,
      phone: editForm.phone.trim() || null,
      positionApplied: editForm.positionApplied.trim(),
      resumeLink: editForm.resumeLink.trim() || null,
      meetLink: editForm.meetLink.trim() || null,
      teamsLink: editForm.teamsLink.trim() || null,
      notes: editForm.notes.trim() || null,
      age: ageNum,
      location: editForm.location.trim() || null,
      source: (editForm.source as "linkedin" | "email" | "referral" | "walk_in" | "other") || null,
      wave: waveNum,
      voiceNoteRating: editForm.voiceNoteRating,
      screeningNotes: editForm.screeningNotes.trim() || null,
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
    addNote.mutate({ candidateId: id, stage: noteStage, note: noteText.trim() });
  };

  const handleAdvanceStage = () => {
    if (!candidate) return;
    const next = getNextStage(candidate.status as PipelineStage);
    if (!next) return;
    updateStatus.mutate({ id, status: next, fromStage: candidate.status as PipelineStage });
  };

  const handleReject = () => {
    if (!candidate) return;
    if (!rejectReason.trim()) { toast.error("Please enter a rejection reason"); return; }
    updateStatus.mutate({
      id,
      status: "rejected",
      fromStage: candidate.status as PipelineStage,
      detail: rejectReason.trim(),
    });
    addNote.mutate({ candidateId: id, stage: "rejected", note: `Rejection reason: ${rejectReason.trim()}` });
    setRejectOpen(false);
    setRejectReason("");
    setIsNoShow(false);
  };

  const handleBlacklist = () => {
    if (!candidate) return;
    updateStatus.mutate({
      id,
      status: "blacklisted",
      fromStage: candidate.status as PipelineStage,
      detail: "Candidate blacklisted",
    });
    addNote.mutate({ candidateId: id, stage: "blacklisted", note: "Candidate has been blacklisted" });
    toast.success("Candidate blacklisted");
  };

  const handleNoShow = () => {
    setRejectReason("No-show — Did not attend interview");
    setIsNoShow(true);
    setRejectOpen(true);
  };

  // ─── Loading / Not Found ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
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

  const c = candidate as Record<string, unknown>;
  const currentStageIndex = ACTIVE_STAGES.indexOf(candidate.status as (typeof ACTIVE_STAGES)[number]);
  const nextStage = getNextStage(candidate.status as PipelineStage);
  const isRejected = candidate.status === "rejected";
  const isBlacklisted = candidate.status === "blacklisted";

  const filteredNotes = activeNotesStage === "all"
    ? stageNotes ?? []
    : (stageNotes ?? []).filter((n: { stage: string }) => n.stage === activeNotesStage);

  const REJECTION_PRESETS = [
    "Not a good fit for the role",
    "Communication skills below threshold",
    "Voice note quality insufficient",
    "Did not show up for interview",
    "Withdrew application",
    "Hired by another company",
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/candidates")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Candidates
        </button>
          <div className="flex items-center gap-2">
          {!isRejected && nextStage && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdvanceStage}
              disabled={updateStatus.isPending}
              className="gap-1.5 h-9 text-xs"
            >
              Move to {STAGE_LABELS[nextStage]}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* No Show — only when interview is scheduled */}
          {candidate.status === "interview_scheduled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleNoShow}
              className="gap-1.5 h-9 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <UserX className="h-3.5 w-3.5" /> No Show
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} className="gap-2 h-9">
            <Calendar className="h-3.5 w-3.5" /> Schedule Interview
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={openEdit} className="cursor-pointer">
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Profile
              </DropdownMenuItem>
              {!isRejected && !isBlacklisted && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setIsNoShow(false); setRejectReason(""); setRejectOpen(true); }}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <XCircle className="mr-2 h-3.5 w-3.5" /> Reject Candidate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleBlacklist}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Ban className="mr-2 h-3.5 w-3.5" /> Blacklist Candidate
                  </DropdownMenuItem>
                </>
              )}
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

      {/* ── CV Attachment ── */}
      <SectionCard title="CV / Resume Attachment" icon={<Paperclip className="h-4 w-4" />}>
        {(() => {
          const cvUrl = c.cvUrl as string | null;
          const cvFileName = c.cvFileName as string | null;
          return (
            <div className="space-y-3">
              {cvUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cvFileName ?? "CV File"}</p>
                    <p className="text-xs text-muted-foreground">Uploaded CV</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => window.open(cvUrl, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5" /> Open
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCv.mutate({ id })}
                      disabled={removeCv.isPending}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg text-center">
                  <Paperclip className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No CV attached yet</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10 MB)"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(",")[1];
                          uploadCv.mutate({ id, fileBase64: base64, fileName: file.name, mimeType: file.type });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button size="sm" variant="outline" className="gap-1.5 pointer-events-none" disabled={uploadCv.isPending}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploadCv.isPending ? "Uploading..." : "Upload CV"}
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground/60 mt-2">PDF, Word, or image — max 10 MB</p>
                </div>
              )}
              {/* Replace button when CV already exists */}
              {cvUrl && (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10 MB)"); return; }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = (reader.result as string).split(",")[1];
                        uploadCv.mutate({ id, fileBase64: base64, fileName: file.name, mimeType: file.type });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground pointer-events-none" disabled={uploadCv.isPending}>
                    <Upload className="h-3.5 w-3.5" /> Replace CV
                  </Button>
                </label>
              )}
            </div>
          );
        })()}
      </SectionCard>

      {/* --- Interviews --- */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary/50 to-primary/20" />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">{candidate.name}</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">{candidate.positionApplied}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STAGE_BADGE[candidate.status as PipelineStage]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[candidate.status as PipelineStage]}`} />
                  {STAGE_LABELS[candidate.status as PipelineStage]}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {candidate.email && (
                  <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" /> {candidate.email}
                  </a>
                )}
                {candidate.phone && (
                  <a href={`tel:${candidate.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" /> {candidate.phone}
                  </a>
                )}
                {(c.location as string | null) && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {String(c.location)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline Stepper ── */}
      {!isRejected && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {ACTIVE_STAGES.map((stage, idx) => {
              const done = idx < currentStageIndex;
              const active = idx === currentStageIndex;
              return (
                <div key={stage} className="flex items-center min-w-0">
                  <button
                    onClick={() => {
                      if (!active && !done) return;
                      if (active) return;
                      updateStatus.mutate({ id, status: stage, fromStage: candidate.status as PipelineStage });
                    }}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors min-w-[72px] ${
                      active
                        ? "bg-primary/10"
                        : done
                        ? "opacity-60 hover:opacity-80"
                        : "opacity-30"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      done
                        ? "bg-primary/20 text-primary"
                        : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                  </button>
                  {idx < ACTIVE_STAGES.length - 1 && (
                    <div className={`h-px w-4 shrink-0 mx-0.5 ${idx < currentStageIndex ? "bg-primary/40" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {STAGE_DESCRIPTIONS[candidate.status as PipelineStage] && (
            <p className="text-xs text-muted-foreground mt-3 pl-1">
              {STAGE_DESCRIPTIONS[candidate.status as PipelineStage]}
            </p>
          )}
        </div>
      )}

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Personal Info ── */}
        <SectionCard title="Personal Information" icon={<User className="h-4 w-4" />}>
          <div className="divide-y divide-border/50">
            <InfoRow label="Full Name" value={candidate.name} />
            <InfoRow label="Phone" value={candidate.phone ? (
              <a href={`tel:${candidate.phone}`} className="hover:text-primary transition-colors">{candidate.phone}</a>
            ) : null} />
            <InfoRow label="Email" value={candidate.email ? (
              <a href={`mailto:${candidate.email}`} className="hover:text-primary transition-colors">{candidate.email}</a>
            ) : null} />
            <InfoRow label="Age" value={c.age != null ? `${c.age} years` : null} />
            <InfoRow label="Location" value={c.location as string | null} />
            {c.wave != null && (
              <InfoRow label="Wave" value={
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <Layers className="h-3 w-3" /> Wave {String(c.wave)}
                </span>
              } />
            )}
          </div>
        </SectionCard>

        {/* ── Application Info ── */}
        <SectionCard title="Application Details" icon={<Briefcase className="h-4 w-4" />}>
          <div className="divide-y divide-border/50">
            <InfoRow label="Position" value={candidate.positionApplied} />
            <InfoRow label="Source" value={c.source ? SOURCE_LABELS[c.source as string] ?? c.source as string : null} />
            <InfoRow label="Date Applied" value={
              c.appliedAt
                ? new Date(c.appliedAt as number).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : new Date(candidate.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            } />
            <InfoRow label="Current Stage" value={
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STAGE_BADGE[candidate.status as PipelineStage]}`}>
                {STAGE_LABELS[candidate.status as PipelineStage]}
              </span>
            } />
            {(c.resumeLink as string | null) && (
              <InfoRow label="CV / Resume" value={
                <a href={String(c.resumeLink)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  View CV <ExternalLink className="h-3 w-3" />
                </a>
              } />
            )}
          </div>
        </SectionCard>

        {/* ── Screening Results ── */}
        <SectionCard title="Screening Results" icon={<Star className="h-4 w-4" />}>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Voice Note Rating</p>
              {c.voiceNoteRating != null ? (
                <StarRating value={c.voiceNoteRating as number} readonly />
              ) : (
                <span className="text-sm text-muted-foreground/50">Not rated yet</span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Screening Comments</p>
              {c.screeningNotes ? (
                <p className="text-sm text-foreground leading-relaxed">{c.screeningNotes as string}</p>
              ) : (
                <span className="text-sm text-muted-foreground/50">No screening comments</span>
              )}
            </div>
            {candidate.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">General Notes</p>
                <p className="text-sm text-foreground leading-relaxed">{candidate.notes}</p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Links ── */}
        <SectionCard title="Communication Links" icon={<LinkIcon className="h-4 w-4" />}>
          <div className="space-y-3">
            {c.meetLink ? (
              <a
                href={c.meetLink as string}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Google Meet</p>
                  <p className="text-xs text-muted-foreground truncate">{c.meetLink as string}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground/50">No Meet link set</p>
            )}
            {c.teamsLink ? (
              <a
                href={c.teamsLink as string}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Send className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Microsoft Teams</p>
                  <p className="text-xs text-muted-foreground truncate">{c.teamsLink as string}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </a>
            ) : (
              !c.meetLink && null
            )}
            {!c.meetLink && !c.teamsLink && (
              <p className="text-sm text-muted-foreground/50">No links added yet</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* --- Interviews --- */}
      <SectionCard title="Interviews" icon={<Calendar className="h-4 w-4" />}>
        {interviewsLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : interviews && interviews.length > 0 ? (
          <div className="divide-y divide-border/50">
            {interviews.map((interview: {
              id: number;
              scheduledAt: number;
              location?: string | null;
              interviewerName?: string | null;
              notes?: string | null;
              notificationSent?: number | null;
            }) => {
              const d = new Date(interview.scheduledAt);
              const isPast = d < new Date();
              return (
                <div key={interview.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPast ? "bg-muted" : "bg-primary/10"}`}>
                    <Calendar className={`h-4 w-4 ${isPast ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="flex-1">
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No interviews scheduled</p>
            <Button size="sm" variant="ghost" onClick={() => setInterviewOpen(true)} className="mt-2 text-xs gap-1">
              <Plus className="h-3 w-3" /> Schedule Interview
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ── Stage Notes ── */}
      <SectionCard title="Stage Notes" icon={<StickyNote className="h-4 w-4" />}>
        {/* Stage filter tabs */}
        <div className="flex gap-1 flex-wrap mb-4">
          {(["all", ...ACTIVE_STAGES, "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveNotesStage(s as PipelineStage | "all")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeNotesStage === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All" : STAGE_LABELS[s as PipelineStage]}
            </button>
          ))}
        </div>

        {/* Notes list */}
        {notesLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : filteredNotes.length > 0 ? (
          <div className="space-y-2 mb-4">
            {filteredNotes.map((note: { id: number; stage: string; note: string; recruiterName?: string | null; createdAt: Date | string }) => (
              <div key={note.id} className="bg-muted/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STAGE_BADGE[note.stage as PipelineStage] ?? ""}`}>
                    {STAGE_LABELS[note.stage as PipelineStage] ?? note.stage}
                  </span>
                  {note.recruiterName && (
                    <span className="text-xs text-muted-foreground">{note.recruiterName}</span>
                  )}
                  <span className="text-xs text-muted-foreground/60 ml-auto">
                    {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{note.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/50 mb-4">No notes for this filter</p>
        )}

        {/* Add note */}
        <div className="border-t border-border/60 pt-4 space-y-2">
          <div className="flex gap-2">
            <Select value={noteStage} onValueChange={(v) => setNoteStage(v as PipelineStage)}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([...ACTIVE_STAGES, "rejected"] as const).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note for this stage..."
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="text-sm resize-none"
            />
            <Button size="sm" onClick={handleAddNote} disabled={addNote.isPending} className="self-end h-9 gap-1">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Activity Timeline ── */}
      <SectionCard title="Activity Timeline" icon={<Activity className="h-4 w-4" />}>
        {!activityEntries || activityEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />
            <div className="space-y-4">
              {activityEntries.map((entry: {
                id: number;
                action: string;
                fromStage?: string | null;
                toStage?: string | null;
                detail?: string | null;
                performedBy?: string | null;
                createdAt: Date | string;
              }) => (
                <div key={entry.id} className="flex items-start gap-3 pl-1">
                  <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 z-10">
                    {activityIcon(entry.action)}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm text-foreground font-medium leading-snug">
                      {activityLabel(entry)}
                    </p>
                    {entry.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.detail}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {entry.performedBy && (
                        <span className="text-xs text-muted-foreground">{entry.performedBy}</span>
                      )}
                      <span className="text-xs text-muted-foreground/60">
                        {new Date(entry.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Agent Credentials ── */}
      <SectionCard title="Agent Portal Access" icon={<UserCheck className="h-4 w-4" />}>
        <div className="space-y-4">
          {credentials?.exists ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-foreground">Credentials active</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground">Trainee ID:</span>
                <span className="text-sm font-mono font-semibold">{credentials.traineeCode}</span>
              </div>
              {/* Credential status grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 rounded-lg border bg-card text-xs">
                  <p className="text-muted-foreground font-medium mb-0.5">First Login</p>
                  {credentials.firstLoginAt ? (
                    <p className="text-emerald-700 font-semibold">{new Date(credentials.firstLoginAt).toLocaleString()}</p>
                  ) : (
                    <p className="text-orange-600 font-semibold">Never logged in</p>
                  )}
                </div>
                <div className="p-2 rounded-lg border bg-card text-xs">
                  <p className="text-muted-foreground font-medium mb-0.5">Last Login</p>
                  {credentials.lastLoginAt ? (
                    <p className="text-foreground font-semibold">{new Date(credentials.lastLoginAt).toLocaleString()}</p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
                <div className="p-2 rounded-lg border bg-card text-xs">
                  <p className="text-muted-foreground font-medium mb-0.5">Password Status</p>
                  {credentials.mustChangePassword ? (
                    <p className="text-amber-600 font-semibold">Temp password active</p>
                  ) : (
                    <p className="text-emerald-700 font-semibold">Password set by agent</p>
                  )}
                  {credentials.passwordResetAt && (
                    <p className="text-muted-foreground mt-0.5">Reset: {new Date(credentials.passwordResetAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              {showGeneratedPassword && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-amber-800">New password generated — share this once:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded">{showGeneratedPassword}</code>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(showGeneratedPassword!); toast.success("Password copied"); }}>
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700">This password will not be shown again.</p>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const tc2 = (candidate as Record<string, unknown>)?.traineeCode as string | null;
                    if (!tc2) { toast.error("No Trainee ID assigned"); return; }
                    const result = await generateCredentialsMutation.mutateAsync({ candidateId: id, traineeCode: tc2 });
                    setShowGeneratedPassword(result.password);
                  }}
                  disabled={generateCredentialsMutation.isPending}
                >
                  Regenerate Password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => resetPasswordMutation.mutate({ candidateId: id })}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password (Temp)"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No agent portal access yet. Generate credentials to allow this candidate to log in as an agent.</p>
              {!(candidate as Record<string, unknown>)?.traineeCode && (
                <p className="text-xs text-amber-600">⚠ Assign a Trainee ID first before generating credentials.</p>
              )}
              <Button
                size="sm"
                onClick={async () => {
                  const tc = (candidate as Record<string, unknown>)?.traineeCode as string | null;
                  if (!tc) { toast.error("Assign a Trainee ID first"); return; }
                  const result = await generateCredentialsMutation.mutateAsync({ candidateId: id, traineeCode: tc });
                  setShowGeneratedPassword(result.password);
                }}
                disabled={generateCredentialsMutation.isPending}
                className="text-white"
                style={{ background: "oklch(0.32 0.18 28)" }}
              >
                Generate Credentials
              </Button>
              {showGeneratedPassword && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-amber-800">Credentials created — share this password once:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded">{showGeneratedPassword}</code>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(showGeneratedPassword!); toast.success("Password copied"); }}>
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700">This password will not be shown again.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Performance ── */}
      <SectionCard title="Performance" icon={<Activity className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Operations performance records per period</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPerfForm({ period: "", callsMade: "", leadsGenerated: "", targetsHit: "", totalTargets: "", qualityScore: "", attendanceRate: "", notes: "" }); setPerfDialogOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
            </Button>
          </div>
          {!performanceRecords || performanceRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No performance records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {performanceRecords.map((rec: Record<string, unknown>) => (
                <div key={rec.id as number} className="p-4 border border-border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{rec.period as string}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePerformanceMutation.mutate({ id: rec.id as number })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Calls Made", value: rec.callsMade },
                      { label: "Leads Generated", value: rec.leadsGenerated },
                      { label: "Targets Hit", value: rec.targetsHit != null ? `${rec.targetsHit} / ${rec.totalTargets ?? "?"}` : null },
                      { label: "Quality Score", value: rec.qualityScore != null ? `${rec.qualityScore}%` : null },
                      { label: "Attendance Rate", value: rec.attendanceRate != null ? `${rec.attendanceRate}%` : null },
                    ].map(({ label, value }) => value != null && (
                      <div key={label} className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                  {rec.notes != null && <p className="text-xs text-muted-foreground italic">{String(rec.notes)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Metadata ── */}
      <div className="text-xs text-muted-foreground/50 flex gap-4 pb-2">
        <span>Added {new Date(candidate.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        <span>Updated {new Date(candidate.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      </div>

      {/* ─────────────────────── Dialogs ─────────────────────── */}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Candidate Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Personal */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Age</Label>
                  <Input type="number" min={16} max={80} placeholder="e.g. 24" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input placeholder="e.g. Cairo, Alexandria" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Application */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Application Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select value={editForm.source || "none"} onValueChange={(v) => setEditForm({ ...editForm, source: v === "none" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
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
                <div className="space-y-1.5">
                  <Label>Wave <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" min={1} placeholder="e.g. 1" value={editForm.wave} onChange={(e) => setEditForm({ ...editForm, wave: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>CV / Resume Link</Label>
                  <Input placeholder="https://..." value={editForm.resumeLink} onChange={(e) => setEditForm({ ...editForm, resumeLink: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Screening */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Screening Results</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Voice Note Rating</Label>
                  <StarRating
                    value={editForm.voiceNoteRating}
                    onChange={(v) => setEditForm({ ...editForm, voiceNoteRating: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Screening Comments</Label>
                  <Textarea
                    rows={2}
                    placeholder="Notes from voice note review..."
                    value={editForm.screeningNotes}
                    onChange={(e) => setEditForm({ ...editForm, screeningNotes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Communication Links</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Google Meet Link</Label>
                  <Input placeholder="https://meet.google.com/..." value={editForm.meetLink} onChange={(e) => setEditForm({ ...editForm, meetLink: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teams Invitation Link</Label>
                  <Input placeholder="https://teams.microsoft.com/..." value={editForm.teamsLink} onChange={(e) => setEditForm({ ...editForm, teamsLink: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Notes */}
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

      {/* Reject / No Show Dialog */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!open) { setRejectOpen(false); setIsNoShow(false); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNoShow ? "Mark as No-Show" : "Reject Candidate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              {isNoShow
                ? <><strong>{candidate.name}</strong> will be marked as a no-show and rejected from the pipeline.</>
                : <>Rejecting <strong>{candidate.name}</strong>. A reason is required.</>}
            </p>
            {!isNoShow && (
              <div className="grid gap-1.5">
                {REJECTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setRejectReason(preset)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      rejectReason === preset
                        ? "border-destructive/60 bg-destructive/5 text-destructive"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Did not meet language requirements"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus={isNoShow}
              />
              <p className="text-xs text-muted-foreground">This will be logged in the activity timeline.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setIsNoShow(false); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={updateStatus.isPending || !rejectReason.trim()}
            >
              {updateStatus.isPending ? "Rejecting..." : isNoShow ? "Confirm No-Show" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Record Dialog */}
      <Dialog open={perfDialogOpen} onOpenChange={setPerfDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Performance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Period <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. April 2026, Week 1" value={perfForm.period} onChange={(e) => setPerfForm({ ...perfForm, period: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Calls Made</Label>
                <Input type="number" min={0} placeholder="0" value={perfForm.callsMade} onChange={(e) => setPerfForm({ ...perfForm, callsMade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Leads Generated</Label>
                <Input type="number" min={0} placeholder="0" value={perfForm.leadsGenerated} onChange={(e) => setPerfForm({ ...perfForm, leadsGenerated: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Targets Hit</Label>
                <Input type="number" min={0} placeholder="0" value={perfForm.targetsHit} onChange={(e) => setPerfForm({ ...perfForm, targetsHit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Total Targets</Label>
                <Input type="number" min={0} placeholder="0" value={perfForm.totalTargets} onChange={(e) => setPerfForm({ ...perfForm, totalTargets: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Quality Score (%)</Label>
                <Input type="number" min={0} max={100} placeholder="0-100" value={perfForm.qualityScore} onChange={(e) => setPerfForm({ ...perfForm, qualityScore: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Attendance Rate (%)</Label>
                <Input type="number" min={0} max={100} placeholder="0-100" value={perfForm.attendanceRate} onChange={(e) => setPerfForm({ ...perfForm, attendanceRate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={perfForm.notes} onChange={(e) => setPerfForm({ ...perfForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!perfForm.period.trim()) { toast.error("Period is required"); return; }
                upsertPerformanceMutation.mutate({
                  candidateId: id,
                  period: perfForm.period.trim(),
                  callsMade: perfForm.callsMade ? parseInt(perfForm.callsMade) : null,
                  leadsGenerated: perfForm.leadsGenerated ? parseInt(perfForm.leadsGenerated) : null,
                  targetsHit: perfForm.targetsHit ? parseInt(perfForm.targetsHit) : null,
                  totalTargets: perfForm.totalTargets ? parseInt(perfForm.totalTargets) : null,
                  qualityScore: perfForm.qualityScore ? parseFloat(perfForm.qualityScore) : null,
                  attendanceRate: perfForm.attendanceRate ? parseFloat(perfForm.attendanceRate) : null,
                  notes: perfForm.notes.trim() || null,
                });
              }}
              disabled={upsertPerformanceMutation.isPending}
            >
              {upsertPerformanceMutation.isPending ? "Saving..." : "Save Record"}
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
