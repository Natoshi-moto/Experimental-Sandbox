import { hash } from "../core/hash.mjs";
import { invariant } from "../core/errors.mjs";
import {
  assertBoundedCanonical,
  assertExactObjectKeys,
  assertHexNonce128,
  assertSafeNonNegativeInteger,
} from "../core/schema.mjs";

const REVEAL_FIELDS = [
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
  "max_compute_units",
  "model_id",
  "provider_family",
  "operator_id",
  "probe_root",
  "nonce",
  "salt",
];

export function assertBidReveal(reveal) {
  assertExactObjectKeys(reveal, REVEAL_FIELDS, [], "bid reveal");
  invariant(
    reveal.schema === "nexus-bid-reveal-v1",
    "ERR_SCHEMA",
    "bad bid reveal schema",
  );
  assertHexNonce128(reveal.salt, "bid salt");
  assertSafeNonNegativeInteger(reveal.price, "bid price");
  assertSafeNonNegativeInteger(reveal.completion_ticks, "completion ticks", {
    positive: true,
  });
  assertSafeNonNegativeInteger(
    reveal.max_compute_units,
    "lead maximum compute units",
    { positive: true },
  );
  assertBoundedCanonical(reveal, "bid reveal", 32768);
  return reveal;
}

export function draftContractRoot(contract) {
  invariant(contract.award === null, "ERR_CONTRACT_IMMUTABLE", "draft award must be null");
  return hash("NEXUS_CONTRACT_V1", contract);
}

export function bidCommitment(reveal) {
  assertBidReveal(reveal);
  return hash("NEXUS_BID_COMMIT_V1", reveal);
}

export function bidRevealRoot(reveal) {
  assertBidReveal(reveal);
  return hash("NEXUS_BID_REVEAL_V1", reveal);
}

export function materializeContract({
  draft,
  roundId,
  bid,
  reveal,
  contributionIds,
  requesterPrincipalId,
  maintainerPrincipalId,
  sponsorPrincipalIds,
}) {
  invariant(draft.award === null, "ERR_CONTRACT_IMMUTABLE", "draft already awarded");
  const eligibleAppealPrincipalIds = [
    requesterPrincipalId,
    bid.bidder_principal_id,
    ...sponsorPrincipalIds,
    maintainerPrincipalId,
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  const partyPrincipalIds = [...eligibleAppealPrincipalIds];
  return {
    ...draft,
    award: {
      round_id: roundId,
      bid_id: bid.bid_id,
      worker_principal_id: bid.bidder_principal_id,
      worker_seat_id: bid.worker_seat_id,
      capability_offer_root: reveal.capability_offer_root,
      lead_worker_amount: reveal.price,
      lead_max_compute_units: reveal.max_compute_units,
      funding_contribution_ids: [...contributionIds].sort(),
      role_bindings: {
        requester_principal_id: requesterPrincipalId,
        worker_principal_id: bid.bidder_principal_id,
        sponsor_principal_ids: [...sponsorPrincipalIds].sort(),
        maintainer_principal_id: maintainerPrincipalId,
      },
      eligible_appeal_principal_ids: eligibleAppealPrincipalIds,
      party_principal_ids: partyPrincipalIds,
    },
  };
}

export function sortEligibleBids(entries) {
  return [...entries].sort((left, right) => {
    if (left.reveal.price !== right.reveal.price) {
      return left.reveal.price - right.reveal.price;
    }
    if (left.reveal.completion_ticks !== right.reveal.completion_ticks) {
      return left.reveal.completion_ticks - right.reveal.completion_ticks;
    }
    const seatOrder = left.bid.worker_seat_id.localeCompare(
      right.bid.worker_seat_id,
    );
    if (seatOrder !== 0) return seatOrder;
    return bidRevealRoot(left.reveal).localeCompare(bidRevealRoot(right.reveal));
  });
}
