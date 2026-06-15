import type { APIEvent } from "@solidjs/start/server";
import {
  getContentfulTableStatuses,
  initializeContentfulTables
} from "../../lib/contentful-management";

type RequestContext = {
  environmentId: string;
  hasPageToken: boolean;
  spaceId: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function contentfulErrorResponse(error: unknown, context: RequestContext) {
  const raw = error instanceof Error ? error.message : String(error);
  const status = getErrorStatus(error, raw);
  const tokenSource = context.hasPageToken
    ? "the token entered on this page"
    : "CONTENTFUL_MANAGEMENT_TOKEN from the deployment environment";
  const target = `${context.spaceId || "missing-space"}/${context.environmentId || "master"}`;

  if (status === 401 || raw.includes("Access token invalid")) {
    return jsonResponse(
      {
        ok: false,
        message:
          `Contentful rejected ${tokenSource} for ${target}. ` +
          "Confirm it is a Content Management API token (CMA token) with access to this Space, not a Delivery/Preview token. " +
          `Contentful said: ${raw}`
      },
      401
    );
  }

  if (raw.includes("CONTENTFUL_SPACE_ID") || raw.includes("CONTENTFUL_MANAGEMENT_TOKEN")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Missing Contentful Space ID or Management Token. Enter them on this page, or set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in the deployment environment and redeploy."
      },
      400
    );
  }

  return jsonResponse(
    {
      ok: false,
      message: raw || "Unable to manage Contentful tables"
    },
    status || 500
  );
}

function getErrorStatus(error: unknown, raw: string) {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown; statusCode?: unknown }).status;
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number") return status;
    if (typeof statusCode === "number") return statusCode;
  }

  const match = raw.match(/"status"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : 0;
}

export async function POST(event: APIEvent) {
  let context: RequestContext = {
    environmentId: "master",
    hasPageToken: false,
    spaceId: ""
  };

  try {
    const body = await event.request.json();
    const action = body.action as "status" | "initialize";
    const settings = body.settings ?? {};
    context = {
      environmentId: String(settings.environmentId ?? "").trim() || "master",
      hasPageToken: Boolean(String(settings.managementToken ?? "").trim()),
      spaceId: String(settings.spaceId ?? "").trim()
    };

    if (action === "status") {
      const tables = await getContentfulTableStatuses(settings);
      return jsonResponse({ ok: true, tables });
    }

    if (action === "initialize") {
      const results = await initializeContentfulTables(settings, body.tableName);
      return jsonResponse({ ok: true, results });
    }

    return jsonResponse({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    return contentfulErrorResponse(error, context);
  }
}
