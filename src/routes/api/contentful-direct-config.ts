import { getContentfulEnv } from "../../lib/env";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json"
    }
  });
}

export async function GET() {
  const env = getContentfulEnv({ allowMissingSpace: true, allowMissingTokens: true });

  if (!env.spaceId || !env.managementToken) {
    return jsonResponse(
      {
        ok: false,
        message: "Contentful upload settings are not configured."
      },
      400
    );
  }

  return jsonResponse({
    ok: true,
    environmentId: env.environmentId || "master",
    locale: env.locale || "zh-TW",
    managementToken: env.managementToken,
    spaceId: env.spaceId
  });
}
