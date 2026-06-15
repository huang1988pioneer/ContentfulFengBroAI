type ContentfulEnvOptions = {
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

export function getContentfulEnv(options: ContentfulEnvOptions = {}): ContentfulEnv {
  const env = {
    spaceId: process.env.CONTENTFUL_SPACE_ID ?? "",
    environmentId: process.env.CONTENTFUL_ENVIRONMENT_ID ?? "master",
    deliveryToken: process.env.CONTENTFUL_DELIVERY_TOKEN ?? "",
    previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN ?? "",
    managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN ?? "",
    locale: process.env.CONTENTFUL_LOCALE ?? "en-US"
  };

  const missing = [
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
