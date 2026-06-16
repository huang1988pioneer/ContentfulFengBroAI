export type TableAttributeType = "string" | "integer" | "url" | "datetime" | "boolean" | "object";

export type TableAttribute = {
  key: string;
  type: TableAttributeType;
  size?: number;
  required?: boolean;
  default?: boolean;
};

export type TableSchema = {
  name: string;
  title: string;
  description: string;
  attributes: TableAttribute[];
};

export const TABLE_SCHEMAS = {
  commonaccount: {
    name: "commonaccount",
    title: "Common Account",
    description: "Shared account records adapted for Contentful field limits.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "sites", type: "object" },
      { key: "notes", type: "object" }
    ]
  },
  bank: {
    name: "bank",
    title: "Bank",
    description: "Bank account and transfer information.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "deposit", type: "integer" },
      { key: "site", type: "url" },
      { key: "address", type: "string", size: 100 },
      { key: "withdrawals", type: "integer" },
      { key: "transfer", type: "integer" },
      { key: "activity", type: "url" },
      { key: "card", type: "string", size: 100 },
      { key: "account", type: "string", size: 100 }
    ]
  },
  article: {
    name: "article",
    title: "Article",
    description: "Article, notes, references, links, and attached file metadata.",
    attributes: [
      { key: "title", type: "string", size: 100 },
      { key: "content", type: "string", size: 3377 },
      { key: "category", type: "string", size: 100 },
      { key: "ref", type: "string", size: 100 },
      { key: "newDate", type: "datetime" },
      { key: "url1", type: "url" },
      { key: "url2", type: "url" },
      { key: "url3", type: "url" },
      { key: "file1", type: "string", size: 150 },
      { key: "file1name", type: "string", size: 100 },
      { key: "file1type", type: "string", size: 20 },
      { key: "file2", type: "string", size: 150 },
      { key: "file2name", type: "string", size: 100 },
      { key: "file2type", type: "string", size: 20 },
      { key: "file3", type: "string", size: 150 },
      { key: "file3name", type: "string", size: 100 },
      { key: "file3type", type: "string", size: 20 }
    ]
  },
  food: {
    name: "food",
    title: "Food",
    description: "Food inventory records.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "amount", type: "integer" },
      { key: "price", type: "integer" },
      { key: "shop", type: "string", size: 100 },
      { key: "todate", type: "datetime" },
      { key: "photo", type: "url" },
      { key: "photohash", type: "string", size: 256 }
    ]
  },
  subscription: {
    name: "subscription",
    title: "Subscription",
    description: "Subscription and renewal tracking.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "site", type: "url" },
      { key: "price", type: "integer" },
      { key: "nextdate", type: "datetime" },
      { key: "note", type: "string", size: 3337 },
      { key: "account", type: "string", size: 100 },
      { key: "currency", type: "string", size: 100 },
      { key: "continue", type: "boolean", default: true },
      { key: "category", type: "string", size: 100 },
      { key: "purpose", type: "string", size: 100 },
      { key: "usageFrequency", type: "string", size: 50 },
      { key: "friendliness", type: "string", size: 50 },
      { key: "alternative", type: "string", size: 200 },
      { key: "retentionRecommendation", type: "string", size: 50 },
      { key: "archived", type: "boolean", default: false }
    ]
  },
  image: {
    name: "image",
    title: "Image",
    description: "Image file metadata.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "file", type: "string", size: 500 },
      { key: "filetype", type: "string", size: 20 },
      { key: "note", type: "string", size: 500 },
      { key: "ref", type: "string", size: 300 },
      { key: "category", type: "string", size: 100 },
      { key: "hash", type: "string", size: 300 },
      { key: "cover", type: "boolean", default: false }
    ]
  },
  video: {
    name: "video",
    title: "Video",
    description: "Video file metadata.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "file", type: "string", size: 500 },
      { key: "filetype", type: "string", size: 20 },
      { key: "note", type: "string", size: 500 },
      { key: "ref", type: "string", size: 300 },
      { key: "category", type: "string", size: 100 },
      { key: "hash", type: "string", size: 300 },
      { key: "cover", type: "string", size: 500 },
      { key: "fileSize", type: "integer" }
    ]
  },
  music: {
    name: "music",
    title: "Music",
    description: "Music file metadata and lyrics.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "file", type: "string", size: 500 },
      { key: "filetype", type: "string", size: 20 },
      { key: "lyrics", type: "string", size: 3337 },
      { key: "note", type: "string", size: 500 },
      { key: "ref", type: "string", size: 300 },
      { key: "category", type: "string", size: 100 },
      { key: "hash", type: "string", size: 300 },
      { key: "language", type: "string", size: 100 },
      { key: "cover", type: "string", size: 500 }
    ]
  },
  podcast: {
    name: "podcast",
    title: "Podcast",
    description: "Podcast file metadata.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "file", type: "string", size: 500 },
      { key: "filetype", type: "string", size: 20 },
      { key: "note", type: "string", size: 500 },
      { key: "ref", type: "string", size: 300 },
      { key: "category", type: "string", size: 100 },
      { key: "hash", type: "string", size: 300 },
      { key: "cover", type: "string", size: 500 }
    ]
  },
  commondocument: {
    name: "commondocument",
    title: "Common Document",
    description: "Document file metadata.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "file", type: "string", size: 500 },
      { key: "filetype", type: "string", size: 20 },
      { key: "note", type: "string", size: 500 },
      { key: "ref", type: "string", size: 300 },
      { key: "category", type: "string", size: 100 },
      { key: "hash", type: "string", size: 300 },
      { key: "cover", type: "string", size: 500 }
    ]
  },
  routine: {
    name: "routine",
    title: "Routine",
    description: "Routine and recurring task tracking.",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "note", type: "string", size: 100 },
      { key: "lastdate1", type: "datetime" },
      { key: "lastdate2", type: "datetime" },
      { key: "lastdate3", type: "datetime" },
      { key: "link", type: "url" },
      { key: "photo", type: "url" }
    ]
  },
  landtophistory: {
    name: "landtophistory",
    title: "Landtop History",
    description: "Snapshot history records aligned with the fengbroaiappwrite table initializer.",
    attributes: [
      { key: "source", type: "string", size: 20, required: true },
      { key: "snapshotKey", type: "string", size: 220, required: true },
      { key: "productId", type: "string", size: 180, required: true },
      { key: "brand", type: "string", size: 20, required: true },
      { key: "name", type: "string", size: 200, required: true },
      { key: "sourceUrl", type: "url" },
      { key: "landtopPrice", type: "integer" },
      { key: "suggestedPrice", type: "integer" },
      { key: "snapshotDate", type: "datetime", required: true }
    ]
  },
  toolpricehistory: {
    name: "toolpricehistory",
    title: "Tool Price History",
    description: "FengBro price comparison snapshots for general products.",
    attributes: [
      { key: "name", type: "string", size: 200, required: true },
      { key: "source", type: "string", size: 80 },
      { key: "sourceUrl", type: "url" },
      { key: "currentPrice", type: "integer" },
      { key: "suggestedPrice", type: "integer" },
      { key: "currency", type: "string", size: 20 },
      { key: "snapshotDate", type: "datetime" },
      { key: "note", type: "string", size: 500 }
    ]
  },
  fengbrotube: {
    name: "fengbrotube",
    title: "FengBro Tube",
    description: "FengBro Tube channels, video links, and publishing notes.",
    attributes: [
      { key: "name", type: "string", size: 200, required: true },
      { key: "channel", type: "string", size: 160 },
      { key: "videoId", type: "string", size: 120 },
      { key: "sourceUrl", type: "url" },
      { key: "category", type: "string", size: 100 },
      { key: "publishedAt", type: "datetime" },
      { key: "note", type: "string", size: 1000 },
      { key: "enabled", type: "boolean", default: true }
    ]
  },
  fengbrofinance: {
    name: "fengbrofinance",
    title: "FengBro Finance",
    description: "FengBro finance watchlist records and market snapshots.",
    attributes: [
      { key: "name", type: "string", size: 160, required: true },
      { key: "symbol", type: "string", size: 40 },
      { key: "market", type: "string", size: 80 },
      { key: "sourceUrl", type: "url" },
      { key: "price", type: "integer" },
      { key: "currency", type: "string", size: 20 },
      { key: "lastUpdatedAt", type: "datetime" },
      { key: "note", type: "string", size: 1000 },
      { key: "enabled", type: "boolean", default: true }
    ]
  },
  croncontentful: {
    name: "croncontentful",
    title: "Cron Contentful",
    description: "Cron targets and run metadata for Contentful-related scheduled jobs.",
    attributes: [
      { key: "name", type: "string", size: 120, required: true },
      { key: "targetUrl", type: "url", required: true },
      { key: "method", type: "string", size: 10 },
      { key: "schedule", type: "string", size: 120 },
      { key: "contentType", type: "string", size: 120 },
      { key: "locale", type: "string", size: 50 },
      { key: "enabled", type: "boolean", default: true },
      { key: "lastStatus", type: "string", size: 50 },
      { key: "lastRunAt", type: "datetime" },
      { key: "lastSuccessAt", type: "datetime" },
      { key: "note", type: "string", size: 500 }
    ]
  },
  fengbrosetting: {
    name: "fengbrosetting",
    title: "FengBro Setting",
    description: "FengBro application settings and preference records.",
    attributes: [
      { key: "name", type: "string", size: 120, required: true },
      { key: "settingKey", type: "string", size: 120 },
      { key: "value", type: "string", size: 2000 },
      { key: "category", type: "string", size: 100 },
      { key: "enabled", type: "boolean", default: true },
      { key: "note", type: "string", size: 1000 }
    ]
  },
  fengbroabout: {
    name: "fengbroabout",
    title: "FengBro About",
    description: "FengBro about pages, links, and descriptive content.",
    attributes: [
      { key: "title", type: "string", size: 160, required: true },
      { key: "content", type: "string", size: 4000 },
      { key: "category", type: "string", size: 100 },
      { key: "url", type: "url" },
      { key: "enabled", type: "boolean", default: true },
      { key: "note", type: "string", size: 1000 }
    ]
  }
} satisfies Record<string, TableSchema>;

export const TABLE_SCHEMA_LIST: TableSchema[] = Object.values(TABLE_SCHEMAS);
