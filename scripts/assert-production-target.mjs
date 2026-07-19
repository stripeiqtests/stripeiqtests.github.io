import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedProjectRef = 'afsoyuczexiztsjntkvi';
const linkedProjectRef = readFileSync(
  resolve(import.meta.dirname, '..', 'supabase', '.temp', 'project-ref'),
  'utf8',
).trim();

assert.equal(
  linkedProjectRef,
  expectedProjectRef,
  `Refusing production action: Supabase CLI is linked to ${linkedProjectRef}, expected ${expectedProjectRef}`,
);

console.log(`production Supabase target verified: ${expectedProjectRef}`);
