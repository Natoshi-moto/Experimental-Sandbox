import { assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import { hash } from "../core/hash.mjs";

const BID_REVEAL_FIELDS = Object.freeze([
  "schema",
  "round_id",
  "job_id",
  "job_version",
  "draft_contract_root",
  "bidder_principal_id",
  "worker_seat_id",
  "capability_offer_root",
  "price",
  "completion_ticks",
  "model_id",
  "provider_family",
  "operator_id",
  "probe_root",
  "nonce",
  "salt",
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSafeNonNegative(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    "ERR_UNSAFE_INTEGER",
    `${label} must be a non-negative safe integer`,
  );
}

function immutableCanonicalSnapshot(value) {
  assertCanonicalValue(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((entry) => immutableCanonicalSnapshot(entry)),
    );
  }
  const snapshot = {};
  for (const key of Object.keys(value).sort(compareStrings)) {
    snapshot[key] = immutableCanonicalSnapshot(value[key]);
  }
  return Object.freeze(snapshot);
}

function revealPreimage(reveal) {
  invariant(
    reveal && typeof reveal === "object",
    "ERR_SCHEMA",
    "bid reveal is required",
  );
  const body = {};
  for (const field of BID_REVEAL_FIELDS) {
    invariant(
      Object.hasOwn(reveal, field),
      "ERR_SCHEMA",
      `bid reveal.${field} is required`,
    );
    body[field] = reveal[field];
  }
  invariant(
    body.schema === "nexus-bid-reveal-v1",
    "ERR_SCHEMA",
    "unsupported bid reveal schema",
  );
  for (const field of ["job_version", "price", "completion_ticks"]) {
    assertSafeNonNegative(body[field], `bid reveal.${field}`);
  }
  for (const field of [
    "round_id",
    "job_id",
    "draft_contract_root",
    "bidder_principal_id",
    "worker_seat_id",
    "capability_offer_root",
    "model_id",
    "provider_family",
    "operator_id",
    "probe_root",
    "nonce",
    "salt",
  ]) {
    invariant(
      typeof body[field] === "string" && body[field].length > 0,
      "ERR_SCHEMA",
      `bid reveal.${field} must be a non-empty string`,
    );
  }
  invariant(
    body.salt.length >= 16,
    "ERR_SCHEMA",
    "bid reveal.salt must carry at least 128 bits of fixture material",
  );
  assertCanonicalValue(body);
  return body;
}

/**
 * Hashes only the normative reveal payload. UI aliases and presentation
 * metadata cannot affect selection.
 */
export function bidRevealHash(reveal) {
  return hash("NEXUS_BID_REVEAL_V1", revealPreimage(reveal));
}

export function bidScore(reveal) {
  const body = revealPreimage(reveal);
  return Object.freeze({
    price: body.price,
    completion_ticks: body.completion_ticks,
    worker_seat_id: body.worker_seat_id,
    reveal_hash: hash("NEXUS_BID_REVEAL_V1", body),
  });
}

export function compareBidScores(leftScore, rightScore) {
  if (leftScore.price !== rightScore.price) {
    return leftScore.price - rightScore.price;
  }
  if (leftScore.completion_ticks !== rightScore.completion_ticks) {
    return leftScore.completion_ticks - rightScore.completion_ticks;
  }
  const seatOrder = compareStrings(
    leftScore.worker_seat_id,
    rightScore.worker_seat_id,
  );
  if (seatOrder !== 0) return seatOrder;
  return compareStrings(leftScore.reveal_hash, rightScore.reveal_hash);
}

export function compareBidReveals(leftReveal, rightReveal) {
  return compareBidScores(bidScore(leftReveal), bidScore(rightReveal));
}

/**
 * Rank already-probed bids. Every entry is
 * `{ reveal, eligibility: { eligible, reason_codes } }`.
 */
export function rankEligibleBids(entries) {
  invariant(Array.isArray(entries), "ERR_SCHEMA", "entries must be an array");
  const eligible = [];
  const rejected = [];
  const seenRevealHashes = new Set();

  for (const entry of entries) {
    invariant(
      entry && typeof entry === "object",
      "ERR_SCHEMA",
      "bid entry must be an object",
    );
    invariant(
      entry.eligibility &&
        typeof entry.eligibility.eligible === "boolean" &&
        Array.isArray(entry.eligibility.reason_codes),
      "ERR_SCHEMA",
      "bid entry requires a deterministic eligibility result",
    );
    const reveal = immutableCanonicalSnapshot(entry.reveal);
    const eligibility = immutableCanonicalSnapshot(entry.eligibility);
    const score = bidScore(reveal);
    invariant(
      !seenRevealHashes.has(score.reveal_hash),
      "ERR_BID_COMMITMENT",
      `duplicate bid reveal ${score.reveal_hash}`,
    );
    seenRevealHashes.add(score.reveal_hash);
    const rankedEntry = Object.freeze({
      reveal,
      score,
      eligibility,
    });
    if (entry.eligibility.eligible) {
      eligible.push(rankedEntry);
    } else {
      rejected.push(rankedEntry);
    }
  }

  eligible.sort((left, right) => compareBidScores(left.score, right.score));
  rejected.sort((left, right) =>
    compareStrings(left.score.reveal_hash, right.score.reveal_hash),
  );

  return Object.freeze({
    eligible: Object.freeze(eligible),
    rejected: Object.freeze(rejected),
  });
}

export function selectWinningBid(entries) {
  const ranked = rankEligibleBids(entries);
  return ranked.eligible.length === 0 ? null : ranked.eligible[0];
}
