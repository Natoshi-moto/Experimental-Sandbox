import { hash } from "./hash.mjs";
import { invariant } from "./errors.mjs";

const RECORD_ID_KEYS = Object.freeze({
  ACCOUNT: "account_id",
  ALLOWANCE: "allowance_id",
  APPEAL: "appeal_id",
  BID: "bid_id",
  BID_ROUND: "round_id",
  CONTROLLER: "controller_id",
  CONTRIBUTION: "contribution_id",
  FUNDING_LOT: "lot_id",
  JOB: "job_id",
  LEASE: "lease_id",
  PAYOUT: "payout_id",
  PRINCIPAL: "principal_id",
  REVIEW_ASSIGNMENT: "review_assignment_id",
  SUBWORK_COMMITMENT: "subwork_commitment_id",
  TASK: "task_id",
});

export function recordIdKey(objectType) {
  const idKey = RECORD_ID_KEYS[objectType];
  invariant(
    idKey !== undefined,
    "ERR_DOMAIN_REGISTRY",
    `unregistered mutable object type ${objectType}`,
  );
  return idKey;
}

function withoutKeys(value, keys) {
  const output = Object.create(null);
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) output[key] = value[key];
  }
  return output;
}

export function stableId({
  prefix,
  objectType,
  parentIds = [],
  naturalKey,
  creatorPrincipalId,
  creationPredecessorRoot,
  creationTick,
  creationNonce,
}) {
  invariant(
    Number.isSafeInteger(creationTick) && creationTick >= 0,
    "ERR_TICK",
    "creation tick must be a non-negative safe integer",
  );
  const naturalKeyRoot = hash("NEXUS_NATURAL_KEY_V1", {
    schema: "nexus-natural-key-v1",
    object_type: objectType,
    registered_immutable_identity_fields: naturalKey,
  });
  const digest = hash("NEXUS_STABLE_ID_V1", {
    schema: "nexus-stable-id-v1",
    object_type: objectType,
    parent_ids: [...parentIds].sort(),
    natural_key_root: naturalKeyRoot,
    creator_principal_id: creatorPrincipalId,
    creation_predecessor_root: creationPredecessorRoot,
    creation_tick: creationTick,
    creation_nonce: creationNonce,
  });
  return `${prefix}-${digest}`;
}

export function recordRoot(record, objectType) {
  const idKey = recordIdKey(objectType);
  invariant(
    Object.hasOwn(record, idKey),
    "ERR_ID_PREIMAGE",
    `${objectType} record lacks ${idKey}`,
  );
  return hash("NEXUS_RECORD_V1", {
    schema: "nexus-record-v1",
    object_type: objectType,
    record_id: record[idKey],
    record_revision: record.record_revision,
    record_body_without_record_root_or_auth: withoutKeys(
      record,
      new Set(["record_root", "auth"]),
    ),
  });
}

export function createRecord({ idKey, id, objectType }, body) {
  invariant(
    idKey === recordIdKey(objectType),
    "ERR_ID_PREIMAGE",
    `${objectType} must use ${recordIdKey(objectType)}`,
  );
  invariant(
    !Object.hasOwn(body, idKey),
    "ERR_ID_PREIMAGE",
    `body must not contain ${idKey}`,
  );
  const record = {
    [idKey]: id,
    ...body,
    record_revision: 0,
    previous_record_root: null,
    record_root: "",
  };
  record.record_root = recordRoot(record, objectType);
  return record;
}

export function reviseRecord(record, patch, objectType) {
  const idKey = recordIdKey(objectType);
  invariant(
    !Object.hasOwn(patch, idKey),
    "ERR_ID_PREIMAGE",
    `${idKey} is immutable`,
  );
  invariant(
    !Object.hasOwn(patch, "record_revision") &&
      !Object.hasOwn(patch, "previous_record_root") &&
      !Object.hasOwn(patch, "record_root"),
    "ERR_RECORD_REVISION",
    "revision metadata is reducer-owned",
  );
  invariant(
    record.record_root === recordRoot(record, objectType),
    "ERR_RECORD_REVISION",
    "current record root is invalid",
  );
  const revised = {
    ...record,
    ...patch,
    record_revision: record.record_revision + 1,
    previous_record_root: record.record_root,
    record_root: "",
  };
  revised.record_root = recordRoot(revised, objectType);
  return revised;
}
