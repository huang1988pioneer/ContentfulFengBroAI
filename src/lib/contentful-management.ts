import {
  createClient as createManagementClient,
  type ContentTypeProps,
  type CreateContentTypeProps,
  type PlainClientAPI
} from "contentful-management";
import { getContentfulEnv, normalizeContentfulToken, normalizeContentfulValue } from "./env";
import { TABLE_SCHEMA_LIST, type TableAttribute, type TableSchema } from "./table-schemas";

type ContentfulSettings = {
  spaceId?: string;
  environmentId?: string;
  managementToken?: string;
};

type ManagementContext = {
  client: PlainClientAPI;
  params: {
    spaceId: string;
    environmentId: string;
  };
};

export type TableStatus = {
  id: string;
  title: string;
  expectedFields: number;
  actualFields: number;
  missingFields: string[];
  conflictFields: Array<{ id: string; expected: string; actual: string }>;
  exists: boolean;
  published: boolean;
};

export type InitializeResult = TableStatus & {
  action: "created" | "updated" | "skipped";
};

export async function getContentfulTableStatuses(settings: ContentfulSettings = {}) {
  const context = getManagementContext(settings);
  const response = await context.client.contentType.getMany({
    ...context.params,
    query: { limit: 1000 }
  });
  const byId = new Map(response.items.map((item) => [item.sys.id, item]));

  return TABLE_SCHEMA_LIST.map((schema) => getTableStatus(schema, byId.get(schema.name)));
}

export async function initializeContentfulTables(
  settings: ContentfulSettings = {},
  tableName?: string
) {
  const context = getManagementContext(settings);
  const selectedSchemas = tableName
    ? TABLE_SCHEMA_LIST.filter((schema) => schema.name === tableName)
    : TABLE_SCHEMA_LIST;

  if (selectedSchemas.length === 0) {
    throw new Error(`Unknown FengBro table: ${tableName}`);
  }

  const results: InitializeResult[] = [];

  for (const schema of selectedSchemas) {
    const existing = await findContentType(context, schema.name);

    if (!existing) {
      const created = await context.client.contentType.createWithId(
        { ...context.params, contentTypeId: schema.name },
        toCreateContentType(schema)
      );
      const published = await publishContentType(context, created);
      results.push({ ...getTableStatus(schema, published), action: "created" });
      continue;
    }

    const status = getTableStatus(schema, existing);
    if (status.missingFields.length === 0) {
      results.push({ ...status, action: "skipped" });
      continue;
    }

    const updated = await context.client.contentType.update(
      { ...context.params, contentTypeId: schema.name },
      {
        ...existing,
        fields: [
          ...existing.fields,
          ...schema.attributes
            .filter((attribute) => status.missingFields.includes(attribute.key))
            .map(toContentfulField)
        ]
      }
    );
    const published = await publishContentType(context, updated);
    results.push({ ...getTableStatus(schema, published), action: "updated" });
  }

  return results;
}

function getManagementContext(settings: ContentfulSettings): ManagementContext {
  const env = getContentfulEnv({ allowMissingTokens: true });
  const spaceId = normalizeContentfulValue(settings.spaceId) || env.spaceId;
  const environmentId = normalizeContentfulValue(settings.environmentId) || env.environmentId;
  const accessToken = normalizeContentfulToken(settings.managementToken) || env.managementToken;

  if (!spaceId || !accessToken) {
    throw new Error("CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN are required.");
  }

  return {
    client: createManagementClient({ accessToken }),
    params: { spaceId, environmentId }
  };
}

async function findContentType(context: ManagementContext, contentTypeId: string) {
  try {
    return await context.client.contentType.get({ ...context.params, contentTypeId });
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function getTableStatus(schema: TableSchema, contentType?: ContentTypeProps): TableStatus {
  const fields = contentType?.fields ?? [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const missingFields = schema.attributes
    .filter((attribute) => !fieldsById.has(attribute.key))
    .map((attribute) => attribute.key);
  const conflictFields = schema.attributes
    .map((attribute) => {
      const existing = fieldsById.get(attribute.key);
      if (!existing) return null;
      const expected = contentfulFieldType(attribute);
      return expected === existing.type
        ? null
        : { id: attribute.key, expected, actual: existing.type };
    })
    .filter((field): field is { id: string; expected: string; actual: string } => Boolean(field));

  return {
    id: schema.name,
    title: schema.title,
    expectedFields: schema.attributes.length,
    actualFields: fields.length,
    missingFields,
    conflictFields,
    exists: Boolean(contentType),
    published: Boolean(contentType?.sys.publishedVersion)
  };
}

function toCreateContentType(schema: TableSchema): CreateContentTypeProps {
  return {
    name: schema.title,
    description: schema.description,
    displayField: getDisplayField(schema),
    fields: schema.attributes.map(toContentfulField)
  };
}

function toContentfulField(attribute: TableAttribute) {
  const field: CreateContentTypeProps["fields"][number] = {
    id: attribute.key,
    name: toFieldName(attribute.key),
    type: contentfulFieldType(attribute),
    required: Boolean(attribute.required),
    localized: false
  };

  if (attribute.default !== undefined) {
    field.defaultValue = { "en-US": attribute.default };
  }

  return field;
}

function contentfulFieldType(attribute: TableAttribute) {
  if (attribute.type === "integer") return "Integer";
  if (attribute.type === "datetime") return "Date";
  if (attribute.type === "boolean") return "Boolean";
  if (attribute.type === "url") return "Symbol";
  return (attribute.size ?? 0) > 256 ? "Text" : "Symbol";
}

function toFieldName(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function getDisplayField(schema: TableSchema) {
  return schema.attributes.some((attribute) => attribute.key === "name")
    ? "name"
    : schema.attributes[0]?.key;
}

async function publishContentType(context: ManagementContext, contentType: ContentTypeProps) {
  return context.client.contentType.publish(
    { ...context.params, contentTypeId: contentType.sys.id },
    contentType
  );
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    ("name" in error || "status" in error) &&
    ((error as { name?: string }).name === "NotFound" || (error as { status?: number }).status === 404)
  );
}
