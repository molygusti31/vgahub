const test = require('node:test');
const assert = require('node:assert');

const { verifyLicense } = require('./license');

test('lisensi valid diterima', () => {
  assert.equal(verifyLicense('TRIALVGAHUB2026'), true);
});

test('lisensi salah ditolak', () => {
  assert.equal(verifyLicense('INVALID-KEY'), false);
});
