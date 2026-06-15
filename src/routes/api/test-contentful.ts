import type { APIEvent } from "@solidjs/start/server";
import { getContentfulEnv, normalizeContentfulToken, normalizeContentfulValue } from "../../lib/env";

type ContentfulSettings = {
  spaceId?: string;
  environmentId?: string;
  deliveryToken?: string;
  previewToken?: string;
  locale?: string;
  usePreview?: boolean;
};

type ContentfulPayload = {
  includes?: {
    Asset?: unknown[];
  };
  items?: unknown[];
  message?: string;
  total?: number;
};

type MediaKind = "image" | "video" | "music" | "commondocument" | "podcast";

type MediaPreviewItem = {
  id: string;
  kind: MediaKind;
  title: string;
  fileUrl: string | null;
  fileType: string | null;
  coverUrl: string | null;
  note: string | null;
  category: string | null;
};

type ContentfulFetchResult =
  | {
      ok: true;
      locale: string;
      localeFallback: boolean;
      payload: ContentfulPayload;
    }
  | {
      ok: false;
      locale: string;
      localeFallback: boolean;
      payload: ContentfulPayload;
      status: number;
    };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function contentfulConnectionMessage(status: number, fallback: string, usePreview?: boolean) {
  if (status === 401) {
    return usePreview
      ? "Contentful Preview Token 無效，或不是這個 Space ID 的 token。請確認 CONTENTFUL_PREVIEW_TOKEN 與 CONTENTFUL_SPACE_ID 是同一個 Contentful space。"
      : "Contentful Delivery Token 無效，或不是這個 Space ID 的 token。請確認 CONTENTFUL_DELIVERY_TOKEN 與 CONTENTFUL_SPACE_ID 是同一個 Contentful space。";
  }

  return fallback;
}

function entryTitle(entry: unknown) {
  const fields = entryFields(entry);
  if (!fields) return null;

  for (const key of ["title", "name", "displayName", "slug"]) {
    const value = fieldValue(fields[key]);
    if (typeof value === "string") return value;
  }

  return null;
}

function entryFields(entry: unknown) {
  if (!entry || typeof entry !== "object" || !("fields" in entry)) return null;

  const fields = (entry as { fields?: Record<string, unknown> }).fields;
  if (!fields) return null;

  return fields;
}

function fieldValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const objectValue = value as Record<string, unknown>;
  if ("fields" in objectValue || "sys" in objectValue) return value;

  const localized = Object.values(objectValue).find((item) => item !== undefined && item !== null);
  return localized ?? value;
}

function stringField(fields: Record<string, unknown>, key: string) {
  const value = fieldValue(fields[key]);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function assetUrl(value: unknown, assetsById = new Map<string, unknown>()): string | null {
  const normalized = fieldValue(value);
  if (!normalized || typeof normalized !== "object") {
    return typeof normalized === "string" ? normalized : null;
  }

  const linkedId = (normalized as { sys?: { id?: string; type?: string } }).sys?.id;
  const asset = linkedId ? assetsById.get(linkedId) ?? normalized : normalized;
  const fields = (asset as { fields?: Record<string, unknown> }).fields;
  const file = fieldValue(fields?.file);
  if (!file || typeof file !== "object") return null;

  const url = fieldValue((file as Record<string, unknown>).url);
  return typeof url === "string" ? url : null;
}

function normalizeMediaUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function isUnknownLocale(status: number, payload: ContentfulPayload) {
  return status === 400 && /unknown locale/i.test(payload.message ?? "");
}

async function fetchContentfulEntries(options: {
  environmentId: string;
  host: string;
  locale: string;
  spaceId: string;
  token: string;
}): Promise<ContentfulFetchResult> {
  const buildUrl = (locale?: string) => {
    const url = new URL(
      `https://${options.host}/spaces/${encodeURIComponent(options.spaceId)}/environments/${encodeURIComponent(options.environmentId)}/entries`
    );
    url.searchParams.set("limit", "1");

    if (locale) {
      url.searchParams.set("locale", locale);
    }

    return url;
  };

  const requestEntries = async (locale?: string) => {
    const response = await fetch(buildUrl(locale), {
      headers: {
        Authorization: `Bearer ${options.token}`
      }
    });
    const payload = (await response.json().catch(() => ({}))) as ContentfulPayload;

    return { response, payload };
  };

  const firstAttempt = await requestEntries(options.locale);
  if (firstAttempt.response.ok) {
    return {
      ok: true,
      locale: options.locale,
      localeFallback: false,
      payload: firstAttempt.payload
    };
  }

  if (options.locale && isUnknownLocale(firstAttempt.response.status, firstAttempt.payload)) {
    const fallbackAttempt = await requestEntries();

    if (fallbackAttempt.response.ok) {
      return {
        ok: true,
        locale: "default",
        localeFallback: true,
        payload: fallbackAttempt.payload
      };
    }

    return {
      ok: false,
      locale: "default",
      localeFallback: true,
      payload: fallbackAttempt.payload,
      status: fallbackAttempt.response.status
    };
  }

  return {
    ok: false,
    locale: options.locale,
    localeFallback: false,
    payload: firstAttempt.payload,
    status: firstAttempt.response.status
  };
}

async function fetchMediaPreviews(options: {
  environmentId: string;
  host: string;
  locale: string;
  localeFallback: boolean;
  spaceId: string;
  token: string;
}) {
  const mediaTypes: MediaKind[] = ["image", "video", "music", "commondocument", "podcast"];

  const requests = mediaTypes.map(async (kind) => {
    const url = new URL(
      `https://${options.host}/spaces/${encodeURIComponent(options.spaceId)}/environments/${encodeURIComponent(options.environmentId)}/entries`
    );
    url.searchParams.set("content_type", kind);
    url.searchParams.set("limit", "3");
    url.searchParams.set("include", "2");

    if (options.locale && !options.localeFallback) {
      url.searchParams.set("locale", options.locale);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`
      }
    });

    if (!response.ok) return [];

    const payload = (await response.json().catch(() => ({}))) as ContentfulPayload;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const assetsById = new Map(
      (payload.includes?.Asset ?? [])
        .map((asset) => {
          const id = asset && typeof asset === "object" ? (asset as { sys?: { id?: string } }).sys?.id : undefined;
          return id ? ([id, asset] as const) : null;
        })
        .filter((asset): asset is readonly [string, unknown] => Boolean(asset))
    );

    return items.map((item): MediaPreviewItem | null => {
      const fields = entryFields(item);
      const sys = item && typeof item === "object" ? (item as { sys?: { id?: string } }).sys : undefined;
      if (!fields) return null;

      const fileUrl = normalizeMediaUrl(stringField(fields, "file") ?? assetUrl(fields.file, assetsById));
      const coverUrl = normalizeMediaUrl(stringField(fields, "cover") ?? assetUrl(fields.cover, assetsById));

      return {
        id: sys?.id ?? `${kind}-${Math.random().toString(36).slice(2)}`,
        kind,
        title: entryTitle(item) ?? kind,
        fileUrl,
        fileType: stringField(fields, "filetype"),
        coverUrl,
        note: stringField(fields, "note"),
        category: stringField(fields, "category")
      };
    }).filter((item): item is MediaPreviewItem => Boolean(item));
  });

  const results = await Promise.all(requests);
  return results.flat();
}

export async function POST(event: APIEvent) {
  const settings = (await event.request.json()) as ContentfulSettings;
  const env = getContentfulEnv({ allowMissingTokens: true });
  const spaceId = normalizeContentfulValue(settings.spaceId) || env.spaceId;
  const environmentId = normalizeContentfulValue(settings.environmentId) || env.environmentId;
  const token = settings.usePreview
    ? normalizeContentfulToken(settings.previewToken) || env.previewToken
    : normalizeContentfulToken(settings.deliveryToken) || env.deliveryToken;
  const locale = normalizeContentfulValue(settings.locale) || env.locale;

  if (!spaceId) {
    return jsonResponse({ ok: false, message: "Please enter a Contentful Space ID." }, 400);
  }

  if (!token) {
    return jsonResponse(
      {
        ok: false,
        message: settings.usePreview
          ? "Please enter a Preview Access Token or set CONTENTFUL_PREVIEW_TOKEN in the deployment environment."
          : "Please enter a Delivery Access Token or set CONTENTFUL_DELIVERY_TOKEN in the deployment environment."
      },
      400
    );
  }

  const host = settings.usePreview ? "preview.contentful.com" : "cdn.contentful.com";
  try {
    const result = await fetchContentfulEntries({
      environmentId,
      host,
      locale,
      spaceId,
      token
    });

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          status: result.status,
          message: contentfulConnectionMessage(
            result.status,
            result.payload.message ||
              "Contentful connection failed. Please check the Space ID, Environment ID, and token.",
            settings.usePreview
          ),
          locale: result.locale,
          localeFallback: result.localeFallback
        },
        result.status
      );
    }

    const firstEntry = Array.isArray(result.payload.items) ? result.payload.items[0] : null;
    const mediaPreviews = await fetchMediaPreviews({
      environmentId,
      host,
      locale: result.locale,
      localeFallback: result.localeFallback,
      spaceId,
      token
    });

    return jsonResponse({
      ok: true,
      mode: settings.usePreview ? "Preview" : "Delivery",
      spaceId,
      environmentId,
      locale: result.locale,
      localeFallback: result.localeFallback,
      total: Number(result.payload.total ?? 0),
      itemCount: Array.isArray(result.payload.items) ? result.payload.items.length : 0,
      firstEntryTitle: entryTitle(firstEntry),
      mediaPreviews,
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
