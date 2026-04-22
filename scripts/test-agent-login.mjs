// Test the full agent login flow
const BASE = "http://localhost:3000";

console.log("=== Step 1: Login ===");
const loginRes = await fetch(`${BASE}/api/trpc/agent.login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ json: { traineeCode: "T-5555", password: "T-5555-9999" } }),
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
