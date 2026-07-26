import { stableId, createRecord } from "./records.mjs";
import { hash } from "./hash.mjs";
import { invariant } from "./errors.mjs";
import { deriveHybridKeyId } from "./identity.mjs";

export const STATE_SCHEMA = "nexus-flow-state-prototype-v0.1";
export const POLICY_ROOT = hash("NEXUS_POLICY_V1", {
  schema: "nexus-policy-v1",
  version: "0.1",
  economic_class: "SIM_CREDIT_ONLY",
  review_count: 3,
});

function registryRecord({
  objectType,
  prefix,
  idKey,
  naturalKey,
  nonce,
  body,
}) {
  const id = stableId({
    prefix,
    objectType,
    naturalKey,
    creatorPrincipalId: "SYSTEM-GENESIS",
    creationPredecessorRoot: "GENESIS",
    creationTick: 0,
    creationNonce: nonce,
  });
  return createRecord({ idKey, id, objectType }, body);
}

export function createFixtureState({
  principals,
  projectPoolAlias = "nexus-commons",
}) {
  invariant(
    Array.isArray(principals) && principals.length > 0,
    "ERR_SCHEMA",
    "fixture requires principals",
  );
  const state = {
    schema: STATE_SCHEMA,
    tick: 0,
    supply: 0,
    policy_root: POLICY_ROOT,
    principals: Object.create(null),
    controllers: Object.create(null),
    accounts: Object.create(null),
    capability_offers: Object.create(null),
    capability_offer_content_index: Object.create(null),
    donated_capacity_consents: Object.create(null),
    revoked_offer_ids: Object.create(null),
    funding_lots: Object.create(null),
    jobs: Object.create(null),
    contributions: Object.create(null),
    bid_rounds: Object.create(null),
    bids: Object.create(null),
    allowances: Object.create(null),
    subwork_commitments: Object.create(null),
    payouts: Object.create(null),
    tasks: Object.create(null),
    leases: Object.create(null),
    review_assignments: Object.create(null),
    reviewer_eligibilities: Object.create(null),
    reviews: Object.create(null),
    decisions: Object.create(null),
    appeals: Object.create(null),
    idempotency: Object.create(null),
    publication_intents: Object.create(null),
    disclosure_scan_receipts: Object.create(null),
    disclosure_approval_receipts: Object.create(null),
    disclosure_compilation_anchors: Object.create(null),
    data_route_authorities: Object.create(null),
    tool_route_authorities: Object.create(null),
    classified_input_manifests: Object.create(null),
    worker_trust_authorities: Object.create(null),
    route_execution_plans: Object.create(null),
    route_plan_consumptions: Object.create(null),
    public_export_authorities: Object.create(null),
    disclosure_policies: Object.create(null),
    disclosure_proof_contexts: Object.create(null),
    disclosure_preparation_authorities: Object.create(null),
    disclosure_preparations: Object.create(null),
    disclosure_preparation_execution_receipts: Object.create(null),
    entropy_freshness_authorities: Object.create(null),
    entropy_one_use_consumptions: Object.create(null),
    nonce_authorities: Object.create(null),
    export_nonce_uses: Object.create(null),
    accepted_disclosure_compilation_anchors: Object.create(null),
    accepted_publication_anchors: Object.create(null),
    redaction_manifests: Object.create(null),
    redaction_approvals: Object.create(null),
    disclosure_manifests: Object.create(null),
    public_capsules: Object.create(null),
    non_claims: Object.create(null),
    publication_anchors: Object.create(null),
    verifier_authorities: Object.create(null),
    terminal_jobs: Object.create(null),
  };

  const seenAliases = new Set();
  for (const fixture of principals) {
    invariant(
      !seenAliases.has(fixture.alias),
      "ERR_SCHEMA",
      `duplicate fixture alias ${fixture.alias}`,
    );
    seenAliases.add(fixture.alias);
    invariant(
      Number.isSafeInteger(fixture.balance) && fixture.balance >= 0,
      "ERR_UNSAFE_INTEGER",
      `invalid fixture balance for ${fixture.alias}`,
    );

    const principal = registryRecord({
      objectType: "PRINCIPAL",
      prefix: "PRINCIPAL",
      idKey: "principal_id",
      naturalKey: { alias: fixture.alias },
      nonce: `principal:${fixture.alias}`,
      body: {
        display_alias: fixture.alias,
        declared_operator: fixture.operator ?? fixture.alias,
        guardian_policy: null,
        status: "ACTIVE",
      },
    });
    const controller = registryRecord({
      objectType: "CONTROLLER",
      prefix: "CTRL",
      idKey: "controller_id",
      naturalKey: { principal_id: principal.principal_id, slot: 0 },
      nonce: `controller:${fixture.alias}`,
      body: {
        principal_id: principal.principal_id,
        key_id: deriveHybridKeyId({
          scheme: fixture.scheme,
          ed25519_public_key_spki_der_base64url:
            fixture.ed25519_public_key_spki_der_base64url,
          ml_dsa_65_public_key_spki_der_base64url:
            fixture.ml_dsa_65_public_key_spki_der_base64url,
        }),
        scheme: fixture.scheme,
        ed25519_public_key_spki_der_base64url:
          fixture.ed25519_public_key_spki_der_base64url,
        ml_dsa_65_public_key_spki_der_base64url:
          fixture.ml_dsa_65_public_key_spki_der_base64url,
        scopes: [...(fixture.scopes ?? ["*"])].sort(),
        status: "ACTIVE",
      },
    });
    principal.controller_id = controller.controller_id;
    principal.record_root = "";
    const fixedPrincipal = createRecord(
      {
        idKey: "principal_id",
        id: principal.principal_id,
        objectType: "PRINCIPAL",
      },
      {
        display_alias: fixture.alias,
        declared_operator: fixture.operator ?? fixture.alias,
        guardian_policy: null,
        controller_id: controller.controller_id,
        status: "ACTIVE",
      },
    );
    const accountKind =
      fixture.alias === projectPoolAlias ? "PROJECT_POOL" : "PRINCIPAL";
    const account = registryRecord({
      objectType: "ACCOUNT",
      prefix: "ACCOUNT",
      idKey: "account_id",
      naturalKey: { kind: accountKind, principal_id: principal.principal_id },
      nonce: `account:${fixture.alias}`,
      body: {
        controller_id: controller.controller_id,
        kind: accountKind,
        owner_principal_id: principal.principal_id,
        owner_job_id: null,
        available: fixture.balance,
        status: "ACTIVE",
      },
    });
    state.principals[fixedPrincipal.principal_id] = fixedPrincipal;
    state.controllers[controller.controller_id] = controller;
    state.accounts[account.account_id] = account;
    const nextSupply = state.supply + fixture.balance;
    invariant(
      Number.isSafeInteger(nextSupply),
      "ERR_UNSAFE_INTEGER",
      "fixture genesis supply overflow",
    );
    state.supply = nextSupply;
  }

  invariant(
    Object.values(state.accounts).filter(
      (account) => account.kind === "PROJECT_POOL",
    ).length === 1,
    "ERR_SCHEMA",
    "fixture needs exactly one project-pool alias",
  );
  return state;
}

export function applicationRoot(state) {
  return hash("NEXUS_STATE_V1", state);
}

export function findPrincipalByAlias(state, alias) {
  return Object.values(state.principals).find(
    (principal) => principal.display_alias === alias,
  );
}

export function findAccountForPrincipal(state, principalId) {
  return Object.values(state.accounts).find(
    (account) =>
      account.owner_principal_id === principalId &&
      account.kind !== "JOB" &&
      account.status === "ACTIVE",
  );
}
