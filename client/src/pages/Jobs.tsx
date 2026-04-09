import { Redirect } from "wouter";

// Job postings have been removed — all candidates are Call Center Agents.
export default function Jobs() {
  return <Redirect to="/candidates" />;
}
