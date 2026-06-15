import type { APIEvent } from "@solidjs/start/server";
import {
  getContentfulTableStatuses,
  initializeContentfulTables
} from "../../lib/contentful-management";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function contentfulErrorResponse(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const status = getErrorStatus(error, raw);

  if (status === 401 || raw.includes("Access token invalid")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Contentful Management Token 無效。請確認 Stormkit 的 CONTENTFUL_MANAGEMENT_TOKEN 是 Content Management API token（CMA token），不是 Delivery/Preview token，更新後重新部署。"
      },
      401
    );
  }

  if (raw.includes("CONTENTFUL_SPACE_ID") || raw.includes("CONTENTFUL_MANAGEMENT_TOKEN")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "缺少 CONTENTFUL_SPACE_ID 或 CONTENTFUL_MANAGEMENT_TOKEN。請在畫面填入，或在 Stormkit Environment variables 設定後重新部署。"
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
  try {
    const body = await event.request.json();
    const action = body.action as "status" | "initialize";
    const settings = body.settings ?? {};

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
    return contentfulErrorResponse(error);
  }
}
