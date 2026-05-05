#!/usr/bin/env python3
"""Fix PaymentMethodsTab and DocumentsTab type mismatches in AgentPortal.tsx."""

path = "/home/ubuntu/tanis-hr-recruitment/client/src/pages/AgentPortal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# ── Fix PaymentItem type to match actual DB schema ──────────────────────────
old_payment_type = """type PaymentItem = {
  id: number;
  methodType: string;
  provider: string | null;
  phoneNumber: string | null;
  accountNumber: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  isPreferred: boolean;
  adminComment: string | null;
  createdAt: number;
};"""

new_payment_type = """type PaymentItem = {
  id: number;
  traineeCode: string;
  type: "wallet" | "bank";
  walletProvider: "vodafone_cash" | "orange_cash" | null;
  walletPhone: string | null;
  walletName: string | null;
  bankName: string | null;
  bankAccountOrPhone: string | null;
  bankFullName: string | null;
  isPreferred: boolean;
  adminComment: string | null;
  createdAt: Date;
  updatedAt: Date;
};"""

content = content.replace(old_payment_type, new_payment_type)

# ── Fix DocItem type to match actual DB schema ──────────────────────────────
old_doc_type = """type DocItem = {
  id: number;
  docType: string;
  fileUrl: string;
  status: string;
  adminComment: string | null;
  uploadedAt: number;
};"""

new_doc_type = """type DocItem = {
  id: number;
  traineeCode: string;
  docType: string;
  fileUrl: string;
  fileName: string | null;
  status: "pending" | "approved" | "rejected";
  adminComment: string | null;
  uploadedAt: Date;
  updatedAt: Date;
};"""

content = content.replace(old_doc_type, new_doc_type)

# ── Fix docs cast: (docs as DocItem[]) — use unknown first ──────────────────
content = content.replace(
    "const docMap = new Map((docs as DocItem[]).map((d) => [d.docType, d]));",
    "const docMap = new Map((docs as unknown as DocItem[]).map((d) => [d.docType, d]));"
)

# ── Fix payment methods casts ────────────────────────────────────────────────
content = content.replace(
    "(methods as PaymentItem[])",
    "(methods as unknown as PaymentItem[])"
)

# ── Fix add mutation to use upsert ──────────────────────────────────────────
content = content.replace(
    "const addMutation = trpc.paymentMethods.add.useMutation({",
    "const addMutation = trpc.paymentMethods.upsert.useMutation({"
)

# ── Fix handleAdd to use correct field names ────────────────────────────────
old_handle_add = """  async function handleAdd() {
    await addMutation.mutateAsync({
      methodType: formType,
      provider: formType === "wallet" ? provider : bankName,
      phoneNumber: formType === "wallet" ? phone : (accountPhone || null),
      accountNumber: formType === "bank" ? (accountNumber || null) : null,
      bankName: formType === "bank" ? bankName : null,
      accountHolderName: holderName,
    });
  }"""

new_handle_add = """  async function handleAdd() {
    await addMutation.mutateAsync({
      type: formType,
      walletProvider: formType === "wallet" ? (provider === "Vodafone Cash" ? "vodafone_cash" : "orange_cash") : undefined,
      walletPhone: formType === "wallet" ? phone : undefined,
      walletName: formType === "wallet" ? holderName : undefined,
      bankName: formType === "bank" ? bankName : undefined,
      bankAccountOrPhone: formType === "bank" ? (accountNumber || accountPhone || undefined) : undefined,
      bankFullName: formType === "bank" ? holderName : undefined,
    });
  }"""

content = content.replace(old_handle_add, new_handle_add)

# ── Fix payment card display to use correct field names ─────────────────────
old_card = """                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>{m.provider ?? (m.methodType === "wallet" ? "Wallet" : "Bank Account")}</p>
                      {m.isPreferred && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>Preferred</span>}
                    </div>
                    <p className="text-xs" style={{ color: theme.textMuted }}>
                      {m.methodType === "wallet" ? m.phoneNumber : (m.accountNumber ?? m.phoneNumber ?? "\u2014")} \u00b7 {m.accountHolderName}
                    </p>"""

new_card = """                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>
                        {m.type === "wallet" ? (m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "Wallet") : (m.bankName ?? "Bank Account")}
                      </p>
                      {m.isPreferred && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>Preferred</span>}
                    </div>
                    <p className="text-xs" style={{ color: theme.textMuted }}>
                      {m.type === "wallet" ? m.walletPhone : (m.bankAccountOrPhone ?? "\u2014")} \u00b7 {m.type === "wallet" ? m.walletName : m.bankFullName}
                    </p>"""

content = content.replace(old_card, new_card)

# ── Fix wallet icon check ────────────────────────────────────────────────────
content = content.replace(
    "{m.methodType === \"wallet\" ? <Wallet",
    "{m.type === \"wallet\" ? <Wallet"
)
content = content.replace(
    ": <CreditCard className=\"w-4 h-4\" style={{ color: BRAND_LIGHT }} />}",
    ": <CreditCard className=\"w-4 h-4\" style={{ color: BRAND_LIGHT }} />}"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done. Types fixed.")
