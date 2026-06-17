import type { APIEvent } from "@solidjs/start/server";
import {
  exportContentfulCsv,
  getContentfulTableStatuses,
  importContentfulCsv,
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
  const contentfulMessage = getContentfulMessage(raw);
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
          `Contentful said: ${contentfulMessage}.`
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
      message: contentfulMessage || "Unable to manage Contentful tables"
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

function getContentfulMessage(raw: string) {
  const parsed = parseJsonLikeMessage(raw);
  const firstValidationError = parsed?.details?.errors?.[0]?.details;
  if (parsed?.message && firstValidationError) {
    return `${parsed.message}: ${firstValidationError}`;
  }
  if (parsed?.message) return parsed.message;
  const messageMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (messageMatch?.[1]) return messageMatch[1];
  if (raw.includes("Access token invalid")) return "Access token invalid";
  return raw
    .replace(/\s+/g, " ")
    .replace(/"Authorization"\s*:\s*"Bearer [^"]+"/g, '"Authorization":"Bearer [hidden]"')
    .slice(0, 240);
}

function parseJsonLikeMessage(raw: string): {
  details?: { errors?: Array<{ details?: string }> };
  message?: string;
} | null {
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return null;

  try {
    return JSON.parse(raw.slice(jsonStart)) as {
      details?: { errors?: Array<{ details?: string }> };
      message?: string;
    };
  } catch {
    return null;
  }
}

export async function POST(event: APIEvent) {
  let context: RequestContext = {
    environmentId: "master",
    hasPageToken: false,
    spaceId: ""
  };

  try {
    const body = await event.request.json();
    const action = body.action as "exportCsv" | "importCsv" | "initialize" | "status";
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

    if (action === "importCsv") {
      try {
        const result = await importContentfulCsv(settings, body.tableName, String(body.csvText ?? ""));
        return jsonResponse({ ok: true, ...result });
      } catch (importError) {
        // Provide detailed error for CSV import failures
        const errorMessage = importError instanceof Error ? importError.message : String(importError);
        return jsonResponse({
          ok: false,
          message: `CSV import failed: ${errorMessage.slice(0, 500)}`
        }, 400);
      }
    }

    if (action === "exportCsv") {
      const result = await exportContentfulCsv(settings, body.tableName);
      return jsonResponse({ ok: true, ...result });
    }

    return jsonResponse({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    return contentfulErrorResponse(error, context);
  }
}
