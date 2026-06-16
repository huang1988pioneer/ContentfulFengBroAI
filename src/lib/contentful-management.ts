import {
  type AssetProps,
  createClient as createManagementClient,
  type ContentTypeProps,
  type CreateContentTypeProps,
  type EntryProps,
  type PlainClientAPI
} from "contentful-management";
import { createHash } from "node:crypto";
import { parseCsv, stringifyCsv, type CsvRow } from "./csv";
import { getContentfulEnv, normalizeContentfulToken, normalizeContentfulValue } from "./env";
import {
  TABLE_SCHEMAS,
  TABLE_SCHEMA_LIST,
  type TableAttribute,
  type TableSchema
} from "./table-schemas";

type ContentfulSettings = {
  spaceId?: string;
  environmentId?: string;
  locale?: string;
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

export type CsvImportResult = {
  imported: number;
  locale: string;
  tableName: string;
};

export type CsvExportResult = {
  csv: string;
  fileName: string;
  locale: string;
  rowCount: number;
  tableName: string;
};

export type MediaUploadKind = "document" | "image" | "music" | "podcast" | "video";

export type MediaUploadInput = ContentfulSettings & {
  kind: MediaUploadKind;
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
  displayName?: string;
  category?: string;
  note?: string;
  ref?: string;
};

export type MediaUploadResult = {
  assetId: string;
  contentTypeId: string;
  entryId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  hash: string;
  locale: string;
  url: string;
};

export type ContentfulRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  published: boolean;
  fields: Record<string, unknown>;
};

export type ListEntriesResult = {
  items: ContentfulRecord[];
  locale: string;
  tableName: string;
  total: number;
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

export async function importContentfulCsv(
  settings: ContentfulSettings = {},
  tableName: string,
  csvText: string
): Promise<CsvImportResult> {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  const locale = await getWritableLocale(context, settings.locale);
  const rows = parseCsv(csvText);

  for (const row of rows) {
    const fields = toEntryFields(schema, row, locale);
    const entry = await context.client.entry.create(
      { ...context.params, contentTypeId: schema.name },
      { fields }
    );
    await context.client.entry.publish(
      { ...context.params, entryId: entry.sys.id },
      entry
    );
  }

  return {
    imported: rows.length,
    locale,
    tableName: schema.name
  };
}

export async function exportContentfulCsv(
  settings: ContentfulSettings = {},
  tableName: string
): Promise<CsvExportResult> {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  const locale = await getWritableLocale(context, settings.locale);
  const response = await context.client.entry.getMany({
    ...context.params,
    query: {
      content_type: schema.name,
      limit: 1000,
      order: "sys.createdAt"
    }
  });
  const headers = getCsvHeaders(schema);
  const rows = response.items.map((entry) => toCsvRow(schema, entry, locale));

  return {
    csv: stringifyCsv(headers, rows),
    fileName: `${schema.name}-${new Date().toISOString().slice(0, 10)}.csv`,
    locale,
    rowCount: rows.length,
    tableName: schema.name
  };
}

export async function uploadFengBroMedia(input: MediaUploadInput): Promise<MediaUploadResult> {
  const context = getManagementContext(input);
  const locale = await getWritableLocale(context, input.locale);
  const contentTypeId = mediaContentTypeId(input.kind);
  const fileName = normalizeContentfulValue(input.fileName);
  const title = normalizeContentfulValue(input.displayName) || fileName;
  const contentType = normalizeContentfulValue(input.contentType) || "application/octet-stream";
  const note = normalizeContentfulValue(input.note);
  const category = normalizeContentfulValue(input.category);
  const ref = normalizeContentfulValue(input.ref);
  const buffer = Buffer.from(input.data);
  const hash = createHash("sha256").update(buffer).digest("hex");

  validateMediaContentType(input.kind, contentType);

  const createdAsset = await context.client.asset.createFromFiles(context.params, {
    fields: {
      title: { [locale]: title },
      description: { [locale]: note },
      file: {
        [locale]: {
          file: input.data,
          contentType,
          fileName
        }
      }
    }
  });
  const processedAsset = await context.client.asset.processForLocale(
    context.params,
    createdAsset,
    locale,
    { processingCheckRetries: 12, processingCheckWait: 1000 }
  );
  const publishedAsset = await context.client.asset.publish(
    { ...context.params, assetId: processedAsset.sys.id },
    processedAsset
  );
  const url = getAssetUrl(publishedAsset, locale);
  const createdEntry = await context.client.entry.create(
    { ...context.params, contentTypeId },
    {
      fields: buildMediaEntryFields({
        category,
        contentType,
        contentTypeId,
        fileSize: buffer.byteLength,
        hash,
        locale,
        note,
        ref,
        title,
        url
      })
    }
  );
  const publishedEntry = await context.client.entry.publish(
    { ...context.params, entryId: createdEntry.sys.id },
    createdEntry
  );

  return {
    assetId: publishedAsset.sys.id,
    contentTypeId,
    entryId: publishedEntry.sys.id,
    fileName,
    fileSize: buffer.byteLength,
    fileType: contentType,
    hash,
    locale,
    url
  };
}

export async function listContentfulEntries(
  settings: ContentfulSettings = {},
  tableName: string
): Promise<ListEntriesResult> {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  const locale = await getWritableLocale(context, settings.locale);
  const response = await context.client.entry.getMany({
    ...context.params,
    query: {
      content_type: schema.name,
      include: 0,
      limit: 100,
      order: "-sys.updatedAt"
    }
  });

  return {
    items: response.items.map((entry) => toContentfulRecord(schema, entry, locale)),
    locale,
    tableName: schema.name,
    total: response.total
  };
}

export async function createContentfulEntry(
  settings: ContentfulSettings = {},
  tableName: string,
  values: Record<string, unknown>
) {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  const locale = await getWritableLocale(context, settings.locale);
  const entry = await context.client.entry.create(
    { ...context.params, contentTypeId: schema.name },
    { fields: toEntryFieldsFromValues(schema, values, locale) }
  );
  const published = await context.client.entry.publish(
    { ...context.params, entryId: entry.sys.id },
    entry
  );

  return {
    item: toContentfulRecord(schema, published, locale),
    locale,
    tableName: schema.name
  };
}

export async function updateContentfulEntry(
  settings: ContentfulSettings = {},
  tableName: string,
  entryId: string,
  values: Record<string, unknown>
) {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  const locale = await getWritableLocale(context, settings.locale);
  const entry = await context.client.entry.get({ ...context.params, entryId });
  const updated = await context.client.entry.update(
    { ...context.params, entryId },
    {
      ...entry,
      fields: {
        ...entry.fields,
        ...toEntryFieldsFromValues(schema, values, locale)
      }
    }
  );
  const published = await context.client.entry.publish(
    { ...context.params, entryId },
    updated
  );

  return {
    item: toContentfulRecord(schema, published, locale),
    locale,
    tableName: schema.name
  };
}

export async function deleteContentfulEntry(
  settings: ContentfulSettings = {},
  tableName: string,
  entryId: string
) {
  const schema = getTableSchema(tableName);
  const context = getManagementContext(settings);
  let entry = await context.client.entry.get({ ...context.params, entryId });

  if (entry.sys.publishedVersion) {
    entry = await context.client.entry.unpublish({ ...context.params, entryId }, entry);
  }

  await context.client.entry.delete({ ...context.params, entryId });

  return {
    deleted: true,
    entryId,
    tableName: schema.name
  };
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

async function getWritableLocale(context: ManagementContext, requestedLocale?: string) {
  const requested = normalizeContentfulValue(requestedLocale);
  const response = await context.client.locale.getMany({
    ...context.params,
    query: { limit: 1000 }
  });
  const locales = response.items.filter((locale) => locale.contentManagementApi);
  const requestedMatch = locales.find((locale) => locale.code === requested);
  const defaultLocale = locales.find((locale) => locale.default) ?? locales[0];

  if (!defaultLocale) {
    throw new Error("No writable Contentful locale found for this environment.");
  }

  return requestedMatch?.code ?? defaultLocale.code;
}

function getTableSchema(tableName: string) {
  const schema = TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];

  if (!schema) {
    throw new Error(`Unknown FengBro table: ${tableName}`);
  }

  return schema;
}

function mediaContentTypeId(kind: MediaUploadKind) {
  return kind === "document" ? "commondocument" : kind;
}

function validateMediaContentType(kind: MediaUploadKind, contentType: string) {
  const checks: Record<MediaUploadKind, (value: string) => boolean> = {
    document: (value) =>
      value.startsWith("application/") ||
      value.startsWith("text/") ||
      value === "image/svg+xml",
    image: (value) => value.startsWith("image/"),
    music: (value) => value.startsWith("audio/"),
    podcast: (value) => value.startsWith("audio/"),
    video: (value) => value.startsWith("video/")
  };

  if (!checks[kind](contentType)) {
    throw new Error(`Selected file type ${contentType} is not valid for ${kind} uploads.`);
  }
}

function getAssetUrl(asset: AssetProps, locale: string) {
  const rawUrl = asset.fields.file?.[locale]?.url;
  if (!rawUrl) {
    throw new Error("Contentful asset upload succeeded but no asset URL was returned.");
  }

  return rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
}

function buildMediaEntryFields(options: {
  category: string;
  contentType: string;
  contentTypeId: string;
  fileSize: number;
  hash: string;
  locale: string;
  note: string;
  ref: string;
  title: string;
  url: string;
}) {
  const fields: Record<string, Record<string, unknown>> = {
    category: { [options.locale]: options.category },
    file: { [options.locale]: options.url },
    filetype: { [options.locale]: options.contentType },
    hash: { [options.locale]: options.hash },
    name: { [options.locale]: options.title },
    note: { [options.locale]: options.note },
    ref: { [options.locale]: options.ref }
  };

  if (options.contentTypeId === "image") {
    fields.cover = { [options.locale]: false };
  }

  if (options.contentTypeId === "video") {
    fields.cover = { [options.locale]: "" };
    fields.fileSize = { [options.locale]: options.fileSize };
  }

  if (["commondocument", "music", "podcast"].includes(options.contentTypeId)) {
    fields.cover = { [options.locale]: "" };
  }

  return fields;
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

function getCsvHeaders(schema: TableSchema) {
  const appwriteHeaders: Record<string, string[]> = {
    article: [
      "title",
      "content",
      "category",
      "newDate",
      "url1",
      "url2",
      "url3",
      "file1",
      "file1name",
      "file1type",
      "file2",
      "file2name",
      "file2type",
      "file3",
      "file3name",
      "file3type"
    ],
    bank: ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account"],
    food: ["name", "amount", "todate", "photo", "price", "shop", "photohash"],
    routine: ["name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"],
    subscription: ["name", "site", "price", "nextdate", "note", "account", "currency", "continue"]
  };

  if (schema.name === "commonaccount") {
    return [
      "name",
      ...Array.from({ length: 37 }, (_, index) => {
        const padded = (index + 1).toString().padStart(2, "0");
        return [`site${padded}`, `note${padded}`];
      }).flat()
    ];
  }

  if (appwriteHeaders[schema.name]) {
    return appwriteHeaders[schema.name];
  }

  return schema.attributes.flatMap((attribute) =>
    attribute.type === "object" ? [] : [attribute.key]
  );
}

function toEntryFields(schema: TableSchema, row: CsvRow, locale: string) {
  const fields: Record<string, Record<string, unknown>> = {};

  if (schema.name === "commonaccount") {
    setLocalizedField(fields, "name", locale, row.name);
    setLocalizedField(fields, "sites", locale, getNumberedValues(row, "site"));
    setLocalizedField(fields, "notes", locale, getNumberedValues(row, "note"));
    return fields;
  }

  for (const attribute of schema.attributes) {
    const value = coerceCsvValue(row[attribute.key], attribute);
    if (value !== undefined) {
      setLocalizedField(fields, attribute.key, locale, value);
    }
  }

  return fields;
}

function toEntryFieldsFromValues(
  schema: TableSchema,
  values: Record<string, unknown>,
  locale: string
) {
  const fields: Record<string, Record<string, unknown>> = {};

  for (const attribute of schema.attributes) {
    const value = coerceEntryValue(values[attribute.key], attribute);
    if (value !== undefined) {
      setLocalizedField(fields, attribute.key, locale, value);
    }
  }

  return fields;
}

function toCsvRow(schema: TableSchema, entry: EntryProps, locale: string): CsvRow {
  if (schema.name === "commonaccount") {
    const sites = getEntryValue(entry, "sites", locale);
    const notes = getEntryValue(entry, "notes", locale);
    return {
      name: stringifyEntryValue(getEntryValue(entry, "name", locale)),
      ...numberedObjectToCsv("site", sites),
      ...numberedObjectToCsv("note", notes)
    };
  }

  return Object.fromEntries(
    getCsvHeaders(schema).map((header) => [
      header,
      stringifyEntryValue(getEntryValue(entry, header, locale))
    ])
  );
}

function toContentfulRecord(schema: TableSchema, entry: EntryProps, locale: string): ContentfulRecord {
  return {
    id: entry.sys.id,
    createdAt: entry.sys.createdAt,
    updatedAt: entry.sys.updatedAt,
    published: Boolean(entry.sys.publishedVersion),
    fields: Object.fromEntries(
      schema.attributes.map((attribute) => [
        attribute.key,
        getEntryValue(entry, attribute.key, locale)
      ])
    )
  };
}

function setLocalizedField(
  fields: Record<string, Record<string, unknown>>,
  key: string,
  locale: string,
  value: unknown
) {
  if (value === undefined) return;
  fields[key] = { [locale]: value };
}

function coerceCsvValue(value: string | undefined, attribute: TableAttribute) {
  if (value === undefined || value === "") return undefined;

  if (attribute.type === "integer") {
    const normalized = value.replace(/,/g, "").trim();
    return normalized ? Number(normalized) : undefined;
  }

  if (attribute.type === "boolean") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    return undefined;
  }

  if (attribute.type === "object") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }

  return value;
}

function coerceEntryValue(value: unknown, attribute: TableAttribute) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;

  if (attribute.type === "integer") {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    const normalized = String(value).replace(/,/g, "").trim();
    return normalized ? Number(normalized) : undefined;
  }

  if (attribute.type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return Boolean(value);
  }

  if (attribute.type === "object") {
    if (typeof value === "object") return value;
    try {
      return JSON.parse(String(value)) as unknown;
    } catch {
      return undefined;
    }
  }

  return String(value);
}

function getNumberedValues(row: CsvRow, prefix: "site" | "note") {
  return Object.fromEntries(
    Array.from({ length: 37 }, (_, index) => {
      const key = `${prefix}${(index + 1).toString().padStart(2, "0")}`;
      return [key, row[key] ?? ""];
    }).filter(([, value]) => value !== "")
  );
}

function numberedObjectToCsv(prefix: "site" | "note", value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Array.from({ length: 37 }, (_, index) => {
      const key = `${prefix}${(index + 1).toString().padStart(2, "0")}`;
      return [key, stringifyEntryValue(source[key])];
    })
  );
}

function getEntryValue(entry: EntryProps, key: string, locale: string) {
  const localized = (entry.fields as Record<string, Record<string, unknown> | undefined>)[key];
  if (!localized) return undefined;
  return localized[locale] ?? Object.values(localized)[0];
}

function stringifyEntryValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function contentfulFieldType(attribute: TableAttribute) {
  if (attribute.type === "integer") return "Integer";
  if (attribute.type === "datetime") return "Date";
  if (attribute.type === "boolean") return "Boolean";
  if (attribute.type === "object") return "Object";
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
