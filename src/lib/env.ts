type ContentfulEnvOptions = {
  allowMissingSpace?: boolean;
  allowMissingTokens?: boolean;
  preview?: boolean;
};

export type ContentfulEnv = {
  spaceId: string;
  environmentId: string;
  deliveryToken: string;
  previewToken: string;
  managementToken: string;
  locale: string;
};

export function normalizeContentfulValue(value?: string) {
  const cleaned = (value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const quoted =
    (cleaned.startsWith("\"") && cleaned.endsWith("\"")) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"));

  return quoted ? cleaned.slice(1, -1).trim() : cleaned;
}

export function normalizeContentfulToken(value?: string) {
  return normalizeContentfulValue(normalizeContentfulValue(value).replace(/^Bearer\s+/i, ""));
}

export function getContentfulEnv(options: ContentfulEnvOptions = {}): ContentfulEnv {
  const env = {
    spaceId: normalizeContentfulValue(process.env.CONTENTFUL_SPACE_ID),
    environmentId: normalizeContentfulValue(process.env.CONTENTFUL_ENVIRONMENT_ID) || "master",
    deliveryToken: normalizeContentfulToken(process.env.CONTENTFUL_DELIVERY_TOKEN),
    previewToken: normalizeContentfulToken(process.env.CONTENTFUL_PREVIEW_TOKEN),
    managementToken: normalizeContentfulToken(process.env.CONTENTFUL_MANAGEMENT_TOKEN),
    locale: normalizeContentfulValue(process.env.CONTENTFUL_LOCALE) || "en-US"
  };

  const missing = options.allowMissingSpace
    ? []
    : [
        ["CONTENTFUL_SPACE_ID", env.spaceId],
        ["CONTENTFUL_ENVIRONMENT_ID", env.environmentId]
      ].filter(([, value]) => !value);

  if (!options.allowMissingTokens) {
    missing.push(
      ...[
        ["CONTENTFUL_DELIVERY_TOKEN", env.deliveryToken],
        ...(options.preview ? [["CONTENTFUL_PREVIEW_TOKEN", env.previewToken]] : [])
      ].filter(([, value]) => !value)
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required Contentful environment variable(s): ${missing
        .map(([name]) => name)
        .join(", ")}`
    );
  }

  return env;
}
