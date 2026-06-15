import type { APIEvent } from "@solidjs/start/server";
import {
  createContentfulEntry,
  deleteContentfulEntry,
  listContentfulEntries,
  updateContentfulEntry
} from "../../lib/contentful-management";

type EntryAction = "create" | "delete" | "list" | "update";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function compactError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const parsed = parseJsonLikeMessage(raw);
  const message = parsed?.message ?? raw;

  if (raw.includes("CONTENTFUL_SPACE_ID") || raw.includes("CONTENTFUL_MANAGEMENT_TOKEN")) {
    return {
      status: 400,
      message:
        "Missing Contentful Space ID or Management Token. Enter them on this page, or set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in the deployment environment and redeploy."
    };
  }

  if (raw.includes("Access token invalid") || getStatus(error, raw) === 401) {
    return {
      status: 401,
      message:
        "Contentful rejected the Management Token. Confirm it is a Content Management API token with access to this Space."
    };
  }

  if (getStatus(error, raw) === 404) {
    return {
      status: 404,
      message: "Contentful content type or entry was not found. Initialize the table first, then reload."
    };
  }

  return {
    status: getStatus(error, raw) || 500,
    message: message
      .replace(/\s+/g, " ")
      .replace(/"Authorization"\s*:\s*"Bearer [^"]+"/g, '"Authorization":"Bearer [hidden]"')
      .slice(0, 320)
  };
}

function getStatus(error: unknown, raw: string) {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown; statusCode?: unknown }).status;
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number") return status;
    if (typeof statusCode === "number") return statusCode;
  }

  const match = raw.match(/"status"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : 0;
}

function parseJsonLikeMessage(raw: string): { message?: string } | null {
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return null;

  try {
    return JSON.parse(raw.slice(jsonStart)) as { message?: string };
  } catch {
    return null;
  }
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const action = body.action as EntryAction;
    const tableName = String(body.tableName ?? "").trim();
    const settings = body.settings ?? {};

    if (!tableName) {
      return jsonResponse({ ok: false, message: "Missing tableName" }, 400);
    }

    if (action === "list") {
      const result = await listContentfulEntries(settings, tableName);
      return jsonResponse({ ok: true, ...result });
    }

    if (action === "create") {
      const result = await createContentfulEntry(settings, tableName, body.values ?? {});
      return jsonResponse({ ok: true, ...result });
    }

    if (action === "update") {
      const entryId = String(body.entryId ?? "").trim();
      if (!entryId) return jsonResponse({ ok: false, message: "Missing entryId" }, 400);
      const result = await updateContentfulEntry(settings, tableName, entryId, body.values ?? {});
      return jsonResponse({ ok: true, ...result });
    }

    if (action === "delete") {
      const entryId = String(body.entryId ?? "").trim();
      if (!entryId) return jsonResponse({ ok: false, message: "Missing entryId" }, 400);
      const result = await deleteContentfulEntry(settings, tableName, entryId);
      return jsonResponse({ ok: true, ...result });
    }

    return jsonResponse({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    const failure = compactError(error);
    return jsonResponse({ ok: false, message: failure.message }, failure.status);
  }
}
