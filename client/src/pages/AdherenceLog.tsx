import { ViolationTracker } from "@/components/ViolationTracker";
import { AlertCircle } from "lucide-react";

/**
 * Adherence & Attendance — the landing page for the nightly push from the
 * Adherence sheet. Reference/insight only: payroll is calculated in Python
 * from the same sheet, so nothing here touches a payslip.
 */
export default function AdherenceLog() {
  return (
    <ViolationTracker
      category="attendance"
      title="Adherence & Attendance"
      subtitle="Synced nightly from the Adherence sheet. Reference only — payroll is calculated separately."
      icon={<AlertCircle className="w-5 h-5" style={{ color: "#FF6A13" }} />}
    />
  );
}
