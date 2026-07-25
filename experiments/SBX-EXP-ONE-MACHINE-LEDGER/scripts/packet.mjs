#!/usr/bin/env node
/**
 * packet.mjs — build/wrap OML paste packets for the human paste bus.
 *
 *   node scripts/packet.mjs chain fixtures/chain-v0.json
 *   node scripts/packet.mjs wrap-receipt <inspect-output.json>
 *   node scripts/packet.mjs proposal-help
 *
 * status_authority: NONE
 */
import { readFileSync } from 'node:fs';

const [cmd, arg] = process.argv.slice(2);

function emit(kind, status, body) {
  console.log(
    JSON.stringify(
      {
        schema: 'nexus.paste.oml/v0',
        kind,
        status,
        status_authority: 'NONE',
        body,
      },
      null,
      2,
    ),
  );
}

if (cmd === 'chain') {
  if (!arg) {
    console.error('usage: packet.mjs chain <fixture.json>');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(arg, 'utf8'));
  emit('OML_CHAIN_PACKET', 'CLAIMED', {
    genesis: data.genesis,
    genesis_hash: data.genesis_hash,
    blocks: data.blocks,
    expected_height: data.expected_height,
    expected_tip_hash: data.expected_tip_hash,
    expected_state_root: data.expected_state_root,
    expected_supply: data.expected_supply,
  });
  process.exit(0);
}

if (cmd === 'wrap-receipt') {
  if (!arg) {
    console.error('usage: packet.mjs wrap-receipt <receipt.json>');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(arg, 'utf8'));
  // inspect already emits full receipt; re-print for paste consistency
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

if (cmd === 'proposal-help') {
  console.log(`OML_TX_PROPOSAL body shape (status CLAIMED until kernel accepts):

{
  "schema": "nexus.paste.oml/v0",
  "kind": "OML_TX_PROPOSAL",
  "status": "CLAIMED",
  "status_authority": "NONE",
  "body": {
    "core": {
      "inputs": [{ "txid": "sha256:…", "index": 0 }],
      "outputs": [{ "amount": 1, "public_key_spki_b64": "…" }],
      "memo": "proposal",
      "protocol": "oml/v0",
      "unit": "OML_UNIT"
    },
    "public_key_spki_b64": "optional if signed",
    "signature_b64": "optional if signed"
  }
}

A proposal is never applied by paste alone. Feed through kernel + replay.
`);
  process.exit(0);
}

console.error('usage: packet.mjs chain|wrap-receipt|proposal-help …');
process.exit(2);
