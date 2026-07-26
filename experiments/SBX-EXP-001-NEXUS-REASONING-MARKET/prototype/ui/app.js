(() => {
  "use strict";

  const FIXTURE_URL = "./demo-state.json";
  const REQUIRED_LABELS = [
    "SANDBOX",
    "SIM_CREDIT_ONLY",
    "SIMULATED_MAINTAINER_BINDING",
  ];

  const byId = (id) => document.getElementById(id);

  const escapeHTML = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const safe = (value) => escapeHTML(value);

  const shortId = (value, lead = 12, tail = 8) => {
    const text = String(value ?? "");
    if (text.length <= lead + tail + 3) return text;
    return `${text.slice(0, lead)}...${text.slice(-tail)}`;
  };

  const pretty = (value) =>
    String(value ?? "")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const arrayText = (items, empty = "NONE") =>
    Array.isArray(items) && items.length ? items.join(" / ") : empty;

  const chip = (label, tone = "muted") =>
    `<span class="mini-chip" data-tone="${safe(tone)}">${safe(label)}</span>`;

  const rootLine = (label, value) => `
    <div>
      <span class="micro-label">${safe(label)}</span>
      <code class="root-value" title="${safe(value)}">${safe(value)}</code>
    </div>
  `;

  const declarationList = (entries) => `
    <dl class="declaration-list">
      ${entries
        .map(
          ([label, value]) => `
            <div>
              <dt>${safe(label)}</dt>
              <dd>${safe(value)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;

  const toneForRelationship = (relationship) => {
    if (relationship === "DISTINCT") return "green";
    if (relationship === "UNKNOWN") return "amber";
    return "red";
  };

  const assertFixture = (data) => {
    const assert = (condition, message) => {
      if (!condition) throw new Error(`Invalid demo fixture: ${message}`);
    };

    assert(data?.schema === "nexus-matrix-demo-v1", "unexpected schema");
    assert(data.status_authority === "NONE", "status authority must be NONE");
    assert(
      data.economic_class === "SIM_CREDIT_ONLY",
      "economic class must be SIM_CREDIT_ONLY",
    );
    assert(
      data.interface?.mode === "READ_ONLY_WALKTHROUGH",
      "interface must be read-only",
    );
    assert(
      data.interface?.canonical_state_mutation === false,
      "canonical mutation must be disabled",
    );
    assert(
      data.interface?.external_network === false,
      "external network must be disabled",
    );
    assert(
      data.interface?.external_assets === false,
      "external assets must be disabled",
    );
    REQUIRED_LABELS.forEach((label) =>
      assert(data.environment_labels?.includes(label), `missing ${label}`),
    );

    const sponsorTotal = data.funding?.sponsors?.reduce(
      (sum, sponsor) => sum + sponsor.amount,
      0,
    );
    assert(sponsorTotal === data.funding?.funded, "sponsor total mismatch");
    assert(
      data.funding?.funded === data.funding?.budget,
      "job must be exactly funded",
    );
    assert(
      data.capacity_seat?.mode === "DONATED_CAPACITY" &&
        data.capacity_seat?.price === 0,
      "seat must be donated at zero price",
    );

    assert(
      data.review_gate?.required_reviews === 3 &&
        data.review_gate?.received_reviews === 3 &&
        data.review_gate?.reviewers?.length === 3,
      "review gate must contain exactly three reviews",
    );
    assert(
      data.review_gate.reviewers.every(
        (review) =>
          review.verdict === "CLEAR" &&
          review.packet_root === data.review_gate.packet_root,
      ),
      "reviews must be CLEAR against one exact packet",
    );
    assert(
      data.review_gate.summary_label === "CORRELATED_REVIEW" &&
        data.review_gate.outcome === "HOLD",
      "correlated review must produce HOLD",
    );

    const settlementTotal = data.settlement_preview?.summary?.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    assert(
      settlementTotal === data.settlement_preview?.total,
      "settlement destinations must consume the total exactly once",
    );

    assert(
      Array.isArray(data.receipts) && data.receipts.length > 0,
      "receipt chain is empty",
    );
    data.receipts.forEach((receipt, index) => {
      assert(receipt.sequence === index + 1, "receipt sequence is not contiguous");
      if (index > 0) {
        assert(
          receipt.previous_receipt_root === data.receipts[index - 1].receipt_id,
          `receipt ${receipt.sequence} does not link to its predecessor`,
        );
      }
    });
  };

  const renderHero = (data) => {
    byId("public-job-id").textContent = data.job.public_job_id;
    byId("job-title").textContent = data.job.title;
    byId("job-summary").textContent = data.job.summary;
    byId("job-state").textContent = data.snapshot.state;
    byId("job-state-reason").textContent = data.snapshot.state_reason;

    const metrics = [
      {
        value: `${data.funding.funded}/${data.funding.budget}`,
        label: `${data.funding.unit} locked`,
      },
      {
        value: `${data.capacity_seat.price}`,
        label: "Donated seat price",
      },
      {
        value: `${data.evidence.checks.length}/${data.evidence.checks.length}`,
        label: "Deterministic checks pass",
      },
      {
        value: `${data.review_gate.received_reviews}/3 ${data.review_gate.outcome}`,
        label: "Exact review gate",
      },
    ];

    byId("headline-metrics").innerHTML = metrics
      .map(
        (metric) => `
          <article class="metric">
            <strong class="metric-value">${safe(metric.value)}</strong>
            <span class="metric-label">${safe(metric.label)}</span>
          </article>
        `,
      )
      .join("");
  };

  const renderFunding = (data) => {
    const { funding } = data;
    const fundedPercent = Math.round((funding.funded / funding.budget) * 100);

    byId("funding-content").innerHTML = `
      <div class="grid grid-two">
        <article class="card">
          <div class="card-header">
            <div>
              <span class="kicker">Crowdsourced sponsors</span>
              <h3>Four source-tagged contributions</h3>
            </div>
            ${chip("EXACTLY FUNDED", "green")}
          </div>
          <div class="funding-total">
            <div>
              <strong>${safe(funding.funded)}</strong>
              <span>of ${safe(funding.budget)} ${safe(funding.unit)}</span>
            </div>
            <span>${safe(fundedPercent)}%</span>
          </div>
          <div
            class="progress-track"
            role="progressbar"
            aria-label="Funding progress"
            aria-valuemin="0"
            aria-valuemax="${safe(funding.budget)}"
            aria-valuenow="${safe(funding.funded)}"
          >
            <span class="progress-fill" style="width: ${safe(fundedPercent)}%"></span>
          </div>
          <div class="sponsor-list">
            ${funding.sponsors
              .map(
                (sponsor) => `
                  <div class="sponsor-row">
                    <span class="avatar" aria-hidden="true">${safe(sponsor.initials)}</span>
                    <div>
                      <strong>${safe(sponsor.alias)}</strong>
                      <small>${safe(sponsor.kind)} / ${safe(sponsor.residue_policy)}</small>
                      ${
                        sponsor.linkability_warning
                          ? `<small>${safe(sponsor.linkability_warning)}</small>`
                          : ""
                      }
                    </div>
                    <span class="credit-amount">${safe(sponsor.amount)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="card">
          <div class="card-header">
            <div>
              <span class="kicker">Mechanical bid award</span>
              <h3>Zero-price donated capacity</h3>
            </div>
            ${chip(funding.bid.current_status, "green")}
          </div>
          ${declarationList([
            ["Mode", funding.bid.mode],
            ["Price", `${funding.bid.price} ${funding.unit}`],
            ["Completion", `${funding.bid.completion_ticks} logical ticks`],
            ["Selected", `tick ${funding.bid.selected_tick}`],
            ["Accepted", `tick ${funding.bid.accepted_tick}`],
            ["Binding", funding.bid.contract_binding],
          ])}
          <p class="fine-print">
            Winner order: ${safe(funding.selection_rule.join(" -> "))}.
            Selection is deterministic against the exact revealed bid set.
          </p>
          ${rootLine("Bid ID", funding.bid.bid_id)}
        </article>
      </div>

      <article class="card card-soft">
        <div class="card-header">
          <div>
            <span class="kicker">Bid lock path</span>
            <h3>Funds cross one-way revocation boundaries</h3>
          </div>
          ${chip(funding.current_bucket, "amber")}
        </div>
        <div class="lock-flow" aria-label="Funding lock history">
          ${funding.lock_history
            .map(
              (step) => `
                <div class="lock-step ${
                  step.status === "COMPLETE" ? "complete" : "active"
                }">
                  <small>${safe(step.bucket)} / tick ${safe(step.tick)}</small>
                  <strong>${safe(step.label)}</strong>
                  <span>${safe(step.amount)} ${safe(funding.unit)} / ${safe(
                    step.status,
                  )}</span>
                </div>
              `,
            )
            .join("")}
        </div>
        <p class="fine-print">
          Disclosure acknowledgement covers:
          ${safe(funding.disclosure_acknowledgement.covered.join("; "))}.
        </p>
        ${rootLine(
          "Disclosure acknowledgement root",
          funding.disclosure_acknowledgement.root,
        )}
      </article>
    `;
  };

  const renderCapacity = (data) => {
    const seat = data.capacity_seat;
    const nutrition = [
      ["Route", seat.route, "green"],
      ["Data", arrayText(seat.data_classes), "green"],
      ["Egress", arrayText(seat.egress_allowlist), "green"],
      ["Secrets", seat.authority.recovery_secrets, "green"],
      ["Re-delegation", seat.authority.redelegation, "green"],
      ["Isolation", seat.isolation.class, "violet"],
    ];

    byId("capacity-content").innerHTML = `
      <div class="grid grid-wide-narrow">
        <article class="card privacy-label">
          <div class="card-header">
            <div>
              <span class="kicker">Donated bounded seat</span>
              <h3>${safe(seat.display_alias)}</h3>
              <p>Owned by ${safe(seat.owner_alias)}; no provider account changes hands.</p>
            </div>
            ${chip(`${seat.price} ${data.funding.unit}`, "green")}
          </div>
          <div class="nutrition-grid">
            ${nutrition
              .map(
                ([label, value, tone]) => `
                  <div class="nutrition-item" data-tone="${safe(tone)}">
                    <span class="micro-label">${safe(label)}</span>
                    <strong>${safe(value)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
          <p class="fine-print">${safe(seat.isolation.proof_limit)}</p>
        </article>

        <article class="card">
          <span class="kicker">Lease ceiling</span>
          <h3>Narrow by construction</h3>
          ${declarationList([
            ["Model", seat.model_id],
            ["Provider", seat.provider_family],
            ["Operator", seat.operator_id],
            ["Tools", arrayText(seat.tools)],
            ["Runtime", arrayText(seat.runtimes)],
            ["Input bytes", seat.limits.max_input_bytes],
            ["Output bytes", seat.limits.max_output_bytes],
            ["Compute units", seat.limits.max_compute_units],
            ["Active leases", seat.limits.max_active_leases],
            [
              "Tick window",
              `[${seat.limits.not_before_tick}, ${seat.limits.expiry_tick})`,
            ],
          ])}
        </article>
      </div>

      <div class="grid grid-two">
        <article class="card card-soft">
          <span class="kicker">Authority explicitly absent</span>
          <h3>No ambient human or account power</h3>
          ${declarationList(
            Object.entries(seat.authority).map(([key, value]) => [
              pretty(key),
              value,
            ]),
          )}
        </article>
        <article class="card card-soft">
          <span class="kicker">Owner consent</span>
          <h3>Project-bound, revocable only prospectively</h3>
          ${declarationList([
            ["Project", seat.owner_consent.project],
            ["Data route", seat.owner_consent.data_route],
            ["Terms", seat.owner_consent.contribution_terms],
            ["Attribution", seat.owner_consent.attribution],
            [
              "Future entitlement",
              seat.owner_consent.no_future_entitlement ? "NONE" : "DECLARED",
            ],
          ])}
          ${rootLine("Owner consent root", seat.owner_consent.root)}
        </article>
      </div>
    `;
  };

  const workNode = (node, isLead = false) => `
    <article
      class="work-node ${isLead ? "lead-node" : ""}"
      data-status="${safe(node.status)}"
    >
      <div class="node-topline">
        ${chip(node.kind, isLead ? "green" : "blue")}
        ${chip(node.status, "green")}
      </div>
      <strong class="node-title">${safe(node.title)}</strong>
      <div class="node-meta">
        <span>Seat: <code>${safe(node.seat)}</code></span>
        <span>Budget: <code>${safe(node.budget)} SIM_CREDIT</code></span>
        <span>
          Compute: <code>${safe(node.compute_used)}/${safe(node.compute_ceiling)}</code>
        </span>
        <span>Returned: <code>tick ${safe(node.returned_tick)}</code></span>
      </div>
      <p class="fine-print">${safe(node.lease_scope)}</p>
      <code class="root-value" title="${safe(node.task_id)}">${safe(
        shortId(node.task_id),
      )}</code>
    </article>
  `;

  const renderWork = (data) => {
    byId("work-content").innerHTML = `
      <article class="card">
        <div class="card-header">
          <div>
            <span class="kicker">Capability-narrowing graph</span>
            <h3>Lead coordination with four bounded returns</h3>
          </div>
          ${chip("NO RE-DELEGATION", "green")}
        </div>
        <div class="work-graph">
          ${workNode(data.work_graph.lead, true)}
          <div class="child-nodes">
            ${data.work_graph.children.map((child) => workNode(child)).join("")}
          </div>
        </div>
      </article>
      <article class="card card-soft">
        <div class="row-between">
          <div>
            <span class="kicker">Deterministic scheduler order</span>
            <h3>Arrival time is not an authority shortcut</h3>
          </div>
          ${chip(`${data.work_graph.children.length + 1} TASKS`, "blue")}
        </div>
        <div class="evidence-chain" aria-label="Scheduler comparison order">
          ${data.work_graph.scheduler_order
            .map((field) => `<span>${safe(field)}</span>`)
            .join("")}
        </div>
      </article>
    `;
  };

  const renderEvidence = (data) => {
    const { evidence } = data;
    byId("evidence-content").innerHTML = `
      <div class="grid grid-wide-narrow">
        <article class="card">
          <div class="card-header">
            <div>
              <span class="kicker">Literal verifier output</span>
              <h3>${safe(evidence.checks.length)} required checks</h3>
            </div>
            ${chip("ALL PASS", "green")}
          </div>
          <div class="check-list">
            ${evidence.checks
              .map(
                (check) => `
                  <div class="check-row">
                    <span class="check-icon" aria-hidden="true">&#10003;</span>
                    <div>
                      <strong>${safe(check.name)}</strong>
                      <small><code>${safe(check.command.join(" "))}</code></small>
                      <small>${safe(check.observation)}</small>
                    </div>
                    ${chip(check.status, "green")}
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="card card-soft">
          <span class="kicker">Evidence precedence</span>
          <h3>Claims resolve downward to bytes</h3>
          <div class="evidence-chain" aria-label="Evidence hierarchy">
            ${evidence.hierarchy
              .map((level) => `<span>${safe(level)}</span>`)
              .join("")}
          </div>
          <div class="stack">
            ${rootLine("Evidence root", evidence.evidence_root)}
            ${rootLine("Manifest root", evidence.manifest_root)}
            ${rootLine("Source root", evidence.source_root)}
            ${rootLine("Verifier root", evidence.verifier_root)}
            ${rootLine("Policy root", evidence.policy_root)}
          </div>
        </article>
      </div>
    `;
  };

  const renderReview = (data) => {
    const gate = data.review_gate;
    byId("review-content").innerHTML = `
      <article class="card">
        <div class="review-summary">
          <div>
            <span class="kicker">Gate result</span>
            <strong>${safe(gate.received_reviews)} / ${safe(
              gate.required_reviews,
            )} valid reviews</strong>
            <p>Each review is funded, assigned, and bound to the same packet root.</p>
          </div>
          <div class="chip-row" aria-label="Review outcome labels">
            ${chip(gate.summary_label, "red")}
            ${chip(`COMPOSITE INDEPENDENCE: ${gate.composite_independence_label}`, "red")}
            ${chip(gate.outcome, "amber")}
          </div>
        </div>
        <div class="grid grid-three">
          ${gate.reviewers
            .map(
              (review) => `
                <article class="review-card">
                  <span class="review-seat">Funded slot ${safe(review.slot + 1)} of 3</span>
                  <strong class="review-model">${safe(review.model_id)}</strong>
                  <div class="review-verdict">
                    <strong>${safe(review.verdict)}</strong>
                    <span>${safe(review.severity)}</span>
                  </div>
                  <p>${safe(review.finding)}</p>
                  <div class="chip-row">
                    ${chip(review.provider_family, "red")}
                    ${chip(review.operator_id, "red")}
                  </div>
                  <p class="fine-print">
                    ${safe(review.payment)} SIM_CREDIT / ${safe(
                      review.payment_status,
                    )}
                  </p>
                  <code class="root-value" title="${safe(review.review_id)}">${safe(
                    shortId(review.review_id),
                  )}</code>
                </article>
              `,
            )
            .join("")}
        </div>
        ${rootLine("Exact shared review packet", gate.packet_root)}
      </article>

      <div class="receipt-table-wrap">
        <table class="diversity-table">
          <caption>
            Correlation labels are dimension-specific. Model count never becomes
            a composite independence claim.
          </caption>
          <thead>
            <tr>
              <th scope="col">Dimension</th>
              <th scope="col">Observed value</th>
              <th scope="col">Evidence</th>
              <th scope="col">Relationship</th>
            </tr>
          </thead>
          <tbody>
            ${gate.diversity
              .map(
                (item) => `
                  <tr>
                    <td>${safe(item.dimension)}</td>
                    <td>${safe(item.values)}</td>
                    <td>${safe(item.evidence_class)}</td>
                    <td>
                      <span
                        class="relationship"
                        data-tone="${safe(toneForRelationship(item.relationship))}"
                      >
                        ${safe(item.relationship)}
                      </span>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderHold = (data) => {
    const { hold } = data;
    const appeal = hold.appeal;
    byId("hold-content").innerHTML = `
      <div class="hold-banner">
        <span class="hold-icon" aria-hidden="true">!</span>
        <div>
          <span class="kicker">Outcome ${safe(data.review_gate.outcome)}</span>
          <h3>${safe(hold.safest_next_action)}</h3>
          <p>
            Decision authority: <strong>${safe(hold.decision_authority)}</strong>.
            Merge authority: <strong>${safe(hold.merge_authority)}</strong>.
          </p>
        </div>
      </div>

      <div class="grid grid-two">
        <article class="card">
          <span class="kicker">Machine-readable reasons</span>
          <h3>Why the boundary remains unresolved</h3>
          <ul class="reason-list">
            ${hold.reason_codes
              .map(
                (reason) => `
                  <li>
                    <code>${safe(reason.code)}</code>
                    <span>${safe(reason.message)}</span>
                  </li>
                `,
              )
              .join("")}
          </ul>
          ${rootLine("Hold root", hold.hold_root)}
          <p class="fine-print">
            Created at tick ${safe(hold.created_tick)}; decision deadline tick
            ${safe(hold.deadline_tick)}.
          </p>
        </article>

        <article class="card">
          <span class="kicker">Contract-bound next paths</span>
          <h3>No hidden accept button</h3>
          <div class="decision-paths">
            ${hold.paths
              .map(
                (path) => `
                  <div class="path-item">
                    <strong>${safe(path.event)}</strong>
                    <span>${safe(path.description)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      </div>

      <article class="card card-soft">
        <div class="card-header">
          <div>
            <span class="kicker">Appeal route</span>
            <h3>${safe(appeal.status)}</h3>
            <p>${safe(appeal.why)}</p>
          </div>
          ${chip("MAX 1 ROUND", "amber")}
        </div>
        <div class="appeal-timeline" aria-label="Appeal stages">
          <div class="appeal-step">
            <strong>Eligible decision</strong>
            <span>Human authority must act first</span>
          </div>
          <div class="appeal-step">
            <strong>File within ${safe(appeal.filing_window_ticks)} ticks</strong>
            <span>${safe(appeal.eligible_roles.join(" / "))}</span>
          </div>
          <div class="appeal-step">
            <strong>${safe(appeal.resolver)}</strong>
            <span>${safe(appeal.resolver_relationship)}</span>
          </div>
          <div class="appeal-step">
            <strong>Resolve within ${safe(appeal.resolution_window_ticks)} ticks</strong>
            <span>${safe(appeal.unavailable_resolver_policy)}</span>
          </div>
        </div>
        <p class="fine-print">
          Evidence: ${safe(appeal.evidence_access)}. Payout effect:
          ${safe(appeal.payout_effect)}. Anti-retaliation:
          ${appeal.anti_retaliation ? "DECLARED" : "NOT DECLARED"}.
        </p>
      </article>
    `;
  };

  const renderPrivacy = (data) => {
    const label = data.privacy_label;
    const nutrition = [
      ["Data leaving", label.data_leaving, "green"],
      ["Network", label.network, "green"],
      ["Files", label.files, "violet"],
      ["Spend", label.spend, "amber"],
      ["Time", label.time, "amber"],
      ["Re-delegation", label.redelegation, "green"],
      ["Secrets", label.secrets, "green"],
      ["Isolation", label.isolation, "violet"],
      ["Storage", label.storage, "green"],
      ["Publication", label.publication, "blue"],
    ];

    byId("privacy-content").innerHTML = `
      <article class="card privacy-label">
        <div class="card-header">
          <div>
            <span class="kicker">Privacy and capability nutrition label</span>
            <h3>PUBLIC_LOCAL / least capability</h3>
            <p>Declarations are explicit; unknown proof never renders as verified.</p>
          </div>
          ${chip("NO SECRETS", "green")}
        </div>
        <div class="nutrition-grid">
          ${nutrition
            .map(
              ([name, value, tone]) => `
                <div class="nutrition-item" data-tone="${safe(tone)}">
                  <span class="micro-label">${safe(name)}</span>
                  <strong>${safe(value)}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
        <p class="fine-print">
          Proof limit: ${safe(label.proof_limit)}. This label states the fixture
          boundary; it does not prove a remote execution environment.
        </p>
      </article>

      <div class="boundary-stack" aria-label="Authority boundary layers">
        <div class="boundary-layer">
          <span>01</span>
          <strong>Public job packet</strong>
          <small>Accepted roots and bounded source only</small>
        </div>
        <div class="boundary-layer">
          <span>02</span>
          <strong>Donated local seat</strong>
          <small>No egress, secrets, wallet, or provider credentials</small>
        </div>
        <div class="boundary-layer">
          <span>03</span>
          <strong>Read-only presentation</strong>
          <small>No canonical event submission or durable storage</small>
        </div>
      </div>
    `;
  };

  const renderSettlement = (data) => {
    const settlement = data.settlement_preview;
    const accrued = settlement.payouts.reduce(
      (sum, payout) => sum + payout.amount,
      0,
    );
    const routed = settlement.summary.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    byId("settlement-content").innerHTML = `
      <div class="grid grid-wide-narrow">
        <article class="card">
          <div class="card-header">
            <div>
              <span class="kicker">Locked preview, not execution</span>
              <h3>${safe(settlement.status)}</h3>
            </div>
            ${chip(`${settlement.total} ${settlement.unit}`, "amber")}
          </div>
          <div class="settlement-visual">
            <div class="settlement-ring" aria-label="${safe(
              settlement.total,
            )} total simulated credits">
              <span>
                <strong>${safe(settlement.total)}</strong>
                ${safe(settlement.unit)}
              </span>
            </div>
            <ul class="settlement-list">
              ${settlement.summary
                .map(
                  (item) => `
                    <li>
                      <span class="legend-dot" data-tone="${safe(item.tone)}"></span>
                      <span>${safe(item.label)}</span>
                      <strong>${safe(item.amount)}</strong>
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </div>
          <div class="math-check">
            <strong>${safe(routed)} = ${safe(settlement.total)}</strong>
            <span>Every simulated unit has one declared destination.</span>
          </div>
        </article>

        <article class="card card-soft">
          <span class="kicker">Accrued valid payouts</span>
          <h3>${safe(accrued)} ${safe(settlement.unit)} pending</h3>
          <ul class="settlement-list">
            ${settlement.payouts
              .map(
                (payout) => `
                  <li>
                    <span class="legend-dot" data-tone="green"></span>
                    <span>
                      ${safe(payout.label)}
                      <small>${safe(payout.destination)} / ${safe(payout.status)}</small>
                    </span>
                    <strong>${safe(payout.amount)}</strong>
                  </li>
                `,
              )
              .join("")}
          </ul>
          <p class="fine-print">
            GitHub failure effect: ${safe(settlement.github_failure_effect)}.
            ${safe(settlement.terminal_note)}
          </p>
        </article>
      </div>
    `;
  };

  const renderReceipts = (data) => {
    const head = data.receipts.at(-1);
    byId("receipts-content").innerHTML = `
      <div class="chain-health">
        <span>${safe(data.receipts.length)} / ${safe(
          data.receipts.length,
        )} linked receipts</span>
        <span>
          Journal head:
          <code title="${safe(data.snapshot.journal_head)}">${safe(
            shortId(data.snapshot.journal_head),
          )}</code>
        </span>
      </div>
      <div class="receipt-table-wrap">
        <table class="receipt-table">
          <caption>
            Accepted fixture events from job creation through the current HOLD.
            Select a receipt ID for its exact roots, effects, and invariants.
          </caption>
          <thead>
            <tr>
              <th scope="col">Seq</th>
              <th scope="col">Event</th>
              <th scope="col">Actor</th>
              <th scope="col">Tick</th>
              <th scope="col">Receipt</th>
            </tr>
          </thead>
          <tbody>
            ${data.receipts
              .map(
                (receipt) => `
                  <tr>
                    <td>${safe(receipt.sequence)}</td>
                    <td>${safe(receipt.event_type)}</td>
                    <td>${safe(receipt.actor)}</td>
                    <td>${safe(receipt.logical_tick)}</td>
                    <td>
                      <button
                        class="receipt-button"
                        type="button"
                        data-receipt-sequence="${safe(receipt.sequence)}"
                        aria-haspopup="dialog"
                        aria-label="Inspect receipt ${safe(receipt.sequence)}: ${safe(
                          receipt.event_type,
                        )}"
                      >
                        ${safe(shortId(receipt.receipt_id))}
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="fine-print">
        Latest accepted event: ${safe(head.event_type)} at logical tick
        ${safe(head.logical_tick)}. The receipt drawer is a read-only projection.
      </p>
    `;
  };

  const renderNonClaims = (data) => {
    byId("nonclaims-content").innerHTML = `
      <article class="card">
        <ul class="nonclaims-list">
          ${data.non_claims.claims_not_made
            .map((claim) => `<li><code>${safe(claim)}</code></li>`)
            .join("")}
        </ul>
        ${rootLine("Canonical non-claims root", data.non_claims.root)}
      </article>
    `;
  };

  const renderReceiptDrawer = (receipt) => {
    byId("receipt-drawer-title").textContent =
      `Receipt ${receipt.sequence}: ${receipt.event_type}`;
    byId("receipt-drawer-body").innerHTML = `
      <div class="receipt-identity">
        <div class="receipt-field">
          <span class="micro-label">Sequence</span>
          <strong>${safe(receipt.sequence)}</strong>
        </div>
        <div class="receipt-field">
          <span class="micro-label">Logical tick</span>
          <strong>${safe(receipt.logical_tick)}</strong>
        </div>
        <div class="receipt-field">
          <span class="micro-label">Actor</span>
          <strong>${safe(receipt.actor)}</strong>
        </div>
        <div class="receipt-field">
          <span class="micro-label">Event type</span>
          <strong>${safe(receipt.event_type)}</strong>
        </div>
        <div class="receipt-field wide">
          <span class="micro-label">Receipt ID</span>
          <code class="root-value">${safe(receipt.receipt_id)}</code>
        </div>
        <div class="receipt-field wide">
          <span class="micro-label">Event ID</span>
          <code class="root-value">${safe(receipt.event_id)}</code>
        </div>
        <div class="receipt-field wide">
          <span class="micro-label">Previous receipt root</span>
          <code class="root-value">${safe(
            receipt.previous_receipt_root ?? "GENESIS",
          )}</code>
        </div>
        <div class="receipt-field wide">
          <span class="micro-label">Predecessor state root</span>
          <code class="root-value">${safe(receipt.predecessor_root)}</code>
        </div>
        <div class="receipt-field wide">
          <span class="micro-label">Next state root</span>
          <code class="root-value">${safe(receipt.next_state_root)}</code>
        </div>
      </div>
      <div class="grid grid-two">
        <article class="card card-soft">
          <span class="kicker">Accepted effects</span>
          <ul class="effect-list">
            ${receipt.effects.map((effect) => `<li>${safe(effect)}</li>`).join("")}
          </ul>
        </article>
        <article class="card card-soft">
          <span class="kicker">Checked invariants</span>
          <ul class="invariant-list">
            ${receipt.invariants
              .map((invariant) => `<li>${safe(invariant)}</li>`)
              .join("")}
          </ul>
        </article>
      </div>
    `;
  };

  const setupReceiptDrawer = (data) => {
    const drawer = byId("receipt-drawer");
    const backdrop = byId("drawer-backdrop");
    const closeButton = byId("close-receipt");
    const latestButton = byId("open-latest-receipt");
    const receiptRegion = byId("receipts-content");
    let returnFocus = null;

    const openReceipt = (receipt, trigger) => {
      renderReceiptDrawer(receipt);
      returnFocus = trigger;
      drawer.hidden = false;
      backdrop.hidden = false;
      document.body.classList.add("drawer-open");
      closeButton.focus();
    };

    const closeReceipt = () => {
      if (drawer.hidden) return;
      drawer.hidden = true;
      backdrop.hidden = true;
      document.body.classList.remove("drawer-open");
      returnFocus?.focus();
      returnFocus = null;
    };

    receiptRegion.addEventListener("click", (event) => {
      const button = event.target.closest("[data-receipt-sequence]");
      if (!button) return;
      const sequence = Number(button.dataset.receiptSequence);
      const receipt = data.receipts.find((item) => item.sequence === sequence);
      if (receipt) openReceipt(receipt, button);
    });

    latestButton.disabled = false;
    latestButton.addEventListener("click", () =>
      openReceipt(data.receipts.at(-1), latestButton),
    );
    closeButton.addEventListener("click", closeReceipt);
    backdrop.addEventListener("click", closeReceipt);

    document.addEventListener("keydown", (event) => {
      if (drawer.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeReceipt();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawer.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  };

  const setupTour = () => {
    const buttons = [...document.querySelectorAll("[data-tour-target]")];
    const status = byId("tour-status");
    let highlightTimer = null;

    buttons.forEach((button, index) => {
      button.setAttribute(
        "aria-label",
        `Chapter ${index + 1} of ${buttons.length}: ${button.textContent.trim()}`,
      );
      button.addEventListener("click", () => {
        const target = byId(button.dataset.tourTarget);
        if (!target) return;

        buttons.forEach((item) => item.removeAttribute("aria-current"));
        button.setAttribute("aria-current", "step");
        document.querySelectorAll(".matrix-section.tour-focus").forEach((item) => {
          item.classList.remove("tour-focus");
        });

        target.classList.add("tour-focus");
        target.setAttribute("tabindex", "-1");
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.focus({ preventScroll: true });
        status.textContent =
          `Showing chapter ${index + 1} of ${buttons.length}: ` +
          `${target.querySelector("h2")?.textContent ?? button.textContent.trim()}. ` +
          "The fixture and canonical state are unchanged.";

        window.clearTimeout(highlightTimer);
        highlightTimer = window.setTimeout(() => {
          target.classList.remove("tour-focus");
          target.removeAttribute("tabindex");
        }, 1800);
      });
    });
  };

  const render = (data) => {
    renderHero(data);
    renderFunding(data);
    renderCapacity(data);
    renderWork(data);
    renderEvidence(data);
    renderReview(data);
    renderHold(data);
    renderPrivacy(data);
    renderSettlement(data);
    renderReceipts(data);
    renderNonClaims(data);
    setupReceiptDrawer(data);
    setupTour();

    document.documentElement.dataset.walkthroughReady = "true";
  };

  const showFatalError = (error) => {
    byId("fatal-error-message").textContent =
      error instanceof Error ? error.message : String(error);
    byId("fatal-error").hidden = false;
  };

  const start = async () => {
    try {
      const response = await fetch(FIXTURE_URL, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(
          `Local fixture request failed with HTTP ${response.status}.`,
        );
      }
      const data = await response.json();
      assertFixture(data);
      render(data);
    } catch (error) {
      showFatalError(error);
    }
  };

  start();
})();
