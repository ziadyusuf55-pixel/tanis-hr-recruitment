import { ViolationTracker } from "@/components/ViolationTracker";
import { Star } from "lucide-react";

/**
 * Quality — the landing page for the nightly push from the admin sheet's
 * Quality tab. Reference/insight only: no payroll effect.
 */
export default function QualityLog() {
  return (
    <ViolationTracker
      category="quality"
      title="Quality"
      subtitle="Synced nightly from the Quality sheet. Reference only — payroll is calculated separately."
      icon={<Star className="w-5 h-5" style={{ color: "#FF6A13" }} />}
    />
  );
}
