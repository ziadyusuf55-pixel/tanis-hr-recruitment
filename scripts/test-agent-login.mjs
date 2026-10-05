// Test the full agent login flow against a LOCAL dev server.
// Credentials come from env — never commit real ones:
//   TEST_AGENT_CODE=T-xxxx TEST_AGENT_PASSWORD=... node scripts/test-agent-login.mjs
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.TEST_AGENT_CODE;
const PASSWORD = process.env.TEST_AGENT_PASSWORD;
if (!CODE || !PASSWORD) { console.error("Set TEST_AGENT_CODE and TEST_AGENT_PASSWORD"); process.exit(1); }

console.log("=== Step 1: Login ===");
const loginRes = await fetch(`${BASE}/api/trpc/agent.login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ json: { traineeCode: CODE, password: PASSWORD } }),
});

console.log("Login status:", loginRes.status);
const loginData = await loginRes.json();
console.log("Login response:", JSON.stringify(loginData));

// Extract cookie
const setCookieHeader = loginRes.headers.get("set-cookie");
console.log("Set-Cookie header:", setCookieHeader);

const cookieMatch = setCookieHeader?.match(/tanis_agent_session=([^;]+)/);
const token = cookieMatch?.[1];
console.log("Token extracted:", token ? `${token.substring(0, 30)}... (${token.length} chars)` : "NONE");

if (!token) {
  console.error("No token found in Set-Cookie header!");
  process.exit(1);
}

console.log("\n=== Step 2: agent.me ===");
const meRes = await fetch(`${BASE}/api/trpc/agent.me`, {
  headers: { "Cookie": `tanis_agent_session=${token}` },
});
console.log("agent.me status:", meRes.status);
const meData = await meRes.json();
console.log("agent.me response:", JSON.stringify(meData, null, 2));
