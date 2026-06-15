import { createClient } from "contentful";
import { getContentfulEnv } from "./env";

export function createContentfulDeliveryClient() {
  const env = getContentfulEnv();

  return createClient({
    space: env.spaceId,
    environment: env.environmentId,
    accessToken: env.deliveryToken
  });
}

export function createContentfulPreviewClient() {
  const env = getContentfulEnv({ preview: true });

  return createClient({
    space: env.spaceId,
    environment: env.environmentId,
    accessToken: env.previewToken,
    host: "preview.contentful.com"
  });
}

export function getContentfulConfigStatus() {
  const env = getContentfulEnv({ allowMissingTokens: true });

  return [
    {
      name: "CONTENTFUL_SPACE_ID",
      configured: Boolean(env.spaceId),
      displayValue: env.spaceId
    },
    {
      name: "CONTENTFUL_ENVIRONMENT_ID",
      configured: Boolean(env.environmentId),
      displayValue: env.environmentId
    },
    {
      name: "CONTENTFUL_DELIVERY_TOKEN",
      configured: Boolean(env.deliveryToken),
      displayValue: maskSecret(env.deliveryToken)
    },
    {
      name: "CONTENTFUL_PREVIEW_TOKEN",
      configured: Boolean(env.previewToken),
      displayValue: maskSecret(env.previewToken)
    },
    {
      name: "CONTENTFUL_MANAGEMENT_TOKEN",
      configured: Boolean(env.managementToken),
      displayValue: maskSecret(env.managementToken)
    },
    {
      name: "CONTENTFUL_LOCALE",
      configured: Boolean(env.locale),
      displayValue: env.locale
    }
  ];
}

function maskSecret(value?: string) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
