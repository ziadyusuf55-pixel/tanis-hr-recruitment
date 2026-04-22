import bcrypt from "bcryptjs";

const hash = "$2b$10$DnwPAxtMsU85QFoqQETl6.JrVEkP6frHLgkRsF4DUGxYfPbi2n5QS";
console.log("Hash starts with $2b:", hash.startsWith("$2b"));
console.log("Hash length:", hash.length);

// The password format is: traineeCode + '-' + 4 random digits
// e.g. T-5555-1234
// The hash was updated at 2026-04-22T16:04:25 (via resetPassword)
// We can't brute-force it, but we can verify the hash is valid bcrypt

// Test a known wrong password to confirm comparison works
const wrongMatch = await bcrypt.compare("wrongpassword", hash);
console.log("Wrong password matches (should be false):", wrongMatch);

// Test the hash is valid by hashing something and comparing
const testHash = await bcrypt.hash("test123", 10);
const testMatch = await bcrypt.compare("test123", testHash);
console.log("bcrypt is working correctly:", testMatch);

console.log("\nConclusion: The hash in DB is valid bcrypt.");
console.log("The agent needs to use the password shown when credentials were last generated/reset.");
console.log("The trainee code is: T-5555");
console.log("Password format: T-5555-XXXX where XXXX is the 4-digit number shown at generation time.");
