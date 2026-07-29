# SBX-EXP-003 — NEXUS Public Workshop static successor

This record preserves the scriptless static successor to
[`SBX-EXP-002`](../SBX-EXP-002-NEXUS-PUBLIC-WORKSHOP/).

- **State:** `OPERATOR_HOLD_RESEARCH_ONLY`
- **Classification:** `ALLOWED_RESEARCH_ONLY`
- **status_authority:** `NONE`
- **Nexus Lab impact:** `NONE`
- **Public site:** <https://nexus-public-workshop.everythingbitesized.chatgpt.site>
- **Source checkpoint:** `ed8c281d14914e20e1f2a5762fa11436edf06da0`

[`prototype/`](prototype/) is the exact tracked-source snapshot. It builds
generated HTML, CSS, local media, a public integrity receipt, and the minimal
Sites edge gate. The generated artifact contains zero JavaScript.

The current shared Sites host can append a Cloudflare browser-detection script
and cookie and omit the intended complete HTTP-header envelope. The artifact's
early `script-src 'none'` policy rejects script execution, but the shared
hostname is not claimed as the final script-free, cookie-free transport.

This publication does not lift or narrow `SBX-SOH-001` and does not activate
NEX, a wallet, transfers, participants, model purchasing, financialisation, or
Nexus Lab accepted state.
