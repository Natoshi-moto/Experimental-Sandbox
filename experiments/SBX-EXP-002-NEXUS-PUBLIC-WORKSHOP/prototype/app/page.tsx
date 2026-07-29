import Image from "next/image";
import { HoldNotice } from "@/components/hold-notice";
import { latestPublishedItem } from "@/lib/content/catalogue";

const latestNote = latestPublishedItem("notes");

const records = [
  {
    number: "01",
    status: latestNote?.label ?? "Field note",
    title: latestNote?.title ?? "Latest note",
    copy:
      latestNote?.summary ??
      "The newest source-linked note from the public workshop.",
    action: "Read the note",
    href: latestNote?.route ?? "#notes",
  },
  {
    number: "02",
    status: "Working demonstration",
    title: "NEXUS Assistant",
    copy: "A local prototype for human-directed AI work: agents, reversible changes, recall, and evidence in one interface.",
    action: "See what works",
    href: "#demonstrations",
  },
  {
    number: "03",
    status: "Evidence",
    title: "Build receipts",
    copy: "Repository history, pinned checkpoints, test results, audit outcomes, known caveats, and the claims they actually support.",
    action: "Inspect the record",
    href: "#evidence",
  },
];

const evidenceLabels = [
  {
    label: "Published position",
    copy: "What I am prepared to stand behind publicly.",
  },
  {
    label: "Working demonstration",
    copy: "Something that runs in a bounded prototype today, though not necessarily on this website.",
  },
  {
    label: "Evidence",
    copy: "Source, test, checkpoint, audit, or decision record.",
  },
  {
    label: "Experiment",
    copy: "Active exploration whose mechanics and conclusions may change.",
  },
];

const principles = [
  {
    number: "I",
    title: "Use what is already being wasted",
    copy: "Turn already-paid, otherwise-unused AI and API capacity into useful work.",
  },
  {
    number: "II",
    title: "Keep capital out of the control loop",
    copy: "No fundraising, premine, or external-payments design. NEX is being explored only as an internal unit for bounded AI and compute work inside NEXUS.",
  },
  {
    number: "III",
    title: "Distribute power without erasing responsibility",
    copy: "The aim is no permanent central control. Bootstrap decisions, governance changes, dissent, and failures should remain traceable from genesis.",
  },
];

const securityControls = [
  {
    state: "Absent",
    title: "No public write surface",
    copy: "No browser editor, form, account system, upload route, write API, database, or site-held credential.",
  },
  {
    state: "Enforced",
    title: "Fail-closed request boundary",
    copy: "Only GET and HEAD reach the application. Server actions and the unused image-processing route are refused.",
  },
  {
    state: "Private",
    title: "No surveillance layer",
    copy: "No analytics, advertising, tracking pixels, third-party browser scripts, or application cookies.",
  },
  {
    state: "Recoverable",
    title: "Source-first publishing",
    copy: "Each publication is compiled from restricted Markdown, validated, hash-receipted, and versioned before deployment.",
  },
];

export default function Home() {
  return (
    <main id="top" className="site-shell">
      <a className="skip-link" href="#workshop">
        Skip to workshop index
      </a>

      <header className="topbar">
        <span className="registration-mark" aria-hidden="true" />
        <a className="wordmark" href="#top" aria-label="NEXUS Public Workshop home">
          NEXUS <span aria-hidden="true">{"//"}</span> PUBLIC WORKSHOP
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#notes">Notes</a>
          <a href="#demonstrations">Demonstrations</a>
          <a href="#evidence">Evidence</a>
          <a href="#security">Security</a>
          <a href="#principles">Principles</a>
          <a href="#about">About</a>
        </nav>

        <details className="mobile-nav">
          <summary>Index</summary>
          <nav aria-label="Mobile navigation">
            <a href="#notes">Notes</a>
            <a href="#demonstrations">Demonstrations</a>
            <a href="#evidence">Evidence</a>
            <a href="#security">Security</a>
            <a href="#principles">Principles</a>
            <a href="#about">About</a>
          </nav>
        </details>

        <span className="registration-mark registration-mark-right" aria-hidden="true" />
      </header>

      <HoldNotice />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true">
          <Image
            src="/nexus-workshop-hero.webp"
            alt=""
            width="1672"
            height="941"
            priority
            unoptimized
          />
          <span className="hero-art-fade" />
        </div>

        <div className="hero-copy">
          <p className="eyebrow">An open workshop for distributed reasoning</p>
          <h1 id="hero-title">
            Turn unused machine reasoning into useful public work.
          </h1>
          <p className="hero-deck">
            I publish what I think, what the agents build, what survived
            scrutiny, and what is still only an experiment.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#workshop">
              <span>Enter the workshop</span>
              <span aria-hidden="true">→</span>
            </a>
            <a
              className="text-action"
              href="https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/PUBLIC_OPERATOR_POSITION.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the public position
            </a>
          </div>
        </div>
      </section>

      <div className="charged-seam" aria-hidden="true">
        <span />
      </div>

      <section id="workshop" className="record-grid" aria-label="Workshop index">
        {records.map((record) => (
          <article className="record-card" key={record.number}>
            <div className="record-meta">
              <span>{record.number}</span>
              <span>{record.status}</span>
            </div>
            <h2>{record.title}</h2>
            <p>{record.copy}</p>
            <a href={record.href}>
              {record.action}
              <span aria-hidden="true">→</span>
            </a>
          </article>
        ))}
      </section>

      <section id="notes" className="paper-section note-section">
        <div className="section-kicker">
          <span>{latestNote?.label ?? "Field note"} / 001</span>
          <span>{latestNote?.publishedAt ?? "Public workshop"}</span>
        </div>
        <div className="section-heading">
          <p>Why this exists</p>
          <h2>{latestNote?.title ?? "Make the work inspectable."}</h2>
        </div>
        <div className="two-column-copy">
          <p className="lead-copy">
            {latestNote?.summary ??
              "NEXUS Public Workshop is where the writing, software, evidence, and unanswered questions live together."}
          </p>
          <div>
            <p>
              The point is not to manufacture the appearance of a finished
              institution. It is to let people see the position, inspect the
              artefacts, try what genuinely works, and tell the difference
              between a result and an ambition.
            </p>
            <p>
              Everything important should be traceable from the claim back to
              the work that produced it.
            </p>
            {latestNote ? (
              <a className="section-read-link" href={latestNote.route}>
                Read the complete source record
                <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section id="demonstrations" className="dark-section">
        <div className="section-kicker section-kicker-dark">
          <span>Working demonstration / 001</span>
          <span>Local prototype</span>
        </div>
        <div className="demo-layout">
          <div className="section-heading section-heading-dark">
            <p>NEXUS Assistant / Matrix Terminal</p>
            <h2>A workbench for directing agents without surrendering the record.</h2>
          </div>
          <div className="demo-panel">
            <div className="demo-panel-topline">
              <span>Demonstrated now</span>
              <span className="live-mark">bounded</span>
            </div>
            <ul>
              <li>
                <span>01</span>
                Agent launching and coordination
              </li>
              <li>
                <span>02</span>
                Reversible file changes, undo, and recall
              </li>
              <li>
                <span>03</span>
                Self-editing with rollback to genesis
              </li>
              <li>
                <span>04</span>
                Tests and evidence kept beside the work
              </li>
            </ul>
            <p>
              This is a local working demonstration, not a hosted public
              service and not a claim of deployment.
            </p>
          </div>
        </div>
      </section>

      <section id="evidence" className="paper-section evidence-section">
        <div className="section-kicker">
          <span>Evidence ledger</span>
          <span>Labels before claims</span>
        </div>
        <div className="section-heading">
          <p>Claims get labels. Work gets receipts.</p>
          <h2>The category is part of the evidence.</h2>
        </div>

        <div className="evidence-grid">
          {evidenceLabels.map((item, index) => (
            <article key={item.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.label}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="evidence-note">
          <p>
            A passing test proves only what it tested. A deployed prototype is
            not a finished system. A proposal is not policy.
          </p>
          <p>
            Known limitations belong beside the evidence, not buried beneath
            it.
          </p>
          <a
            href="https://github.com/Natoshi-moto/Quantum-Nexus"
            target="_blank"
            rel="noreferrer"
          >
            Open the public repository
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section id="security" className="security-section">
        <div className="section-kicker section-kicker-dark">
          <span>Security posture</span>
          <span>Read-only by design</span>
        </div>
        <div className="section-heading section-heading-dark">
          <p>Paranoid architecture</p>
          <h2>Remove the doors. Record every change. Make recovery boring.</h2>
        </div>

        <div className="security-grid">
          {securityControls.map((control, index) => (
            <article key={control.title}>
              <div>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{control.state}</span>
              </div>
              <h3>{control.title}</h3>
              <p>{control.copy}</p>
            </article>
          ))}
        </div>

        <div className="security-statement">
          <p>
            No website is untouchable. This one is built to make silent
            alteration difficult, compromise unrewarding, and restoration from
            a known-good record fast.
          </p>
          <a
            href="https://github.com/Natoshi-moto/Quantum-Nexus/security/advisories/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report a vulnerability privately
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section id="principles" className="principles-section">
        <div className="section-kicker section-kicker-dark">
          <span>Published position</span>
          <span>What I am building toward</span>
        </div>
        <div className="section-heading section-heading-dark">
          <p>The line in the sand</p>
          <h2>Distributed reasoning without a pitch pretending to be a public good.</h2>
        </div>
        <div className="principles-grid">
          {principles.map((principle) => (
            <article key={principle.number}>
              <span>{principle.number}</span>
              <h3>{principle.title}</h3>
              <p>{principle.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="experiment-section" aria-labelledby="experiment-title">
        <div className="experiment-label">
          <span>Research-only exploration / 001</span>
          <span>SBX-SOH-001 active</span>
        </div>
        <div>
          <p>Reasoning Market</p>
          <h2 id="experiment-title">
            Can people contribute, direct, and account for bounded AI work
            without turning the system into another market for capital?
          </h2>
        </div>
        <div className="experiment-copy">
          <p>
            This remains an unfinished exploration. There are no live
            participants, participant-facing credits, live transfers, or real
            model purchases—and no token sale, fundraising round, or external
            payment system.
          </p>
          <a href="#evidence">
            Follow the evidence
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section id="about" className="about-section">
        <span className="registration-mark registration-mark-about" aria-hidden="true" />
        <p>About this workshop</p>
        <h2>
          NEXUS Public Workshop is DDMS&apos;s public workbench.
        </h2>
        <p>
          It keeps the writing, software, evidence, and unanswered questions
          together so the work can be judged from the record rather than the
          pitch.
        </p>
        <a href="#top">
          Return to the top
          <span aria-hidden="true">↑</span>
        </a>
      </section>

      <footer>
        <span>NEXUS // PUBLIC WORKSHOP</span>
        <span>Public prototype // read-only by design // recoverable by record.</span>
      </footer>
    </main>
  );
}
