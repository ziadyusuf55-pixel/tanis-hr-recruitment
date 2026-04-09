export const PIPELINE_STAGES = [
  "applied",
  "shortlisted",
  "interviewed",
  "offered",
  "hired",
  "rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interviewed: "Interviewed",
  offered: "Team Invitation Sent",
  hired: "Hired",
  rejected: "Rejected",
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  applied: "stage-applied",
  shortlisted: "stage-shortlisted",
  interviewed: "stage-interviewed",
  offered: "stage-offered",
  hired: "stage-hired",
  rejected: "stage-rejected",
};

export const STAGE_BG: Record<PipelineStage, string> = {
  applied: "bg-blue-50 border-blue-200",
  shortlisted: "bg-sky-50 border-sky-200",
  interviewed: "bg-violet-50 border-violet-200",
  offered: "bg-orange-50 border-orange-200",
  hired: "bg-emerald-50 border-emerald-200",
  rejected: "bg-red-50 border-red-200",
};

export const STAGE_HEADER: Record<PipelineStage, string> = {
  applied: "bg-blue-600",
  shortlisted: "bg-sky-500",
  interviewed: "bg-violet-600",
  offered: "bg-orange-500",
  hired: "bg-emerald-600",
  rejected: "bg-red-500",
};

export const STAGE_DOT: Record<PipelineStage, string> = {
  applied: "bg-blue-500",
  shortlisted: "bg-sky-500",
  interviewed: "bg-violet-500",
  offered: "bg-orange-500",
  hired: "bg-emerald-500",
  rejected: "bg-red-500",
};

/** Returns the next stage in the pipeline (excluding rejected) */
export function getNextStage(current: PipelineStage): PipelineStage | null {
  const forward = ["applied", "shortlisted", "interviewed", "offered", "hired"] as const;
  const idx = forward.indexOf(current as (typeof forward)[number]);
  if (idx === -1 || idx === forward.length - 1) return null;
  return forward[idx + 1];
}
