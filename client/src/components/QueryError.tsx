import { AlertTriangle, RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/errorMessage";

/**
 * Shared load-failure banner. List pages used to swallow query errors and
 * render their "no data" empty state — which reads as "everything is fine"
 * when the server is actually down or the role is missing a permission.
 * Render it above the list: `<QueryError error={error} onRetry={refetch} />`.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-3 flex items-start gap-2.5 text-sm text-red-800">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Couldn't load this data</p>
        <p className="text-xs mt-0.5 text-red-700">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border border-red-300 hover:bg-red-100"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  );
}
