export function HoldNotice() {
  return (
    <aside className="hold-notice" aria-labelledby="hold-notice-title">
      <p className="hold-state">
        <span>SBX-SOH-001</span>
        <span>Active hold</span>
      </p>
      <div>
        <h2 id="hold-notice-title">
          Public documentary prototype. Not an economic launch.
        </h2>
        <p>
          Published under <strong>ALLOWED_RESEARCH_ONLY</strong>. No NEX
          issuance, participant-facing wallet, live transfer, recruitment into
          a live credit economy, or real AI-work purchasing is active.
          Publication does not lift or narrow the hold.
        </p>
      </div>
      <nav aria-label="Prototype status records">
        <a
          href="https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/EMERGENCY_CURRENT_STATUS.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Current status <span aria-hidden="true">↗</span>
        </a>
        <a
          href="https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/PUBLIC_OPERATOR_POSITION.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Operator position <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </aside>
  );
}
