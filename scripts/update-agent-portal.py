#!/usr/bin/env python3
"""Update AgentPortal.tsx: replace ProfileTab and append DocumentsTab + PaymentMethodsTab."""
import re

path = "/home/ubuntu/tanis-hr-recruitment/client/src/pages/AgentPortal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Replace ProfileTab ──────────────────────────────────────────────────────
old_profile_start = "function ProfileTab({ agent, theme }: { agent: AgentData; theme: Theme }) {"
old_profile_end = "// ─── Payroll Tab ─────────────────────────────────────────────────────────────"

start_idx = content.index(old_profile_start)
end_idx = content.index(old_profile_end)

new_profile = '''const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function ProfileTab({ agent, theme }: { agent: AgentData; theme: Theme }) {
  const { data: wfProfile } = trpc.workforce.getMyProfile.useQuery();
  const joinDate = wfProfile?.joinDate
    ? formatDate(new Date(wfProfile.joinDate as number))
    : agent.batch?.assignedAt
    ? formatDate(new Date(agent.batch.assignedAt))
    : "\u2014";
  const wfFields = wfProfile ? [
    { label: "Agent ID", value: wfProfile.traineeCode as string },
    { label: "Full Name", value: wfProfile.fullName as string },
    { label: "Alias / English Name", value: (wfProfile.alias as string | null) ?? "\u2014" },
    { label: "Campaign", value: (wfProfile.campaignName as string | null) ?? "\u2014" },
    { label: "Join Date", value: joinDate },
    { label: "Shift Hours", value: (wfProfile.shiftHours as string | null) ?? "\u2014" },
    { label: "Team Leader", value: (wfProfile.teamLeader as string | null) ?? "\u2014" },
    { label: "Off Day 1", value: wfProfile.offDay1 != null ? DAY_NAMES_FULL[wfProfile.offDay1 as number] : "\u2014" },
    { label: "Off Day 2", value: wfProfile.offDay2 != null ? DAY_NAMES_FULL[wfProfile.offDay2 as number] : "\u2014" },
    { label: "Phone", value: (wfProfile.phone as string | null) ?? "\u2014" },
    { label: "Email", value: (wfProfile.email as string | null) ?? "\u2014" },
  ] : [
    { label: "Full Name", value: agent.name },
    { label: "Agent ID", value: agent.traineeCode },
    { label: "Position", value: agent.positionApplied },
    { label: "Join Date", value: joinDate },
    { label: "Phone", value: agent.phone ?? "\u2014" },
    { label: "Email", value: agent.email ?? "\u2014" },
  ];
  return (
    <div className="space-y-6">
      {wfProfile && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "oklch(0.32 0.18 28 / 0.15)", border: "1px solid oklch(0.32 0.18 28 / 0.3)" }}>
          <Briefcase className="w-5 h-5 shrink-0" style={{ color: BRAND_LIGHT }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Operations Agent</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>You are part of the active workforce. Your profile is managed by your team leader.</p>
          </div>
        </div>
      )}
      <SectionTitle theme={theme}>{wfProfile ? "My Operations Profile" : "My Information"}</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wfFields.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textFaint }}>{label}</p>
            <p className="font-medium text-sm" style={{ color: theme.text }}>{value}</p>
          </div>
        ))}
      </div>
      {!wfProfile && agent.batch && (
        <>
          <SectionTitle theme={theme}>Training Batch</SectionTitle>
          <div className="rounded-xl overflow-hidden" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3" style={{ borderBottom: `1px solid ${theme.surfaceBorder}` }}>
              {[
                { label: "Batch Name", value: agent.batch.name },
                { label: "Trainer", value: agent.batch.trainerName ?? "\u2014" },
                { label: "Start Date", value: formatDate(agent.batch.startDate) },
              ].map(({ label, value }, i) => (
                <div key={label} className="p-4" style={i > 0 ? { borderLeft: `1px solid ${theme.surfaceBorder}` } : {}}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textFaint }}>{label}</p>
                  <p className="font-medium text-sm" style={{ color: theme.text }}>{value}</p>
                </div>
              ))}
            </div>
            {agent.batch.totalSessions != null && Number(agent.batch.totalSessions) > 0 && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wider" style={{ color: theme.textFaint }}>Attendance</p>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>
                    {Number(agent.batch.attendedSessions ?? 0)} / {Number(agent.batch.totalSessions)} sessions
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: theme.surfaceBorder }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.round((Number(agent.batch.attendedSessions ?? 0) / Number(agent.batch.totalSessions)) * 100)}%`,
                      background: BRAND_LIGHT,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
'''

content = content[:start_idx] + new_profile + "\n" + content[end_idx:]

# ── 2. Append DocumentsTab + PaymentMethodsTab before the type AgentData ──────
DOCS_AND_PAYMENT = '''
// ─── Documents Tab ────────────────────────────────────────────────────────────
type DocItem = {
  id: number;
  docType: string;
  fileUrl: string;
  status: string;
  adminComment: string | null;
  uploadedAt: number;
};
const DOC_LABELS: Record<string, string> = {
  national_id: "صورة بطاقة الرقم القومي (سارية)",
  qualification: "شهادة المؤهل / بيان قيد",
  cv: "CV",
  personal_photos: "2–6 صور شخصية",
  military_status: "موقف التجنيد (للذكور)",
  insurance_status: "موقف التأمينات",
  criminal_record: "فيش جنائي",
};
const REQUIRED_DOCS = Object.keys(DOC_LABELS);
function DocumentsTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.documents.listMine.useQuery();
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => utils.documents.listMine.invalidate(),
  });
  const [uploading, setUploading] = useState<string | null>(null);
  async function handleUpload(docType: string, file: File) {
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-doc", { method: "POST", body: formData });
      const { url } = await res.json() as { url: string };
      await uploadMutation.mutateAsync({ docType, fileUrl: url });
    } catch {
      // ignore
    } finally {
      setUploading(null);
    }
  }
  const docMap = new Map((docs as DocItem[]).map((d) => [d.docType, d]));
  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: "oklch(0.32 0.18 28 / 0.12)", border: "1px solid oklch(0.32 0.18 28 / 0.25)" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: theme.text }}>Required Documents for Contract</p>
        <p className="text-xs" style={{ color: theme.textMuted }}>
          Please upload all required documents below so we can prepare your employment contract. All documents must be clear and valid.
        </p>
      </div>
      <div className="space-y-3">
        {REQUIRED_DOCS.map((docType) => {
          const doc = docMap.get(docType);
          const isUploading = uploading === docType;
          return (
            <div
              key={docType}
              className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {doc?.status === "approved" ? (
                  <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />
                ) : doc?.status === "rejected" ? (
                  <XCircle className="w-5 h-5 shrink-0 text-red-500" />
                ) : doc ? (
                  <Clock className="w-5 h-5 shrink-0 text-yellow-500" />
                ) : (
                  <FileText className="w-5 h-5 shrink-0" style={{ color: theme.textFaint }} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: theme.text }}>{DOC_LABELS[docType]}</p>
                  {doc?.adminComment && (
                    <p className="text-xs mt-0.5" style={{ color: doc.status === "rejected" ? "#ef4444" : theme.textMuted }}>
                      {doc.adminComment}
                    </p>
                  )}
                  {doc && !doc.adminComment && (
                    <p className="text-xs mt-0.5 capitalize" style={{ color: doc.status === "approved" ? "#22c55e" : doc.status === "rejected" ? "#ef4444" : "#eab308" }}>
                      {doc.status === "approved" ? "Approved" : doc.status === "rejected" ? "Rejected" : "Pending Review"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
                    View
                  </a>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(docType, f); e.target.value = ""; }}
                    disabled={isUploading}
                  />
                  <span
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{ background: BRAND, color: "white", opacity: isUploading ? 0.6 : 1 }}
                  >
                    {isUploading ? <Clock className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {doc ? "Re-upload" : "Upload"}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }} />
        </div>
      )}
    </div>
  );
}
// ─── Payment Methods Tab ──────────────────────────────────────────────────────
type PaymentItem = {
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
};
const EGYPT_BANKS = [
  "Banque Misr","National Bank of Egypt","Commercial International Bank (CIB)",
  "Banque du Caire","Arab African International Bank","QNB Al Ahli",
  "HSBC Egypt","Faisal Islamic Bank","Arab Bank","Attijariwafa Bank Egypt",
  "Bank of Alexandria","Egyptian Gulf Bank","Suez Canal Bank","Al Baraka Bank Egypt",
  "Abu Dhabi Islamic Bank","Mashreq Bank Egypt","Société Arabe Internationale de Banque (SAIB)",
  "Credit Agricole Egypt","United Bank","Export Development Bank of Egypt","Other",
];
function PaymentMethodsTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: methods = [], isLoading } = trpc.paymentMethods.listMine.useQuery();
  const addMutation = trpc.paymentMethods.add.useMutation({
    onSuccess: () => { utils.paymentMethods.listMine.invalidate(); setShowForm(false); resetForm(); },
  });
  const setPreferredMutation = trpc.paymentMethods.setPreferred.useMutation({
    onSuccess: () => utils.paymentMethods.listMine.invalidate(),
  });
  const deleteMutation = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => utils.paymentMethods.listMine.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"wallet" | "bank">("wallet");
  const [provider, setProvider] = useState("Vodafone Cash");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState(EGYPT_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [holderName, setHolderName] = useState("");
  function resetForm() {
    setFormType("wallet"); setProvider("Vodafone Cash"); setPhone(""); setBankName(EGYPT_BANKS[0]);
    setAccountNumber(""); setAccountPhone(""); setHolderName("");
  }
  async function handleAdd() {
    await addMutation.mutateAsync({
      methodType: formType,
      provider: formType === "wallet" ? provider : bankName,
      phoneNumber: formType === "wallet" ? phone : (accountPhone || null),
      accountNumber: formType === "bank" ? (accountNumber || null) : null,
      bankName: formType === "bank" ? bankName : null,
      accountHolderName: holderName,
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle theme={theme}>Payment Methods</SectionTitle>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: BRAND, color: "white" }}
        >
          + Add Method
        </button>
      </div>
      {showForm && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>New Payment Method</p>
          <div className="flex gap-2">
            {(["wallet", "bank"] as const).map((t) => (
              <button key={t} onClick={() => setFormType(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
                style={{ background: formType === t ? BRAND : theme.surfaceBorder, color: formType === t ? "white" : theme.textMuted }}>
                {t === "wallet" ? "Wallet" : "Bank Account"}
              </button>
            ))}
          </div>
          {formType === "wallet" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  <option>Vodafone Cash</option>
                  <option>Orange Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Full Name (as registered)</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
            </div>
          )}
          {formType === "bank" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Bank Name</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {EGYPT_BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Account Number (optional)</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Phone Number (optional)</label>
                <input value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Full Name (account holder)</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={addMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: BRAND, color: "white" }}>
              {addMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }} />
        </div>
      ) : (methods as PaymentItem[]).length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" style={{ color: theme.textFaint }} />}
          title="No payment methods yet" subtitle="Add a wallet or bank account to receive your salary." theme={theme} />
      ) : (
        <div className="space-y-3">
          {(methods as PaymentItem[]).map((m) => (
            <div key={m.id} className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${m.isPreferred ? "oklch(0.32 0.18 28 / 0.5)" : theme.surfaceBorder}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "22" }}>
                    {m.methodType === "wallet" ? <Wallet className="w-4 h-4" style={{ color: BRAND_LIGHT }} /> : <CreditCard className="w-4 h-4" style={{ color: BRAND_LIGHT }} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>{m.provider ?? (m.methodType === "wallet" ? "Wallet" : "Bank Account")}</p>
                      {m.isPreferred && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>Preferred</span>}
                    </div>
                    <p className="text-xs" style={{ color: theme.textMuted }}>
                      {m.methodType === "wallet" ? m.phoneNumber : (m.accountNumber ?? m.phoneNumber ?? "—")} · {m.accountHolderName}
                    </p>
                    {m.adminComment && (
                      <p className="text-xs mt-1 italic" style={{ color: "#eab308" }}>Admin note: {m.adminComment}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!m.isPreferred && (
                    <button onClick={() => setPreferredMutation.mutate({ id: m.id })}
                      className="text-xs px-2 py-1 rounded-lg" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
                      Set Preferred
                    </button>
                  )}
                  <button onClick={() => { if (confirm("Remove this payment method?")) deleteMutation.mutate({ id: m.id }); }}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: "#ef444422", color: "#ef4444" }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

# Insert before "type AgentData"
insert_marker = "type AgentData = {"
idx = content.index(insert_marker)
content = content[:idx] + DOCS_AND_PAYMENT + "\n" + content[idx:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done. File updated successfully.")
