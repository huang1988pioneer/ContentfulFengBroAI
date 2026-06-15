import type { APIEvent } from "@solidjs/start/server";
import {
  uploadFengBroMedia,
  type MediaUploadKind
} from "../../lib/contentful-management";

const mediaKinds = new Set<MediaUploadKind>(["document", "image", "music", "podcast", "video"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function cleanUploadError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const messageMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  return (messageMatch?.[1] ?? raw)
    .replace(/\s+/g, " ")
    .replace(/"Authorization"\s*:\s*"Bearer [^"]+"/g, '"Authorization":"Bearer [hidden]"')
    .slice(0, 320);
}

export async function POST(event: APIEvent) {
  try {
    const formData = await event.request.formData();
    const kind = getString(formData, "kind") as MediaUploadKind;
    const file = formData.get("file");

    if (!mediaKinds.has(kind)) {
      return jsonResponse({ ok: false, message: "Unknown FengBro media upload type." }, 400);
    }

    if (!(file instanceof File) || file.size === 0) {
      return jsonResponse({ ok: false, message: "Please choose a file to upload." }, 400);
    }

    const result = await uploadFengBroMedia({
      kind,
      fileName: file.name,
      contentType: file.type,
      data: await file.arrayBuffer(),
      displayName: getString(formData, "displayName"),
      category: getString(formData, "category"),
      note: getString(formData, "note"),
      ref: getString(formData, "ref"),
      spaceId: getString(formData, "spaceId"),
      environmentId: getString(formData, "environmentId"),
      locale: getString(formData, "locale"),
      managementToken: getString(formData, "managementToken")
    });

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message: cleanUploadError(error)
      },
      500
    );
  }
}

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      message: "Use the Feng Bro settings page to upload media files."
    },
    405
  );
}
