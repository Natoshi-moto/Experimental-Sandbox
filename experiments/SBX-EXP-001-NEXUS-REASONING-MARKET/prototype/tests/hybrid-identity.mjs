import assert from "node:assert/strict";
import {
  createPrivateKey,
  sign as cryptoSign,
} from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  authenticatedEventRoot,
  buildEvent,
  buildIndependentControllerAuthentication,
  semanticEventRoot,
  verifyIndependentControllerAuthentication,
} from "../core/auth.mjs";
import { canonicalize } from "../core/canonical.mjs";
import { ProtocolError } from "../core/errors.mjs";
import { hash } from "../core/hash.mjs";
import {
  HYBRID_AUTH_SCHEME,
  ML_DSA_65_NODE_CONTEXT,
  deriveHybridKeyId,
  hybridSignedMessageBytes,
  verifiedHybridAuthenticationReference,
} from "../core/identity.mjs";
import {
  applyEvent,
  createRuntime,
  currentRoot,
  recoverRuntime,
  snapshotRuntime,
} from "../core/reducer.mjs";
import {
  receiptRoot,
  semanticReceiptRoot,
} from "../core/receipts.mjs";
import {
  createFixtureState,
  findPrincipalByAlias,
} from "../core/state.mjs";
import {
  hybridPrincipalFixture,
  hybridPrivateKeyPairFixture,
  hybridPublicKeyPairFixture,
} from "./hybrid-identity-fixtures.mjs";

const TESTS = [];

function test(name, body) {
  TESTS.push({ name, body });
}

function clone(value) {
  return JSON.parse(canonicalize(value));
}

function expectCode(code, body) {
  assert.throws(body, (error) => {
    assert(error instanceof ProtocolError);
    assert.equal(error.code, code);
    return true;
  });
}

function context() {
  const genesisState = createFixtureState({
    projectPoolAlias: "project-pool",
    principals: [
      hybridPrincipalFixture("project-pool", {
        balance: 0,
        scopes: ["*"],
      }),
      hybridPrincipalFixture("requester", {
        balance: 0,
        scopes: ["*", "CLOCK_ADVANCER"],
      }),
      hybridPrincipalFixture("attacker", {
        balance: 0,
        scopes: ["*"],
      }),
    ],
  });
  return {
    genesisState: structuredClone(genesisState),
    runtime: createRuntime(genesisState),
  };
}

function stateOf(value) {
  return snapshotRuntime(value.runtime).state;
}

function principalOf(value, alias) {
  return findPrincipalByAlias(stateOf(value), alias);
}

function controllerOf(value, alias) {
  const state = stateOf(value);
  const principal = findPrincipalByAlias(state, alias);
  return state.controllers[principal.controller_id];
}

function eventFor(
  value,
  {
    alias = "requester",
    eventType = "ADVANCE_TICK",
    payload = {},
    nonce = "hybrid-event",
    identityAlias = alias,
  } = {},
) {
  return buildEvent(stateOf(value), {
    eventType,
    actorId: principalOf(value, alias).principal_id,
    payload,
    nonce,
    privateKeyPair: hybridPrivateKeyPairFixture(identityAlias),
  });
}

function flipBase64url(value) {
  const bytes = Buffer.from(value, "base64url");
  bytes[0] ^= 1;
  return bytes.toString("base64url");
}

function messageFor(event) {
  return hybridSignedMessageBytes({
    signedDomain: event.auth.signed_domain,
    controllerId: event.auth.controller_id,
    keyId: event.auth.key_id,
    signedPayloadRoot: event.auth.signed_payload_root,
  });
}

function privateKey(identityAlias, algorithm) {
  const pair = hybridPrivateKeyPairFixture(identityAlias);
  const encoded =
    algorithm === "ed25519"
      ? pair.ed25519_private_key_pkcs8_der_base64url
      : pair.ml_dsa_65_private_key_pkcs8_der_base64url;
  return createPrivateKey({
    key: Buffer.from(encoded, "base64url"),
    format: "der",
    type: "pkcs8",
  });
}

function rawSignature(
  identityAlias,
  algorithm,
  message,
  contextValue = ML_DSA_65_NODE_CONTEXT,
) {
  if (algorithm === "ed25519") {
    return cryptoSign(
      null,
      message,
      privateKey(identityAlias, algorithm),
    ).toString("base64url");
  }
  return cryptoSign(null, message, {
    key: privateKey(identityAlias, algorithm),
    context: Buffer.from(contextValue, "ascii"),
  }).toString("base64url");
}

test("hybrid controller state contains only exact paired public identity", () => {
  const fixture = context();
  const controller = controllerOf(fixture, "requester");
  assert.equal(controller.scheme, HYBRID_AUTH_SCHEME);
  assert.equal(controller.key_id, deriveHybridKeyId(controller));
  assert.equal(
    Buffer.from(
      controller.ed25519_public_key_spki_der_base64url,
      "base64url",
    ).length,
    44,
  );
  assert.equal(
    Buffer.from(
      controller.ml_dsa_65_public_key_spki_der_base64url,
      "base64url",
    ).length,
    1974,
  );
  assert(!canonicalize(stateOf(fixture)).includes("private_key"));
});

test("hybrid auth accepts only the mandatory AND profile", () => {
  const fixture = context();
  const event = eventFor(fixture);
  const outcome = applyEvent(fixture.runtime, event);
  assert.equal(outcome.replay, false);
  assert.equal(event.auth.scheme, HYBRID_AUTH_SCHEME);
  assert.equal(
    Buffer.from(
      event.auth.ed25519_signature_base64url,
      "base64url",
    ).length,
    64,
  );
  assert.equal(
    Buffer.from(
      event.auth.ml_dsa_65_signature_base64url,
      "base64url",
    ).length,
    3309,
  );
});

test("hybrid auth rejects either missing signature half", () => {
  for (const field of [
    "ed25519_signature_base64url",
    "ml_dsa_65_signature_base64url",
  ]) {
    const fixture = context();
    const event = clone(eventFor(fixture));
    delete event.auth[field];
    expectCode("ERR_SCHEMA", () => applyEvent(fixture.runtime, event));
  }
});

test("hybrid auth rejects legacy and single-algorithm schemes", () => {
  for (const scheme of [
    "SIM_AUTH_UNSAFE",
    "ED25519_V1",
    "ML_DSA_65_V1",
    "UNKNOWN_SIGNATURE_SCHEME",
  ]) {
    const fixture = context();
    const event = clone(eventFor(fixture));
    event.auth.scheme = scheme;
    expectCode("ERR_AUTHORITY", () =>
      applyEvent(fixture.runtime, event),
    );
  }
});

test("hybrid auth rejects wrong-key and crossed-pair signatures", () => {
  const wrongKey = context();
  const wrongKeyEvent = clone(eventFor(wrongKey));
  wrongKeyEvent.auth.ed25519_signature_base64url = rawSignature(
    "attacker",
    "ed25519",
    messageFor(wrongKeyEvent),
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(wrongKey.runtime, wrongKeyEvent),
  );

  const crossed = context();
  const crossedEvent = clone(eventFor(crossed));
  crossedEvent.auth.ml_dsa_65_signature_base64url = rawSignature(
    "attacker",
    "ml-dsa-65",
    messageFor(crossedEvent),
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(crossed.runtime, crossedEvent),
  );
});

test("hybrid auth rejects wrong domain and ML-DSA context", () => {
  const wrongDomain = context();
  const wrongDomainEvent = clone(eventFor(wrongDomain));
  wrongDomainEvent.auth.signed_domain = "NEXUS_EVENT_AUTH_V1";
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(wrongDomain.runtime, wrongDomainEvent),
  );

  const wrongContext = context();
  const wrongContextEvent = clone(eventFor(wrongContext));
  wrongContextEvent.auth.ml_dsa_65_signature_base64url = rawSignature(
    "requester",
    "ml-dsa-65",
    messageFor(wrongContextEvent),
    "NEXUS_WRONG_ML_DSA_CONTEXT_V1",
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(wrongContext.runtime, wrongContextEvent),
  );
});

test("hybrid auth rejects corrupted and noncanonical signatures", () => {
  for (const field of [
    "ed25519_signature_base64url",
    "ml_dsa_65_signature_base64url",
  ]) {
    const corrupted = context();
    const event = clone(eventFor(corrupted));
    event.auth[field] = flipBase64url(event.auth[field]);
    expectCode("ERR_AUTHORITY", () =>
      applyEvent(corrupted.runtime, event),
    );

    const padded = context();
    const paddedEvent = clone(eventFor(padded));
    paddedEvent.auth[field] = `${paddedEvent.auth[field]}=`;
    expectCode("ERR_SCHEMA", () =>
      applyEvent(padded.runtime, paddedEvent),
    );
  }
});

test("hybrid auth rejects public-key substitution and wrong OIDs", () => {
  const fixture = context();
  const substituted = structuredClone(fixture.genesisState);
  const principal = findPrincipalByAlias(substituted, "requester");
  const controller = substituted.controllers[principal.controller_id];
  controller.ed25519_public_key_spki_der_base64url =
    hybridPublicKeyPairFixture(
      "attacker",
    ).ed25519_public_key_spki_der_base64url;
  expectCode("ERR_AUTHORITY", () => createRuntime(substituted));

  const wrongOid = structuredClone(fixture.genesisState);
  const wrongOidPrincipal = findPrincipalByAlias(
    wrongOid,
    "requester",
  );
  const wrongOidController =
    wrongOid.controllers[wrongOidPrincipal.controller_id];
  wrongOidController.ed25519_public_key_spki_der_base64url =
    wrongOidController.ml_dsa_65_public_key_spki_der_base64url;
  expectCode("ERR_SCHEMA", () => createRuntime(wrongOid));
});

test("independent consent authentication requires both hybrid signatures", () => {
  const fixture = context();
  const state = stateOf(fixture);
  const principal = findPrincipalByAlias(state, "requester");
  const signedBodyRoot = hash("NEXUS_TEST_CONSENT_BODY_V1", {
    consent: "hybrid",
  });
  const authentication = buildIndependentControllerAuthentication(
    state,
    {
      principalId: principal.principal_id,
      controllerId: principal.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot,
      privateKeyPair: hybridPrivateKeyPairFixture("requester"),
    },
  );
  assert.doesNotThrow(() =>
    verifyIndependentControllerAuthentication(state, {
      principalId: principal.principal_id,
      controllerId: principal.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot,
      authentication,
    }),
  );
  const missingHalf = clone(authentication);
  delete missingHalf.ml_dsa_65_signature_base64url;
  expectCode("ERR_SCHEMA", () =>
    verifyIndependentControllerAuthentication(state, {
      principalId: principal.principal_id,
      controllerId: principal.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot,
      authentication: missingHalf,
    }),
  );
  const semanticReference =
    verifiedHybridAuthenticationReference(authentication);
  expectCode("ERR_SCHEMA", () =>
    verifyIndependentControllerAuthentication(state, {
      principalId: principal.principal_id,
      controllerId: principal.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot,
      authentication: semanticReference,
    }),
  );
});

test("randomized ML-DSA re-sign preserves semantic identity and duplicate replay", () => {
  const first = context();
  const second = context();
  const eventA = eventFor(first, { nonce: "randomized-resign" });
  const eventB = eventFor(second, { nonce: "randomized-resign" });
  assert.equal(
    eventA.auth.ed25519_signature_base64url,
    eventB.auth.ed25519_signature_base64url,
  );
  assert.notEqual(
    eventA.auth.ml_dsa_65_signature_base64url,
    eventB.auth.ml_dsa_65_signature_base64url,
  );
  assert.equal(eventA.event_id, eventB.event_id);
  assert.equal(semanticEventRoot(eventA), semanticEventRoot(eventB));
  assert.notEqual(
    authenticatedEventRoot(eventA),
    authenticatedEventRoot(eventB),
  );

  const acceptedA = applyEvent(first.runtime, eventA);
  const acceptedB = applyEvent(second.runtime, eventB);
  assert.equal(
    acceptedA.receipt.semantic_event_root,
    acceptedB.receipt.semantic_event_root,
  );
  assert.equal(
    acceptedA.receipt.semantic_receipt_id,
    acceptedB.receipt.semantic_receipt_id,
  );
  assert.equal(
    acceptedA.receipt.semantic_receipt_root,
    acceptedB.receipt.semantic_receipt_root,
  );
  assert.equal(
    semanticReceiptRoot(acceptedA.receipt),
    semanticReceiptRoot(acceptedB.receipt),
  );
  assert.equal(
    acceptedA.receipt.result_root,
    acceptedB.receipt.result_root,
  );
  assert.notEqual(
    acceptedA.receipt.authenticated_event_root,
    acceptedB.receipt.authenticated_event_root,
  );
  assert.notEqual(
    acceptedA.receipt.receipt_id,
    acceptedB.receipt.receipt_id,
  );
  assert.notEqual(
    receiptRoot(acceptedA.receipt),
    receiptRoot(acceptedB.receipt),
  );
  assert.equal(currentRoot(first.runtime), currentRoot(second.runtime));
  const beforeDuplicate = currentRoot(first.runtime);
  const duplicate = applyEvent(first.runtime, eventB);
  assert.equal(duplicate.replay, true);
  assert.equal(currentRoot(first.runtime), beforeDuplicate);
  assert.equal(
    canonicalize(duplicate.receipt),
    canonicalize(acceptedA.receipt),
  );
  assert.equal(snapshotRuntime(first.runtime).events.length, 1);
  assert.equal(snapshotRuntime(first.runtime).receipts.length, 1);
});

test("hybrid replay preserves the exact submitted authentication bytes", () => {
  const fixture = context();
  const event = eventFor(fixture, { nonce: "exact-auth-replay" });
  applyEvent(fixture.runtime, event);
  const journal = snapshotRuntime(fixture.runtime);
  const recovered = recoverRuntime({
    genesisState: structuredClone(fixture.genesisState),
    events: structuredClone(journal.events),
    receipts: structuredClone(journal.receipts),
    expectedFinalRoot: journal.current_root,
  });
  const recoveredJournal = snapshotRuntime(recovered);
  assert.equal(
    journal.receipts[0].semantic_event_root,
    semanticEventRoot(event),
  );
  assert.equal(
    journal.receipts[0].authenticated_event_root,
    authenticatedEventRoot(event),
  );
  assert.equal(
    journal.receipts[0].semantic_receipt_root,
    semanticReceiptRoot(journal.receipts[0]),
  );
  assert.equal(
    canonicalize(recoveredJournal.events[0].auth),
    canonicalize(event.auth),
  );
  assert.equal(
    canonicalize(recoveredJournal.receipts),
    canonicalize(journal.receipts),
  );
  const tamperedEvents = structuredClone(journal.events);
  tamperedEvents[0].auth.ed25519_signature_base64url =
    flipBase64url(
      tamperedEvents[0].auth.ed25519_signature_base64url,
    );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(fixture.genesisState),
      events: tamperedEvents,
      receipts: structuredClone(journal.receipts),
      expectedFinalRoot: journal.current_root,
    }),
  );
  const alternate = context();
  const alternateEvent = eventFor(alternate, {
    nonce: "exact-auth-replay",
  });
  assert.equal(alternateEvent.event_id, event.event_id);
  assert.notEqual(
    authenticatedEventRoot(alternateEvent),
    authenticatedEventRoot(event),
  );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(fixture.genesisState),
      events: [alternateEvent],
      receipts: structuredClone(journal.receipts),
      expectedFinalRoot: journal.current_root,
    }),
  );
});

test("hybrid key rotation is atomic and rejects the old pair", () => {
  const fixture = context();
  const before = controllerOf(fixture, "requester");
  const nextPublic = hybridPublicKeyPairFixture("rotation-next");
  const nextKeyId = deriveHybridKeyId(nextPublic);
  const rotation = eventFor(fixture, {
    eventType: "ROTATE_CONTROLLER_KEYS",
    nonce: "rotate-pair",
    payload: {
      controller_id: before.controller_id,
      current_key_id: before.key_id,
      new_scheme: nextPublic.scheme,
      new_key_id: nextKeyId,
      new_ed25519_public_key_spki_der_base64url:
        nextPublic.ed25519_public_key_spki_der_base64url,
      new_ml_dsa_65_public_key_spki_der_base64url:
        nextPublic.ml_dsa_65_public_key_spki_der_base64url,
      rotation_nonce: "rotation-1",
    },
  });
  applyEvent(fixture.runtime, rotation);
  const after = controllerOf(fixture, "requester");
  assert.equal(after.key_id, nextKeyId);
  assert.notEqual(
    after.ed25519_public_key_spki_der_base64url,
    before.ed25519_public_key_spki_der_base64url,
  );
  assert.notEqual(
    after.ml_dsa_65_public_key_spki_der_base64url,
    before.ml_dsa_65_public_key_spki_der_base64url,
  );

  const fresh = eventFor(fixture, {
    nonce: "post-rotation",
    identityAlias: "rotation-next",
  });
  const oldPairForgery = clone(fresh);
  const signedMessage = messageFor(oldPairForgery);
  oldPairForgery.auth.ed25519_signature_base64url = rawSignature(
    "requester",
    "ed25519",
    signedMessage,
  );
  oldPairForgery.auth.ml_dsa_65_signature_base64url = rawSignature(
    "requester",
    "ml-dsa-65",
    signedMessage,
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(fixture.runtime, oldPairForgery),
  );
  assert.equal(applyEvent(fixture.runtime, fresh).replay, false);
  assert.equal(applyEvent(fixture.runtime, rotation).replay, true);

  const partial = context();
  const partialBefore = controllerOf(partial, "requester");
  expectCode("ERR_SCHEMA", () =>
    eventFor(partial, {
      eventType: "ROTATE_CONTROLLER_KEYS",
      nonce: "partial-rotation",
      payload: {
        controller_id: partialBefore.controller_id,
        current_key_id: partialBefore.key_id,
        new_scheme: nextPublic.scheme,
        new_key_id: nextKeyId,
        new_ed25519_public_key_spki_der_base64url:
          nextPublic.ed25519_public_key_spki_der_base64url,
        rotation_nonce: "partial-rotation-1",
      },
    }),
  );
});

test("hybrid auth rejects schema extensions and key-reference mutation", () => {
  const extension = context();
  const extensionEvent = clone(eventFor(extension));
  extensionEvent.auth.compatibility_fallback = true;
  expectCode("ERR_SCHEMA", () =>
    applyEvent(extension.runtime, extensionEvent),
  );

  const changedKey = context();
  const changedKeyEvent = clone(eventFor(changedKey));
  changedKeyEvent.auth.key_id = deriveHybridKeyId(
    hybridPublicKeyPairFixture("attacker"),
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(changedKey.runtime, changedKeyEvent),
  );
});

export function runHybridIdentityTests() {
  const failures = [];
  for (const { name, body } of TESTS) {
    try {
      body();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.error(`not ok - ${name}`);
      console.error(error);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} hybrid identity test${
        failures.length === 1 ? "" : "s"
      } failed`,
    );
  }
  console.log(
    `hybrid-identity: PASS (${TESTS.length} deterministic adversarial tests)`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runHybridIdentityTests();
}
