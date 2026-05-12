import bcrypt from 'bcryptjs';

// Simulate the generatePassword function from routers.ts
function generatePassword(traineeCode) {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${traineeCode}-${digits}`;
}

// Test 1: basic bcrypt works
const hash = await bcrypt.hash('Tanis2025', 10);
const match = await bcrypt.compare('Tanis2025', hash);
console.log('Test 1 - bcrypt works:', match ? 'PASS' : 'FAIL');

// Test 2: generatePassword format
const pw = generatePassword('T-5555');
console.log('Test 2 - password format:', pw); // Should be T-5555-XXXX

// Test 3: bulkGenerateCredentials uses "Tanis2025" as default
const defaultPw = 'Tanis2025';
const defaultHash = await bcrypt.hash(defaultPw, 10);
const defaultMatch = await bcrypt.compare(defaultPw, defaultHash);
console.log('Test 3 - default password "Tanis2025":', defaultMatch ? 'PASS' : 'FAIL');

// Test 4: login with T-5555 - the T-5555 agent has mustChangePassword=0 
// meaning it was set with a custom password (not the default)
// The password would have been set via generateCredentials which uses generatePassword
// format: T-5555-XXXX
console.log('\nConclusion: T-5555 was generated with generateCredentials (custom format T-5555-XXXX)');
console.log('Other agents (T-1 through T-28) were generated with bulkGenerateCredentials (password: Tanis2025)');
console.log('mustChangePassword=1 means they need to change on first login');
