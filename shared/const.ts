export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** AUX (not-ready) reason codes — the single list used by the server schema and both portals. */
export const AUX_TYPES = ["break", "lunch", "bathroom", "training", "meeting", "coaching", "system_down", "idle", "other"] as const;
export type AuxType = (typeof AUX_TYPES)[number];
/** Display labels — the ONE list every picker (portal card, tracker page, admin edit) renders from. */
export const AUX_TYPE_LABELS: Record<AuxType, string> = {
  break: "Break", lunch: "Lunch", bathroom: "Bathroom", training: "Training", meeting: "Meeting",
  coaching: "Coaching", system_down: "System / IT Down", idle: "Idle / No Work", other: "Other",
};
export const AUX_TYPE_OPTIONS = AUX_TYPES.map(value => ({ value, label: AUX_TYPE_LABELS[value] }));
