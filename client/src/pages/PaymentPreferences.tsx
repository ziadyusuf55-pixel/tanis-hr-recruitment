import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Wallet, Building2, Star } from "lucide-react";
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

function methodLabel(m: PaymentMethod): string {
  if (m.type === "wallet") {
    const prov = m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "Wallet";
    return `${prov} · ${m.walletPhone ?? "—"}`;
  }
  return `${m.bankName ?? "Bank"} · ${m.bankAccountOrPhone ?? "—"}`;
}

function accountName(m: PaymentMethod): string {
  return m.type === "wallet" ? (m.walletName ?? "—") : (m.bankFullName ?? "—");
}

export default function PaymentPreferences() {
  const { data: allMethods = [], isLoading } = trpc.paymentMethods.listAll.useQuery();
  const { data: agents = [] } = trpc.workforce.list.useQuery({});

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "wallet" | "bank">("all");

  // Build a map of traineeCode → agent name/alias
  const agentMap = useMemo(() => {
    const m: Record<string, { fullName: string; alias?: string | null }> = {};
    (agents as Array<{ traineeCode: string; fullName: string; alias?: string | null }>).forEach(a => {
      m[a.traineeCode] = { fullName: a.fullName, alias: a.alias };
    });
    return m;
  }, [agents]);

  const filtered = useMemo(() => {
    return (allMethods as PaymentMethod[]).filter(m => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const agent = agentMap[m.traineeCode];
        const name = agent?.fullName?.toLowerCase() ?? "";
        const alias = agent?.alias?.toLowerCase() ?? "";
        const code = m.traineeCode.toLowerCase();
        if (!name.includes(q) && !alias.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [allMethods, typeFilter, search, agentMap]);

  function exportCSV() {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    const headers = ["Agent Code", "Full Name", "Alias", "Type", "Provider / Bank", "Account / Phone", "Name on Account", "Preferred", "Admin Comment"];
    const rows = filtered.map(m => {
      const agent = agentMap[m.traineeCode];
      return [
        m.traineeCode,
        agent?.fullName ?? "",
        agent?.alias ?? "",
        m.type === "wallet" ? "Wallet" : "Bank",
        m.type === "wallet"
          ? (m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "")
          : (m.bankName ?? ""),
        m.type === "wallet" ? (m.walletPhone ?? "") : (m.bankAccountOrPhone ?? ""),
        accountName(m),
        m.isPreferred ? "Yes" : "No",
        m.adminComment ?? "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payment-preferences-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} records`);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payment Preferences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All agent payment methods in one view</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, alias, or code..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            {(["all", "wallet", "bank"] as const).map(t => (
              <Button
                key={t}
                size="sm"
                variant={typeFilter === t ? "default" : "outline"}
                onClick={() => setTypeFilter(t)}
                className="capitalize"
              >
                {t === "all" ? "All Types" : t === "wallet" ? "Wallets" : "Bank Accounts"}
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payment methods found</p>
            <p className="text-sm mt-1">Agents add their payment preferences from their portal.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider / Bank</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account / Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name on Account</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Preferred</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Admin Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(m => {
                  const agent = agentMap[m.traineeCode];
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{agent?.fullName ?? m.traineeCode}</p>
                        <p className="text-xs text-muted-foreground">{m.traineeCode}{agent?.alias ? ` · ${agent.alias}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="gap-1">
                          {m.type === "wallet" ? <Wallet className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {m.type === "wallet" ? "Wallet" : "Bank"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {m.type === "wallet"
                          ? (m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "—")
                          : (m.bankName ?? "—")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{m.type === "wallet" ? (m.walletPhone ?? "—") : (m.bankAccountOrPhone ?? "—")}</td>
                      <td className="px-4 py-3">{accountName(m)}</td>
                      <td className="px-4 py-3">
                        {m.isPreferred && (
                          <span className="flex items-center gap-1 text-amber-500 text-xs font-medium">
                            <Star className="h-3 w-3 fill-current" /> Preferred
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">{m.adminComment ?? "—"}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
