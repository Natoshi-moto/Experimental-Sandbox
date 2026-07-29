import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { HoldNotice } from "@/components/hold-notice";
import {
  findPublishedItem,
  publishedItems,
  type ContentBlock,
} from "@/lib/content/catalogue";

type WorkItemPageProps = {
  params: Promise<{ slug: string }>;
};

const inlinePattern = /(`[^`\n]+`|\[[^\]\n]+]\((?:https:\/\/|\/|#)[^)\s]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    }

    const link = part.match(/^\[([^\]]+)]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const external = href.startsWith("https://");
      return (
        <a
          href={href}
          key={`${index}-${href}`}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {label}
        </a>
      );
    }

    return part;
  });
}

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "paragraph":
      return <p key={index}>{renderInline(block.text)}</p>;
    case "heading":
      return block.level === 2 ? (
        <h2 key={index}>{renderInline(block.text)}</h2>
      ) : (
        <h3 key={index}>{renderInline(block.text)}</h3>
      );
    case "quote":
      return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
    case "list": {
      const children = block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item)}</li>
      ));
      return block.ordered ? (
        <ol key={index}>{children}</ol>
      ) : (
        <ul key={index}>{children}</ul>
      );
    }
    case "code":
      return (
        <pre key={index}>
          <code data-language={block.language || undefined}>{block.text}</code>
        </pre>
      );
  }
}

export function generateStaticParams() {
  return publishedItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: WorkItemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = findPublishedItem(slug);
  if (!item) return {};

  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: item.route },
  };
}

export default async function WorkItemPage({ params }: WorkItemPageProps) {
  const { slug } = await params;
  const item = findPublishedItem(slug);
  if (!item) notFound();

  return (
    <main className="site-shell article-shell">
      <a className="skip-link" href="#publication">
        Skip to publication
      </a>

      <header className="topbar article-topbar">
        <span className="registration-mark" aria-hidden="true" />
        <a className="wordmark" href="/" aria-label="NEXUS Public Workshop home">
          NEXUS <span aria-hidden="true">{"//"}</span> PUBLIC WORKSHOP
        </a>
        <nav className="article-nav" aria-label="Publication navigation">
          <a href="/#security">Security</a>
          <a href="/">Workshop index</a>
        </nav>
        <span
          className="registration-mark registration-mark-right"
          aria-hidden="true"
        />
      </header>

      <HoldNotice />

      <article id="publication" className="work-article">
        <header className="article-header">
          <div className="section-kicker">
            <span>{item.label}</span>
            <time dateTime={item.publishedAt}>{item.publishedAt}</time>
          </div>
          <p className="article-record">Immutable source record</p>
          <h1>{item.title}</h1>
          <p className="article-summary">{item.summary}</p>
        </header>

        <div className="article-body">
          {item.body.map((block, index) => renderBlock(block, index))}
        </div>

        <div className="article-footer">
          <span>
            Source receipt {item.sourceHash.slice(0, 12)}
          </span>
          <a href="/">Return to the workshop →</a>
        </div>
      </article>
    </main>
  );
}
