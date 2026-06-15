import type { APIEvent } from "@solidjs/start/server";

type ContentfulSettings = {
  spaceId?: string;
  environmentId?: string;
  deliveryToken?: string;
  previewToken?: string;
  locale?: string;
  usePreview?: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function entryTitle(entry: unknown) {
  if (!entry || typeof entry !== "object" || !("fields" in entry)) return null;

  const fields = (entry as { fields?: Record<string, unknown> }).fields;
  if (!fields) return null;

  for (const key of ["title", "name", "displayName", "slug"]) {
    const value = fields[key];
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const localized = Object.values(value).find((item) => typeof item === "string");
      if (typeof localized === "string") return localized;
    }
  }

  return null;
}

export async function POST(event: APIEvent) {
  const settings = (await event.request.json()) as ContentfulSettings;
  const spaceId = settings.spaceId?.trim();
  const environmentId = settings.environmentId?.trim() || "master";
  const token = settings.usePreview ? settings.previewToken?.trim() : settings.deliveryToken?.trim();

  if (!spaceId) {
    return jsonResponse({ ok: false, message: "Please enter a Contentful Space ID." }, 400);
  }

  if (!token) {
    return jsonResponse(
      {
        ok: false,
        message: settings.usePreview
          ? "Please enter a Preview Access Token."
          : "Please enter a Delivery Access Token."
      },
      400
    );
  }

  const host = settings.usePreview ? "preview.contentful.com" : "cdn.contentful.com";
  const url = new URL(`https://${host}/spaces/${encodeURIComponent(spaceId)}/environments/${encodeURIComponent(environmentId)}/entries`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  if (settings.locale?.trim()) {
    url.searchParams.set("locale", settings.locale.trim());
  }

  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return jsonResponse(
        {
          ok: false,
          status: response.status,
          message:
            payload?.message ||
            "Contentful connection failed. Please check the Space ID, Environment ID, and token."
        },
        response.status
      );
    }

    const firstEntry = Array.isArray(payload.items) ? payload.items[0] : null;

    return jsonResponse({
      ok: true,
      mode: settings.usePreview ? "Preview" : "Delivery",
      spaceId,
      environmentId,
      total: Number(payload.total ?? 0),
      itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
      firstEntryTitle: entryTitle(firstEntry),
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to connect to Contentful."
      },
      502
    );
  }
}

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      message: "Use the Feng Bro settings page to submit Contentful parameters and test the connection."
    },
    405
  );
}
