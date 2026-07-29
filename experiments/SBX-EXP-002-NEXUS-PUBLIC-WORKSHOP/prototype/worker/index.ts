/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const allowedMethods = new Set(["GET", "HEAD"]);

const contentSecurityPolicy = [
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const permissionsPolicy = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-create=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "speaker-selection=()",
  "usb=()",
  "web-share=()",
  "window-management=()",
  "xr-spatial-tracking=()",
].join(", ");

function secureResponse(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const { pathname } = new URL(request.url);
  const contentType = headers.get("content-type") ?? "";

  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("Permissions-Policy", permissionsPolicy);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.delete("Server");
  headers.delete("X-Powered-By");

  if (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/assets/_vinext_fonts/")
  ) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "no-store");
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

function refuse(request: Request, status: number, message: string) {
  return secureResponse(
    new Response(message, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    }),
    request,
  );
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!allowedMethods.has(request.method)) {
      const response = refuse(request, 405, "Method Not Allowed");
      response.headers.set("Allow", "GET, HEAD");
      return response;
    }

    if (
      url.pathname === "/_vinext/image" ||
      url.pathname === "/_next/image"
    ) {
      return refuse(request, 404, "Not Found");
    }

    if (
      request.headers.has("next-action") ||
      request.headers.has("x-rsc-action") ||
      request.headers.get("rsc") === "1" ||
      url.searchParams.has("_rsc")
    ) {
      return refuse(request, 404, "Not Found");
    }

    return secureResponse(await handler.fetch(request, env, ctx), request);
  },
};

export default worker;
