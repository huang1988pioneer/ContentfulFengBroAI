import { getContentfulConfigStatus } from "../../lib/contentful";
import { getContentfulEnv } from "../../lib/env";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function GET() {
  const env = getContentfulEnv({ allowMissingSpace: true, allowMissingTokens: true });
  const status = Object.fromEntries(
    getContentfulConfigStatus().map((item) => [
      item.name,
      { configured: item.configured, displayValue: item.displayValue }
    ])
  );

  return jsonResponse({
    ok: true,
    values: {
      spaceId: env.spaceId,
      environmentId: env.environmentId,
      locale: env.locale
    },
    tokens: {
      delivery: status.CONTENTFUL_DELIVERY_TOKEN,
      preview: status.CONTENTFUL_PREVIEW_TOKEN,
      management: status.CONTENTFUL_MANAGEMENT_TOKEN
    }
  });
}
