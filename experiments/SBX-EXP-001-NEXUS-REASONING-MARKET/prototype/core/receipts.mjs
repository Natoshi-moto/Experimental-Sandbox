import { hash } from "./hash.mjs";

export function buildReceipt({
  sequence,
  event,
  jobId,
  predecessorRoot,
  nextStateRoot,
  effects,
  invariantResults,
  previousReceiptRoot,
}) {
  const body = {
    schema: "nexus-receipt-v1",
    sequence,
    event_id: event.event_id,
    event_type: event.event_type,
    actor_id: event.actor_id,
    job_id: jobId ?? null,
    predecessor_root: predecessorRoot,
    next_state_root: nextStateRoot,
    event_root: hash("NEXUS_AUTHENTICATED_EVENT_V1", event),
    effects_root: hash("NEXUS_EFFECTS_V1", effects),
    invariants_root: hash("NEXUS_INVARIANTS_V1", invariantResults),
    logical_tick: event.tick,
    previous_receipt_root: previousReceiptRoot,
  };
  return {
    receipt_id: `RCPT-${hash("NEXUS_RECEIPT_V1", body)}`,
    ...body,
  };
}

export function receiptRoot(receipt) {
  return hash("NEXUS_RECEIPT_CHAIN_V1", receipt);
}

export function recomputeReceiptId(receipt) {
  const { receipt_id: ignored, ...body } = receipt;
  return `RCPT-${hash("NEXUS_RECEIPT_V1", body)}`;
}
