import { hash } from "./hash.mjs";
import {
  authenticatedEventRoot,
  semanticEventRoot,
} from "./auth.mjs";

const RECEIPT_SCHEMA = "nexus-receipt-v2";
const SEMANTIC_RECEIPT_SCHEMA = "nexus-semantic-receipt-v1";

function semanticReceiptProjection(receipt) {
  return {
    schema: SEMANTIC_RECEIPT_SCHEMA,
    receipt_schema: RECEIPT_SCHEMA,
    sequence: receipt.sequence,
    event_id: receipt.event_id,
    event_type: receipt.event_type,
    actor_id: receipt.actor_id,
    job_id: receipt.job_id,
    predecessor_root: receipt.predecessor_root,
    next_state_root: receipt.next_state_root,
    semantic_event_root: receipt.semantic_event_root,
    effects_root: receipt.effects_root,
    result_root: receipt.result_root,
    invariants_root: receipt.invariants_root,
    logical_tick: receipt.logical_tick,
    previous_semantic_receipt_root:
      receipt.previous_semantic_receipt_root,
  };
}

export function recomputeSemanticReceiptId(receipt) {
  return `SRCPT-${hash(
    "NEXUS_SEMANTIC_RECEIPT_ID_V1",
    semanticReceiptProjection(receipt),
  )}`;
}

export function semanticReceiptRoot(receipt) {
  return hash("NEXUS_SEMANTIC_RECEIPT_CHAIN_V1", {
    semantic_receipt_id: receipt.semantic_receipt_id,
    receipt: semanticReceiptProjection(receipt),
  });
}

export function buildReceipt({
  sequence,
  event,
  jobId,
  predecessorRoot,
  nextStateRoot,
  effects,
  result,
  invariantResults,
  previousReceiptRoot,
  previousSemanticReceiptRoot,
}) {
  const sharedBody = {
    sequence,
    event_id: event.event_id,
    event_type: event.event_type,
    actor_id: event.actor_id,
    job_id: jobId ?? null,
    predecessor_root: predecessorRoot,
    next_state_root: nextStateRoot,
    semantic_event_root: semanticEventRoot(event),
    effects_root: hash("NEXUS_EFFECTS_V1", effects),
    result_root: hash("NEXUS_RESULT_V1", result ?? null),
    invariants_root: hash("NEXUS_INVARIANTS_V1", invariantResults),
    logical_tick: event.tick,
    previous_semantic_receipt_root: previousSemanticReceiptRoot,
  };
  const semanticReceiptId = recomputeSemanticReceiptId(sharedBody);
  const semanticReceipt = {
    ...sharedBody,
    semantic_receipt_id: semanticReceiptId,
  };
  const body = {
    schema: RECEIPT_SCHEMA,
    semantic_receipt_id: semanticReceiptId,
    semantic_receipt_root: semanticReceiptRoot(semanticReceipt),
    ...sharedBody,
    authenticated_event_root: authenticatedEventRoot(event),
    previous_receipt_root: previousReceiptRoot,
  };
  return {
    receipt_id: `RCPT-${hash("NEXUS_RECEIPT_V2", body)}`,
    ...body,
  };
}

export function receiptRoot(receipt) {
  return hash("NEXUS_RECEIPT_CHAIN_V2", receipt);
}

export function recomputeReceiptId(receipt) {
  const { receipt_id: ignored, ...body } = receipt;
  return `RCPT-${hash("NEXUS_RECEIPT_V2", body)}`;
}
