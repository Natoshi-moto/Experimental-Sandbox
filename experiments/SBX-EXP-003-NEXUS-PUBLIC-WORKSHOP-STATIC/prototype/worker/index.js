import { applySecurityHeaders } from "../security/policy.mjs";

const allowedMethods = new Set(["GET", "HEAD"]);
const immutableAssetPattern = /^\/assets\/[a-z0-9-]+\.[a-z0-9]+$/;
const directFilePattern =
  /^\/(?:assets\/[a-z0-9-]+\.[a-z0-9]+|\.well-known\/[a-z0-9.-]+|favicon\.svg|robots\.txt)$/;
const pagePattern = /^\/work\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/;

function withSecurity(response, request, cacheClass = "short") {
  const headers = applySecurityHeaders(new Headers(response.headers));

  if (cacheClass === "immutable") {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (cacheClass === "html") {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function plainResponse(request, status, message, extraHeaders = {}) {
  return withSecurity(
    new Response(message, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...extraHeaders,
      },
    }),
    request,
    "html",
  );
}

function classifyPath(pathname) {
  if (pathname === "/") {
    return { assetPath: "/index.html", cacheClass: "html" };
  }
  if (pagePattern.test(pathname)) {
    const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return { assetPath: `${normalized}index.html`, cacheClass: "html" };
  }
  if (directFilePattern.test(pathname)) {
    return {
      assetPath: pathname,
      cacheClass: immutableAssetPattern.test(pathname)
        ? "immutable"
        : "short",
    };
  }
  return null;
}

function assetRequest(request, assetPath) {
  const url = new URL(request.url);
  url.pathname = assetPath;
  url.search = "";
  return new Request(url, {
    method: request.method,
    headers: request.headers,
  });
}

async function notFound(request, env) {
  const response = await env.ASSETS.fetch(assetRequest(request, "/404.html"));
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return withSecurity(
    new Response(response.body, {
      status: 404,
      headers,
    }),
    request,
    "html",
  );
}

const worker = {
  async fetch(request, env) {
    if (!allowedMethods.has(request.method)) {
      return plainResponse(request, 405, "Method Not Allowed", {
        Allow: "GET, HEAD",
      });
    }

    const { pathname } = new URL(request.url);
    if (
      pathname.includes("%") ||
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.includes("//")
    ) {
      return notFound(request, env);
    }

    const route = classifyPath(pathname);
    if (!route) {
      return notFound(request, env);
    }

    const response = await env.ASSETS.fetch(
      assetRequest(request, route.assetPath),
    );
    if (response.status === 404) {
      return notFound(request, env);
    }

    return withSecurity(response, request, route.cacheClass);
  },
};

export default worker;
