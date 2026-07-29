import { contentSecurityPolicy } from "../security/policy.mjs";

const operatorPosition =
  "https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/PUBLIC_OPERATOR_POSITION.md";
const currentStatus =
  "https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/EMERGENCY_CURRENT_STATUS.md";
const publicRepository = "https://github.com/Natoshi-moto/Quantum-Nexus";
const vulnerabilityReport =
  "https://github.com/Natoshi-moto/Quantum-Nexus/security/advisories/new";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function localPath(path, basePath) {
  if (!path.startsWith("/") || !basePath) return path;
  return path === "/" ? `${basePath}/` : `${basePath}${path}`;
}

function documentShell({
  title,
  description,
  canonicalPath,
  body,
  assets,
  site,
}) {
  const pageTitle =
    title === "NEXUS Public Workshop"
      ? title
      : `${title} // NEXUS Public Workshop`;
  const canonical = new URL(
    localPath(canonicalPath, site.basePath),
    site.url,
  ).href;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#050806">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy)}">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <link rel="icon" href="${escapeHtml(localPath("/favicon.svg", site.basePath))}" type="image/svg+xml">
    <link rel="preload" href="${escapeHtml(assets.fontSans)}" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${escapeHtml(assets.fontMono)}" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="${escapeHtml(assets.stylesheet)}">
  </head>
  <body>
${body}
  </body>
</html>
`;
}

function wordmark({ article = false, basePath = "" } = {}) {
  return `<header class="topbar${article ? " article-topbar" : ""}">
        <span class="registration-mark" aria-hidden="true"></span>
        <a class="wordmark" href="${article ? localPath("/", basePath) : "#top"}" aria-label="NEXUS Public Workshop home">
          NEXUS <span aria-hidden="true">//</span> PUBLIC WORKSHOP
        </a>
        ${
          article
            ? `<nav class="article-nav" aria-label="Publication navigation">
          <a href="${localPath("/#security", basePath)}">Security</a>
          <a href="${localPath("/", basePath)}">Workshop index</a>
        </nav>`
            : `<nav class="desktop-nav" aria-label="Primary navigation">
          <a href="#notes">Notes</a>
          <a href="#demonstrations">Demonstrations</a>
          <a href="#evidence">Evidence</a>
          <a href="#security">Security</a>
          <a href="#principles">Principles</a>
          <a href="#about">About</a>
        </nav>
        <details class="mobile-nav">
          <summary>Index</summary>
          <nav aria-label="Mobile navigation">
            <a href="#notes">Notes</a>
            <a href="#demonstrations">Demonstrations</a>
            <a href="#evidence">Evidence</a>
            <a href="#security">Security</a>
            <a href="#principles">Principles</a>
            <a href="#about">About</a>
          </nav>
        </details>`
        }
        <span class="registration-mark registration-mark-right" aria-hidden="true"></span>
      </header>`;
}

function holdNotice() {
  return `<aside class="hold-notice" aria-labelledby="hold-notice-title">
        <p class="hold-state">
          <span>SBX-SOH-001</span>
          <span>Active hold</span>
        </p>
        <div>
          <h2 id="hold-notice-title">Public documentary prototype. Not an economic launch.</h2>
          <p>
            Published under <strong>ALLOWED_RESEARCH_ONLY</strong>. No NEX
            issuance, participant-facing wallet, live transfer, recruitment into
            a live credit economy, or real AI-work purchasing is active.
            Publication does not lift or narrow the hold.
          </p>
        </div>
        <nav aria-label="Prototype status records">
          <a href="${currentStatus}" target="_blank" rel="noopener noreferrer">
            Current status <span aria-hidden="true">↗</span>
          </a>
          <a href="${operatorPosition}" target="_blank" rel="noopener noreferrer">
            Operator position <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </aside>`;
}

const evidenceLabels = [
  {
    label: "Published position",
    copy: "What I am prepared to stand behind publicly.",
  },
  {
    label: "Working demonstration",
    copy:
      "Something that runs in a bounded prototype today, though not necessarily on this website.",
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
    copy:
      "Turn already-paid, otherwise-unused AI and API capacity into useful work.",
  },
  {
    number: "II",
    title: "Keep capital out of the control loop",
    copy:
      "No fundraising, premine, or external-payments design. NEX is being explored only as an internal unit for bounded AI and compute work inside NEXUS.",
  },
  {
    number: "III",
    title: "Distribute power without erasing responsibility",
    copy:
      "The aim is no permanent central control. Bootstrap decisions, governance changes, dissent, and failures should remain traceable from genesis.",
  },
];

const securityControls = [
  {
    state: "Absent",
    title: "No public write surface",
    copy:
      "No browser editor, form, account system, upload route, write API, database, or site-held credential.",
  },
  {
    state: "Forbidden",
    title: "No browser scripts",
    copy:
      "The browser receives zero JavaScript. A restrictive policy refuses scripts, connections, frames, forms, and workers.",
  },
  {
    state: "Absent",
    title: "No application tracking",
    copy:
      "No application analytics, advertising, tracking pixels, third-party browser resources, application cookies, or remote fonts.",
  },
  {
    state: "Recoverable",
    title: "Source-first publishing",
    copy:
      "Restricted Markdown becomes static files. Each publication and public static artifact has a reproducible SHA-256 receipt.",
  },
];

function renderCards(items, renderer) {
  return items.map(renderer).join("\n");
}

export function renderHome({ catalogue, assets, site }) {
  const latestNote =
    catalogue.items.find((item) => item.category === "notes") ?? null;
  const records = [
    {
      number: "01",
      status: latestNote?.label ?? "Field note",
      title: latestNote?.title ?? "Latest note",
      copy:
        latestNote?.summary ??
        "The newest source-linked note from the public workshop.",
      action: "Read the note",
      href: latestNote
        ? localPath(latestNote.route, site.basePath)
        : "#notes",
    },
    {
      number: "02",
      status: "Working demonstration",
      title: "NEXUS Assistant",
      copy:
        "A local prototype for human-directed AI work: agents, reversible changes, recall, and evidence in one interface.",
      action: "See what works",
      href: "#demonstrations",
    },
    {
      number: "03",
      status: "Evidence",
      title: "Build receipts",
      copy:
        "Repository history, pinned checkpoints, test results, audit outcomes, known caveats, and the claims they actually support.",
      action: "Inspect the record",
      href: "#evidence",
    },
  ];

  const body = `    <main id="top" class="site-shell">
      <a class="skip-link" href="#workshop">Skip to workshop index</a>
      ${wordmark({ basePath: site.basePath })}
      ${holdNotice()}

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-art" aria-hidden="true">
          <img src="${escapeHtml(assets.hero)}" alt="" width="1672" height="941" fetchpriority="high">
          <span class="hero-art-fade"></span>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">An open workshop for distributed reasoning</p>
          <h1 id="hero-title">Turn unused machine reasoning into useful public work.</h1>
          <p class="hero-deck">
            I publish what I think, what the agents build, what survived
            scrutiny, and what is still only an experiment.
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="#workshop">
              <span>Enter the workshop</span><span aria-hidden="true">→</span>
            </a>
            <a class="text-action" href="${operatorPosition}" target="_blank" rel="noopener noreferrer">
              Read the public position
            </a>
          </div>
        </div>
      </section>

      <div class="charged-seam" aria-hidden="true"><span></span></div>

      <section id="workshop" class="record-grid" aria-label="Workshop index">
${renderCards(
  records,
  (record) => `        <article class="record-card">
          <div class="record-meta">
            <span>${escapeHtml(record.number)}</span>
            <span>${escapeHtml(record.status)}</span>
          </div>
          <h2>${escapeHtml(record.title)}</h2>
          <p>${escapeHtml(record.copy)}</p>
          <a href="${escapeHtml(record.href)}">
            ${escapeHtml(record.action)}<span aria-hidden="true">→</span>
          </a>
        </article>`,
)}
      </section>

      <section id="notes" class="paper-section note-section">
        <div class="section-kicker">
          <span>${escapeHtml(latestNote?.label ?? "Field note")} / 001</span>
          <span>${escapeHtml(latestNote?.publishedAt ?? "Public workshop")}</span>
        </div>
        <div class="section-heading">
          <p>Why this exists</p>
          <h2>${escapeHtml(latestNote?.title ?? "Make the work inspectable.")}</h2>
        </div>
        <div class="two-column-copy">
          <p class="lead-copy">${escapeHtml(
            latestNote?.summary ??
              "NEXUS Public Workshop is where the writing, software, evidence, and unanswered questions live together.",
          )}</p>
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
            ${
              latestNote
                ? `<a class="section-read-link" href="${escapeHtml(localPath(latestNote.route, site.basePath))}">
              Read the complete source record <span aria-hidden="true">→</span>
            </a>`
                : ""
            }
          </div>
        </div>
      </section>

      <section id="demonstrations" class="dark-section">
        <div class="section-kicker section-kicker-dark">
          <span>Working demonstration / 001</span><span>Local prototype</span>
        </div>
        <div class="demo-layout">
          <div class="section-heading section-heading-dark">
            <p>NEXUS Assistant / Matrix Terminal</p>
            <h2>A workbench for directing agents without surrendering the record.</h2>
          </div>
          <div class="demo-panel">
            <div class="demo-panel-topline">
              <span>Demonstrated now</span><span class="live-mark">bounded</span>
            </div>
            <ul>
              <li><span>01</span>Agent launching and coordination</li>
              <li><span>02</span>Reversible file changes, undo, and recall</li>
              <li><span>03</span>Self-editing with rollback to genesis</li>
              <li><span>04</span>Tests and evidence kept beside the work</li>
            </ul>
            <p>
              This is a local working demonstration, not a hosted public
              service and not a claim of deployment.
            </p>
          </div>
        </div>
      </section>

      <section id="evidence" class="paper-section evidence-section">
        <div class="section-kicker">
          <span>Evidence ledger</span><span>Labels before claims</span>
        </div>
        <div class="section-heading">
          <p>Claims get labels. Work gets receipts.</p>
          <h2>The category is part of the evidence.</h2>
        </div>
        <div class="evidence-grid">
${renderCards(
  evidenceLabels,
  (item, index) => `          <article>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.copy)}</p>
          </article>`,
)}
        </div>
        <div class="evidence-note">
          <p>
            A passing test proves only what it tested. A deployed prototype is
            not a finished system. A proposal is not policy.
          </p>
          <p>
            Known limitations belong beside the evidence, not buried beneath it.
          </p>
          <a href="${publicRepository}" target="_blank" rel="noopener noreferrer">
            Open the public repository <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section id="security" class="security-section">
        <div class="section-kicker section-kicker-dark">
          <span>Security posture</span><span>Static files only</span>
        </div>
        <div class="section-heading section-heading-dark">
          <p>Paranoid architecture</p>
          <h2>Remove the doors. Record every change. Make recovery boring.</h2>
        </div>
        <div class="security-grid">
${renderCards(
  securityControls,
  (control, index) => `          <article>
            <div>
              <span>${String(index + 1).padStart(2, "0")}</span>
              <span>${escapeHtml(control.state)}</span>
            </div>
            <h3>${escapeHtml(control.title)}</h3>
            <p>${escapeHtml(control.copy)}</p>
          </article>`,
)}
        </div>
        <div class="security-statement">
          <p>
            No website is untouchable. This one is built to make silent
            alteration difficult, compromise unrewarding, and restoration from
            a known-good record fast.
          </p>
          <a href="${vulnerabilityReport}" target="_blank" rel="noopener noreferrer">
            Report a vulnerability privately <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section id="principles" class="principles-section">
        <div class="section-kicker section-kicker-dark">
          <span>Published position</span><span>What I am building toward</span>
        </div>
        <div class="section-heading section-heading-dark">
          <p>The line in the sand</p>
          <h2>Distributed reasoning without a pitch pretending to be a public good.</h2>
        </div>
        <div class="principles-grid">
${renderCards(
  principles,
  (principle) => `          <article>
            <span>${escapeHtml(principle.number)}</span>
            <h3>${escapeHtml(principle.title)}</h3>
            <p>${escapeHtml(principle.copy)}</p>
          </article>`,
)}
        </div>
      </section>

      <section class="experiment-section" aria-labelledby="experiment-title">
        <div class="experiment-label">
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
        <div class="experiment-copy">
          <p>
            This remains an unfinished exploration. There are no live
            participants, participant-facing credits, live transfers, or real
            model purchases—and no token sale, fundraising round, or external
            payment system.
          </p>
          <a href="#evidence">Follow the evidence <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section id="about" class="about-section">
        <span class="registration-mark registration-mark-about" aria-hidden="true"></span>
        <p>About this workshop</p>
        <h2>NEXUS Public Workshop is DDMS&#39;s public workbench.</h2>
        <p>
          It keeps the writing, software, evidence, and unanswered questions
          together so the work can be judged from the record rather than the
          pitch.
        </p>
        <a href="#top">Return to the top <span aria-hidden="true">↑</span></a>
      </section>

      <footer>
        <span>NEXUS // PUBLIC WORKSHOP</span>
        <span>Static release // zero browser JavaScript // recoverable by record.</span>
      </footer>
    </main>`;

  return documentShell({
    title: "NEXUS Public Workshop",
    description:
      "A public, read-only documentary prototype for NEXUS writing, evidence, and open experiments.",
    canonicalPath: "/",
    body,
    assets,
    site,
  });
}

const inlinePattern =
  /(`[^`\n]+`|\[[^\]\n]+]\((?:https:\/\/|\/|#)[^)\s]+\))/g;

function renderInline(text) {
  return String(text)
    .split(inlinePattern)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }

      const link = part.match(/^\[([^\]]+)]\(([^)]+)\)$/);
      if (link) {
        const [, label, href] = link;
        const external = href.startsWith("https://");
        return `<a href="${escapeHtml(href)}"${
          external ? ' target="_blank" rel="noopener noreferrer"' : ""
        }>${escapeHtml(label)}</a>`;
      }

      return escapeHtml(part);
    })
    .join("");
}

function renderBlock(block) {
  switch (block.type) {
    case "paragraph":
      return `<p>${renderInline(block.text)}</p>`;
    case "heading":
      return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
    case "quote":
      return `<blockquote>${renderInline(block.text)}</blockquote>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join("")}</${tag}>`;
    }
    case "code":
      return `<pre><code${
        block.language
          ? ` data-language="${escapeHtml(block.language)}"`
          : ""
      }>${escapeHtml(block.text)}</code></pre>`;
    default:
      throw new Error(`Unsupported content block: ${block.type}`);
  }
}

export function renderPublication({ item, assets, site }) {
  const body = `    <main class="site-shell article-shell">
      <a class="skip-link" href="#publication">Skip to publication</a>
      ${wordmark({ article: true, basePath: site.basePath })}
      ${holdNotice()}
      <article id="publication" class="work-article">
        <header class="article-header">
          <div class="section-kicker">
            <span>${escapeHtml(item.label)}</span>
            <time datetime="${escapeHtml(item.publishedAt)}">${escapeHtml(item.publishedAt)}</time>
          </div>
          <p class="article-record">Immutable source record</p>
          <h1>${escapeHtml(item.title)}</h1>
          <p class="article-summary">${escapeHtml(item.summary)}</p>
        </header>
        <div class="article-body">
          ${item.body.map(renderBlock).join("\n          ")}
        </div>
        <div class="article-footer">
          <span>Source receipt ${escapeHtml(item.sourceHash)}</span>
          <a href="${localPath("/", site.basePath)}">Return to the workshop →</a>
        </div>
      </article>
    </main>`;

  return documentShell({
    title: item.title,
    description: item.summary,
    canonicalPath: item.route,
    body,
    assets,
    site,
  });
}

export function renderNotFound({ assets, site }) {
  const body = `    <main class="site-shell article-shell">
      ${wordmark({ article: true, basePath: site.basePath })}
      <article class="work-article">
        <header class="article-header">
          <p class="article-record">404 / No public record</p>
          <h1>Nothing is published at this address.</h1>
          <p class="article-summary">
            The workshop failed closed. Return to the public index rather than
            guessing at an unpublished route.
          </p>
        </header>
        <div class="article-footer">
          <span>Static boundary</span>
          <a href="${localPath("/", site.basePath)}">Return to the workshop →</a>
        </div>
      </article>
    </main>`;

  return documentShell({
    title: "Not found",
    description: "No NEXUS Public Workshop record exists at this address.",
    canonicalPath: "/404",
    body,
    assets,
    site,
  });
}
