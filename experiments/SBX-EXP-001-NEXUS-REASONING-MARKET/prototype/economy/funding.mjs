import { invariant } from "../core/errors.mjs";
import { assertSafeNonNegativeInteger } from "../core/schema.mjs";

export function assertAmount(amount, { positive = false } = {}) {
  return assertSafeNonNegativeInteger(amount, "amount", { positive });
}

export function checkedAdd(left, right) {
  assertAmount(left);
  assertAmount(right);
  const result = left + right;
  invariant(
    Number.isSafeInteger(result),
    "ERR_UNSAFE_INTEGER",
    "safe-integer addition overflow",
  );
  return result;
}

export function checkedSubtract(left, right) {
  assertAmount(left);
  assertAmount(right);
  invariant(left >= right, "ERR_INSUFFICIENT_AVAILABLE", "amount underflow");
  return left - right;
}

export function checkedMultiply(left, right) {
  assertAmount(left);
  assertAmount(right);
  const result = left * right;
  invariant(
    Number.isSafeInteger(result),
    "ERR_UNSAFE_INTEGER",
    "safe-integer multiplication overflow",
  );
  return result;
}

export function activeLotValue(state, lotIds = null) {
  const selected =
    lotIds === null
      ? Object.values(state.funding_lots)
      : lotIds.map((lotId) => state.funding_lots[lotId]);
  return selected.reduce((total, lot) => {
    invariant(lot, "ERR_FUNDING_LOT_OWNER", "funding lot is missing");
    if (lot.status !== "ACTIVE") return total;
    return checkedAdd(total, lot.amount);
  }, 0);
}

export function availableSupply(state) {
  return Object.values(state.accounts).reduce(
    (total, account) => checkedAdd(total, account.available),
    0,
  );
}

export function conservedSupply(state) {
  return checkedAdd(availableSupply(state), activeLotValue(state));
}

export function largestRemainderAllocation(lots, amount) {
  assertAmount(amount, { positive: true });
  const ordered = [...lots].sort((left, right) =>
    left.lot_id.localeCompare(right.lot_id),
  );
  const total = ordered.reduce(
    (sum, lot) => checkedAdd(sum, lot.amount),
    0,
  );
  invariant(total >= amount, "ERR_FUNDING_TOTAL", "lot total is insufficient");

  const target = BigInt(amount);
  const denominator = BigInt(total);
  const allocations = ordered.map((lot) => {
    const numerator = target * BigInt(lot.amount);
    const floor = numerator / denominator;
    const remainder = numerator % denominator;
    return {
      lot_id: lot.lot_id,
      amount: Number(floor),
      remainder,
    };
  });
  let assigned = allocations.reduce(
    (sum, item) => checkedAdd(sum, item.amount),
    0,
  );
  const remainderOrder = [...allocations].sort((left, right) => {
    if (left.remainder > right.remainder) return -1;
    if (left.remainder < right.remainder) return 1;
    return left.lot_id.localeCompare(right.lot_id);
  });
  let index = 0;
  while (assigned < amount) {
    remainderOrder[index].amount += 1;
    assigned += 1;
    index += 1;
  }
  return allocations
    .filter((item) => item.amount > 0)
    .sort((left, right) => left.lot_id.localeCompare(right.lot_id))
    .map(({ lot_id: lotId, amount: allocated }) => ({
      lot_id: lotId,
      amount: allocated,
    }));
}

export function mandatoryJobReserve(job, contract) {
  invariant(
    Number.isSafeInteger(job.valid_review_payouts_created) &&
      job.valid_review_payouts_created >= 0 &&
      job.valid_review_payouts_created <= contract.review.required_reviews,
    "ERR_FUNDING_OBLIGATION",
    "valid review payout count is outside the frozen contract",
  );
  const leadOutstanding = job.lead_payout_accrued
    ? 0
    : contract.award.lead_worker_amount;
  const reviewOutstanding = checkedMultiply(
    contract.review.required_reviews - job.valid_review_payouts_created,
    contract.settlement.reviewer_amount_each,
  );
  const verificationOutstanding = job.verification_payout_accrued
    ? 0
    : contract.work.fixed_verification_cost;
  return checkedAdd(
    checkedAdd(leadOutstanding, reviewOutstanding),
    verificationOutstanding,
  );
}
