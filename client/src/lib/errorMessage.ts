/**
 * Maps raw tRPC/database error messages to human-readable ones.
 * Use this instead of `e.message` in toast.error() calls.
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  const raw: string =
    typeof err === "string"
      ? err
      : (err as { message?: string })?.message ?? fallback;

  // MySQL duplicate entry errors
  if (/Duplicate entry/i.test(raw)) {
    if (/trainee_code/i.test(raw) || /traineeCode/i.test(raw)) {
      return "This trainee ID is already taken. Please choose a different one.";
    }
    if (/phone/i.test(raw)) {
      return "A candidate with this phone number already exists.";
    }
    if (/email/i.test(raw)) {
      return "This email address is already in use.";
    }
    if (/crdts/i.test(raw)) {
      return "This CRDTS code is already assigned to another agent.";
    }
    return "This record already exists. Please check for duplicates.";
  }

  // Not found errors
  if (/not found/i.test(raw)) {
    if (/agent/i.test(raw)) return "Agent not found. They may have been removed.";
    if (/candidate/i.test(raw)) return "Candidate not found. They may have been removed.";
    if (/request/i.test(raw)) return "Request not found.";
    if (/invite/i.test(raw)) return "Invite link is invalid or has expired.";
    return "The requested record was not found.";
  }

  // Already exists / conflict
  if (/already exists/i.test(raw) || /already used/i.test(raw)) {
    if (/admin/i.test(raw)) return "An admin account with this email already exists.";
    if (/invite/i.test(raw)) return "This invite link has already been used.";
    return "This record already exists.";
  }

  // Expired
  if (/expired/i.test(raw)) {
    if (/invite/i.test(raw)) return "This invite link has expired. Please request a new one.";
    return "This action has expired. Please try again.";
  }

  // Auth errors
  if (/unauthorized/i.test(raw) || /not authenticated/i.test(raw)) {
    return "You are not authorized to perform this action.";
  }

  // Validation errors
  if (/must be at least 2 weeks/i.test(raw)) {
    return "Leave requests must be submitted at least 2 weeks in advance.";
  }

  // File size
  if (/too large/i.test(raw) || /max 16MB/i.test(raw)) {
    return "File is too large. Maximum allowed size is 16MB.";
  }

  // DB unavailable
  if (/db unavailable/i.test(raw) || /database/i.test(raw)) {
    return "Database is temporarily unavailable. Please try again in a moment.";
  }

  // If the message looks like a technical/internal error (contains stack traces, SQL, etc.)
  if (/ER_DUP_ENTRY|SQLSTATE|errno|stack|at Object\.|at async/i.test(raw)) {
    return fallback;
  }

  // Otherwise return the message as-is (it's already human-readable from the server)
  return raw || fallback;
}
