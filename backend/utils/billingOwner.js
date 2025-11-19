/**
 * Helper utilities to keep billingOwnerId propagation consistent.
 * Every user record that is created must include the "golden" billing owner id.
 */

/**
 * Resolves the billing owner id for a new user.
 * If a creator billing owner id is provided, that always wins.
 * Otherwise we fall back to the new user's uid (payer signup scenarios).
 *
 * @param {object} options
 * @param {string | null | undefined} options.creatorBillingOwnerId
 * @param {string} options.newUserUid
 * @returns {string}
 */
function resolveBillingOwnerId({ creatorBillingOwnerId, newUserUid }) {
  if (creatorBillingOwnerId) {
    return creatorBillingOwnerId;
  }
  if (!newUserUid) {
    throw new Error('newUserUid is required to resolve billing owner id');
  }
  return newUserUid;
}

/**
 * Returns a new object that guarantees billingOwnerId is applied.
 *
 * @param {object} baseData
 * @param {string} billingOwnerId
 * @returns {object}
 */
function withBillingOwner(baseData = {}, billingOwnerId) {
  if (!billingOwnerId) {
    throw new Error('billingOwnerId is required');
  }
  return {
    ...baseData,
    billingOwnerId
  };
}

module.exports = {
  resolveBillingOwnerId,
  withBillingOwner
};

