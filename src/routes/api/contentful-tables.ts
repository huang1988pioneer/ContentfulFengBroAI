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
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to manage Contentful tables"
      },
      500
    );
  }
}
