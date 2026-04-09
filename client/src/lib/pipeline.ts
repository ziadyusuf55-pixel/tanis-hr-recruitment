export const PIPELINE_STAGES = [
  "applied",
  "whatsapp_sent",
  "voice_note_reviewed",
  "interview_scheduled",
  "accepted",
  "teams_invitation_sent",
  "rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Active stages (not rejected) — shown as pipeline columns
export const ACTIVE_STAGES = [
  "applied",
  "whatsapp_sent",
  "voice_note_reviewed",
  "interview_scheduled",
  "accepted",
  "teams_invitation_sent",
] as const;

export const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: "Applied",
  whatsapp_sent: "WhatsApp Sent",
  voice_note_reviewed: "Voice Note Reviewed",
  interview_scheduled: "Interview Scheduled",
  accepted: "Accepted",
  teams_invitation_sent: "Teams Invitation Sent",
  rejected: "Rejected",
};

export const STAGE_SHORT_LABELS: Record<PipelineStage, string> = {
  applied: "Applied",
  whatsapp_sent: "WhatsApp",
  voice_note_reviewed: "Voice Note",
  interview_scheduled: "Interview",
  accepted: "Accepted",
  teams_invitation_sent: "Teams Invite",
  rejected: "Rejected",
};

export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  applied: "Candidate applied via email, form, or LinkedIn",
  whatsapp_sent: "Intro WhatsApp message sent — awaiting voice note",
  voice_note_reviewed: "Voice note received and reviewed — ready for interview",
  interview_scheduled: "Google Meet interview link sent",
  accepted: "Interview passed — candidate accepted",
  teams_invitation_sent: "Microsoft Teams training invitation sent",
  rejected: "Candidate rejected",
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  applied: "stage-applied",
  whatsapp_sent: "stage-whatsapp",
  voice_note_reviewed: "stage-voice",
  interview_scheduled: "stage-interview",
  accepted: "stage-accepted",
  teams_invitation_sent: "stage-teams",
  rejected: "stage-rejected",
};

export const STAGE_BG: Record<PipelineStage, string> = {
  applied: "bg-slate-50 border-slate-200",
  whatsapp_sent: "bg-green-50 border-green-200",
  voice_note_reviewed: "bg-blue-50 border-blue-200",
  interview_scheduled: "bg-violet-50 border-violet-200",
  accepted: "bg-emerald-50 border-emerald-200",
  teams_invitation_sent: "bg-indigo-50 border-indigo-200",
  rejected: "bg-red-50 border-red-200",
};

export const STAGE_HEADER: Record<PipelineStage, string> = {
  applied: "bg-slate-500",
  whatsapp_sent: "bg-green-500",
  voice_note_reviewed: "bg-blue-500",
  interview_scheduled: "bg-violet-600",
  accepted: "bg-emerald-600",
  teams_invitation_sent: "bg-indigo-600",
  rejected: "bg-red-500",
};

export const STAGE_DOT: Record<PipelineStage, string> = {
  applied: "bg-slate-400",
  whatsapp_sent: "bg-green-500",
  voice_note_reviewed: "bg-blue-500",
  interview_scheduled: "bg-violet-500",
  accepted: "bg-emerald-500",
  teams_invitation_sent: "bg-indigo-500",
  rejected: "bg-red-500",
};

export const STAGE_BADGE: Record<PipelineStage, string> = {
  applied: "bg-slate-100 text-slate-700 border-slate-200",
  whatsapp_sent: "bg-green-50 text-green-700 border-green-200",
  voice_note_reviewed: "bg-blue-50 text-blue-700 border-blue-200",
  interview_scheduled: "bg-violet-50 text-violet-700 border-violet-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  teams_invitation_sent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

/** Returns the next stage in the pipeline (excluding rejected) */
export function getNextStage(current: PipelineStage): PipelineStage | null {
  const forward = ACTIVE_STAGES;
  const idx = forward.indexOf(current as (typeof forward)[number]);
  if (idx === -1 || idx === forward.length - 1) return null;
  return forward[idx + 1];
}
