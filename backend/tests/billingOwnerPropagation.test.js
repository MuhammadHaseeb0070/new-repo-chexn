const test = require('node:test');
const assert = require('node:assert');
const { resolveBillingOwnerId, withBillingOwner } = require('../utils/billingOwner');

test('parent hierarchy: child inherits parent billing owner id', () => {
  const billingOwnerId = resolveBillingOwnerId({
    creatorBillingOwnerId: 'parent-uid-123',
    newUserUid: 'child-uid-999'
  });
  const childDoc = withBillingOwner({ uid: 'child-uid-999', role: 'student' }, billingOwnerId);
  assert.strictEqual(childDoc.billingOwnerId, 'parent-uid-123');
});

test('employer hierarchy: staff inherit employer admin billing owner id', () => {
  const billingOwnerId = resolveBillingOwnerId({
    creatorBillingOwnerId: 'employer-admin-1',
    newUserUid: 'staff-1'
  });
  const staffDoc = withBillingOwner({ uid: 'staff-1', role: 'supervisor' }, billingOwnerId);
  assert.strictEqual(staffDoc.billingOwnerId, 'employer-admin-1');
});

test('standalone school hierarchy: staff inherit standalone school admin billing owner id', () => {
  const billingOwnerId = resolveBillingOwnerId({
    creatorBillingOwnerId: 'school-admin-55',
    newUserUid: 'teacher-10'
  });
  const teacherDoc = withBillingOwner({ uid: 'teacher-10', role: 'teacher' }, billingOwnerId);
  assert.strictEqual(teacherDoc.billingOwnerId, 'school-admin-55');
});

test('district hierarchy: managed school admin inherits district billing owner id', () => {
  const billingOwnerId = resolveBillingOwnerId({
    creatorBillingOwnerId: 'district-admin-77',
    newUserUid: 'school-admin-88'
  });
  const managedSchoolAdmin = withBillingOwner({ uid: 'school-admin-88', role: 'school-admin' }, billingOwnerId);
  assert.strictEqual(managedSchoolAdmin.billingOwnerId, 'district-admin-77');
});

test('payer signup falls back to own uid when no creator billing owner id exists', () => {
  const billingOwnerId = resolveBillingOwnerId({
    creatorBillingOwnerId: null,
    newUserUid: 'fresh-payer'
  });
  assert.strictEqual(billingOwnerId, 'fresh-payer');
});

