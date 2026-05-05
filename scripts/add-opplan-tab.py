#!/usr/bin/env python3
"""Add OperationPlanTab to AgentPortal.tsx and wire it up."""

path = "/home/ubuntu/tanis-hr-recruitment/client/src/pages/AgentPortal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Update Tab type ────────────────────────────────────────────────────────
content = content.replace(
    'type Tab = "profile" | "payroll" | "requests" | "referrals" | "documents" | "payment";',
    'type Tab = "profile" | "payroll" | "requests" | "referrals" | "documents" | "payment" | "schedule";'
)

# ── 2. Add Calendar import (lucide) ──────────────────────────────────────────
content = content.replace(
    "  CheckCircle,\n  XCircle,\n  Clock,",
    "  CheckCircle,\n  XCircle,\n  Clock,\n  Calendar,"
)

# ── 3. Add Schedule nav item ──────────────────────────────────────────────────
content = content.replace(
    '    { id: "referrals", label: "Refer", icon: <Users className="w-4 h-4" /> },',
    '    { id: "referrals", label: "Refer", icon: <Users className="w-4 h-4" /> },\n    { id: "schedule", label: "Schedule", icon: <Calendar className="w-4 h-4" /> },'
)

# ── 4. Add tab render ─────────────────────────────────────────────────────────
content = content.replace(
    '        {activeTab === "referrals" && <ReferralTab referrerCandidateId={agent.candidateId} theme={theme} />}',
    '        {activeTab === "referrals" && <ReferralTab referrerCandidateId={agent.candidateId} theme={theme} />}\n        {activeTab === "schedule" && <OperationPlanTab theme={theme} />}'
)

# ── 5. Append OperationPlanTab before "type AgentData" ───────────────────────
OP_PLAN_TAB = '''
// ─── Operation Plan Tab ───────────────────────────────────────────────────────
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type WfAgent = {
  id: number;
  traineeCode: string;
  fullName: string;
  alias: string | null;
  offDay1: number | null;
  offDay2: number | null;
  campaignId: number | null;
};
type ScReq = {
  id: number;
  requesterCode: string;
  targetCode: string;
  requesterNewOff1: number | null;
  requesterNewOff2: number | null;
  targetNewOff1: number | null;
  targetNewOff2: number | null;
  message: string | null;
  status: string;
  createdAt: Date | number;
};
function OperationPlanTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: myProfile } = trpc.workforce.getMyProfile.useQuery();
  const campaignId = myProfile?.campaignId as number | null | undefined;
  const myCode = myProfile?.traineeCode as string | undefined;
  const { data: agents = [] } = trpc.workforce.getCampaignAgents.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );
  const { data: myRequests = [] } = trpc.scheduleChange.listMine.useQuery();
  const createRequest = trpc.scheduleChange.create.useMutation({
    onSuccess: () => { utils.scheduleChange.listMine.invalidate(); setShowForm(false); resetForm(); },
  });
  const peerApprove = trpc.scheduleChange.peerApprove.useMutation({
    onSuccess: () => utils.scheduleChange.listMine.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [targetCode, setTargetCode] = useState("");
  const [reqOff1, setReqOff1] = useState<number>(0);
  const [reqOff2, setReqOff2] = useState<number>(1);
  const [tgtOff1, setTgtOff1] = useState<number>(0);
  const [tgtOff2, setTgtOff2] = useState<number>(1);
  const [msg, setMsg] = useState("");
  function resetForm() { setTargetCode(""); setReqOff1(0); setReqOff2(1); setTgtOff1(0); setTgtOff2(1); setMsg(""); }
  const typedAgents = agents as unknown as WfAgent[];
  const typedRequests = myRequests as unknown as ScReq[];
  const pendingPeerApproval = typedRequests.filter(r => r.targetCode === myCode && r.status === "pending_peer");
  const myOutgoing = typedRequests.filter(r => r.requesterCode === myCode);
  if (!myProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Calendar className="w-10 h-10" style={{ color: theme.textFaint }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>You are not yet assigned to an operations campaign.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {/* Weekly Schedule Grid */}
      <div>
        <SectionTitle theme={theme}>Campaign Weekly Schedule</SectionTitle>
        <p className="text-xs mb-4" style={{ color: theme.textMuted }}>
          Green = Working day &nbsp;·&nbsp; Red = Off day &nbsp;·&nbsp; Your row is highlighted.
        </p>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.surfaceBorder}` }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: theme.surface }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: theme.text, minWidth: 140 }}>Agent</th>
                  {DAY_SHORT.map(d => (
                    <th key={d} className="px-3 py-3 font-semibold text-center" style={{ color: theme.text, minWidth: 52 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {typedAgents.map((a, i) => {
                  const isMe = a.traineeCode === myCode;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        background: isMe ? "oklch(0.32 0.18 28 / 0.12)" : i % 2 === 0 ? theme.bg : theme.surface,
                        borderTop: `1px solid ${theme.surfaceBorder}`,
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>You</span>}
                          <span className="font-medium truncate" style={{ color: theme.text }}>{a.alias ?? a.fullName}</span>
                        </div>
                      </td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const isOff = a.offDay1 === day || a.offDay2 === day;
                        return (
                          <td key={day} className="px-3 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                              style={{
                                background: isOff ? "#ef444422" : "#22c55e22",
                                color: isOff ? "#ef4444" : "#22c55e",
                              }}
                            >
                              {isOff ? "Off" : "On"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Pending peer approval requests */}
      {pendingPeerApproval.length > 0 && (
        <div>
          <SectionTitle theme={theme}>Pending Your Approval</SectionTitle>
          <div className="space-y-3">
            {pendingPeerApproval.map(r => (
              <div key={r.id} className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid oklch(0.85 0.18 85 / 0.4)` }}>
                <p className="text-sm font-medium mb-1" style={{ color: theme.text }}>
                  <span style={{ color: BRAND_LIGHT }}>{r.requesterCode}</span> wants to swap schedules with you.
                </p>
                {r.message && <p className="text-xs mb-3 italic" style={{ color: theme.textMuted }}>"{r.message}"</p>}
                <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                  Their new off days: {r.requesterNewOff1 != null ? DAY_SHORT[r.requesterNewOff1] : "—"} & {r.requesterNewOff2 != null ? DAY_SHORT[r.requesterNewOff2] : "—"} &nbsp;·&nbsp;
                  Your new off days: {r.targetNewOff1 != null ? DAY_SHORT[r.targetNewOff1] : "—"} & {r.targetNewOff2 != null ? DAY_SHORT[r.targetNewOff2] : "—"}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => peerApprove.mutate({ id: r.id, approve: true })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#22c55e22", color: "#22c55e" }}>
                    Approve
                  </button>
                  <button onClick={() => peerApprove.mutate({ id: r.id, approve: false })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#ef444422", color: "#ef4444" }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* My outgoing requests */}
      {myOutgoing.length > 0 && (
        <div>
          <SectionTitle theme={theme}>My Schedule Change Requests</SectionTitle>
          <div className="space-y-2">
            {myOutgoing.map(r => (
              <div key={r.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>Swap with {r.targetCode}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                    New off days: {r.requesterNewOff1 != null ? DAY_SHORT[r.requesterNewOff1] : "—"} & {r.requesterNewOff2 != null ? DAY_SHORT[r.requesterNewOff2] : "—"}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{
                  background: r.status === "approved" ? "#22c55e22" : r.status === "rejected" ? "#ef444422" : "#eab30822",
                  color: r.status === "approved" ? "#22c55e" : r.status === "rejected" ? "#ef4444" : "#eab308",
                }}>
                  {r.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Request schedule change form */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle theme={theme}>Request Schedule Change</SectionTitle>
          <button onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: BRAND, color: "white" }}>
            {showForm ? "Cancel" : "+ New Request"}
          </button>
        </div>
        {showForm && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Select the agent you want to swap schedules with, then specify the new off days for both of you. The other agent must approve first, then the manager will review.
            </p>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Agent to swap with</label>
              <select value={targetCode} onChange={e => setTargetCode(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                <option value="">Select agent...</option>
                {typedAgents.filter(a => a.traineeCode !== myCode).map(a => (
                  <option key={a.traineeCode} value={a.traineeCode}>{a.alias ?? a.fullName} ({a.traineeCode})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Your new off day 1</label>
                <select value={reqOff1} onChange={e => setReqOff1(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Your new off day 2</label>
                <select value={reqOff2} onChange={e => setReqOff2(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Their new off day 1</label>
                <select value={tgtOff1} onChange={e => setTgtOff1(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Their new off day 2</label>
                <select value={tgtOff2} onChange={e => setTgtOff2(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Message (optional)</label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} placeholder="Reason for schedule change..."
                className="w-full rounded-lg px-3 py-2 text-sm border resize-none" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
            </div>
            <button
              onClick={() => createRequest.mutate({ targetCode, requesterNewOff1: reqOff1, requesterNewOff2: reqOff2, targetNewOff1: tgtOff1, targetNewOff2: tgtOff2, message: msg || undefined })}
              disabled={!targetCode || createRequest.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: BRAND, color: "white" }}
            >
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
'''

insert_marker = "type AgentData = {"
idx = content.index(insert_marker)
content = content[:idx] + OP_PLAN_TAB + "\n" + content[idx:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done. OperationPlanTab added.")
