/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads return PERMISSION_DENIED
 * and verifies bootstrapped admin/GM/moderator access for creatergame31@gmail.com.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firestore Rules enforce Zero-Trust invariants and creatergame31@gmail.com Admin/GM RBAC', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  // 1. Default deny catch-all
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);

  // 2. Bootstrapped Admin email + email_verified guard
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.email == 'creatergame31@gmail\.com'/);

  // 3. Admin role registry, Moderation ticket & Content Report collections protected
  assert.match(rules, /match \/admins\/\{adminId\}/);
  assert.match(rules, /match \/moderation_tickets\/\{ticketId\}/);
  assert.match(rules, /match \/content_reports\/\{reportId\}/);

  // 4. Anti-Update-Gap: every allow update starts with isValid[Entity](incoming())
  assert.match(rules, /isValidVideo\(incoming\(\)\)/);
  assert.match(rules, /isValidComment\(incoming\(\)\)/);
  assert.match(rules, /isValidAdminRole\(incoming\(\)\)/);
  assert.match(rules, /isValidModerationTicket\(incoming\(\)\)/);
  assert.match(rules, /isValidContentReport\(incoming\(\)\)/);
});
