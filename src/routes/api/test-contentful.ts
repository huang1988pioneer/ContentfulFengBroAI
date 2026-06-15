import { createContentfulDeliveryClient } from "../../lib/contentful";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function entryTitle(entry: unknown) {
  if (!entry || typeof entry !== "object" || !("fields" in entry)) {
    return null;
  }

  const fields = (entry as { fields?: Record<string, unknown> }).fields;
  if (!fields) {
    return null;
  }

  for (const key of ["title", "name", "displayName", "slug"]) {
    const value = fields[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

export async function GET() {
  try {
    const client = createContentfulDeliveryClient();
    const entries = await client.getEntries({ limit: 1 });
    const firstEntry = entries.items[0] ?? null;

    return jsonResponse({
      ok: true,
      total: entries.total,
      itemCount: entries.items.length,
      firstEntryTitle: entryTitle(firstEntry),
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to query Contentful"
      },
      500
    );
  }
}
