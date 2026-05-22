import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Wallet, Building2, Star, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type PaymentMethod = {
  id: number;
  traineeCode: string;
  type: "wallet" | "bank";
  walletProvider?: "vodafone_cash" | "orange_cash" | null;
  walletPhone?: string | null;
  walletName?: string | null;
  bankName?: string | null;
  bankAccountOrPhone?: string | null;
  bankFullName?: string | null;
  isPreferred: boolean;
  adminComment?: string | null;
};

type AgentGroup = {
  traineeCode: string;
  agentFullName: string | null;
  agentAlias: string | null;
  methods: PaymentMethod[];
};

function providerLabel(m: PaymentMethod): string {
  if (m.type === "wallet") {
    return m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "Wallet";
  }
  return m.bankName ?? "Bank Account";
}

function accountValue(m: PaymentMethod): string {
  if (m.type === "wallet") return m.walletPhone ?? "—";
  return m.bankAccountOrPhone ?? "—";
}

function holderName(m: PaymentMethod): string {
  return (m.type === "wallet" ? m.walletName : m.bankFullName) ?? "—";
}

export default function PaymentPreferences() {
  const { data: grouped = [], isLoading } = trpc.paymentMethods.listGrouped.useQuery();
  const { data: agents = [] } = trpc.workforce.list.useQuery({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "not_submitted" | "preferred_only">("all");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const submittedCodes = useMemo(() => new Set((grouped as AgentGroup[]).map(g => g.traineeCode)), [grouped]);
  const allAgents = useMemo(() => (agents as Array<{ traineeCode: string; fullName: string; alias?: string | null }>), [agents]);

  const filteredGroups = useMemo(() => {
    const groups = grouped as AgentGroup[];
    let result: AgentGroup[];

    if (statusFilter === "not_submitted") {
      result = allAgents
        .filter(a => !submittedCodes.has(a.traineeCode))
        .map(a => ({
          traineeCode: a.traineeCode,
          agentFullName: a.fullName,
          agentAlias: a.alias ?? null,
          methods: [] as PaymentMethod[],
        }));
    } else if (statusFilter === "submitted") {
      result = groups;
    } else if (statusFilter === "preferred_only") {
      result = groups.map(g => ({ ...g, methods: g.methods.filter(m => m.isPreferred) })).filter(g => g.methods.length > 0);
    } else {
      result = groups;
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g => {
        const name = (g.agentFullName ?? "").toLowerCase();
        const alias = (g.agentAlias ?? "").toLowerCase();
        const code = g.traineeCode.toLowerCase();
        return name.includes(q) || alias.includes(q) || code.includes(q);
      });
    }

    return result;
  }, [grouped, allAgents, submittedCodes, statusFilter, search]);

  function toggleExpand(code: string) {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function exportCSV() {
    const groups = grouped as AgentGroup[];
    const rows: string[][] = [["Trainee Code", "Agent Name", "Alias", "Type", "Provider/Bank", "Account/Phone", "Holder Name", "Preferred", "Admin Note"]];
    for (const g of groups) {
      if (g.methods.length === 0) {
        rows.push([g.traineeCode, g.agentFullName ?? "", g.agentAlias ?? "", "—", "—", "—", "—", "—", "—"]);
      } else {
        for (const m of g.methods) {
          rows.push([
            g.traineeCode,
            g.agentFullName ?? "",
            g.agentAlias ?? "",
            m.type,
            providerLabel(m),
            accountValue(m),
            holderName(m),
            m.isPreferred ? "Yes" : "No",
            m.adminComment ?? "",
          ]);
        }
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "payment_preferences.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  }

  const STATUS_FILTERS: { key: typeof statusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "submitted", label: "Submitted" },
    { key: "not_submitted", label: "Not Submitted" },
    { key: "preferred_only", label: "Preferred Only" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Payment Preferences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Agent payment methods grouped by agent</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, alias, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filteredGroups.length} agent{filteredGroups.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Grouped list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No agents match the current filter.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y">
            {filteredGroups.map(g => {
              const isExpanded = expandedCodes.has(g.traineeCode);
              const hasPreferred = g.methods.some(m => m.isPreferred);
              const methodCount = g.methods.length;

              return (
                <div key={g.traineeCode}>
                  {/* Agent row */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => { if (methodCount > 0) toggleExpand(g.traineeCode); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{g.agentFullName ?? g.traineeCode}</span>
                        <span className="text-xs text-muted-foreground">
                          {g.traineeCode}{g.agentAlias ? ` · ${g.agentAlias}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {methodCount === 0 ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">No methods</Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[10px]">
                            {methodCount} method{methodCount !== 1 ? "s" : ""}
                          </Badge>
                          {hasPreferred && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                        </>
                      )}
                      {methodCount > 0 && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded methods */}
                  {isExpanded && methodCount > 0 && (
                    <div className="bg-muted/20 border-t divide-y">
                      {g.methods.map(m => (
                        <div key={m.id} className="px-6 py-3 flex items-center gap-3 flex-wrap">
                          <div className="w-7 h-7 rounded-md bg-background border flex items-center justify-center shrink-0">
                            {m.type === "wallet"
                              ? <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                              : <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{providerLabel(m)}</span>
                              {m.isPreferred && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Preferred
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {accountValue(m)} · {holderName(m)}
                            </p>
                            {m.adminComment && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">Note: {m.adminComment}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
