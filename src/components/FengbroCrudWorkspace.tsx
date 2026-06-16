import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { ContentfulCsvPanel } from "./ContentfulCsvPanel";
import { TABLE_SCHEMA_LIST, type TableAttribute } from "../lib/table-schemas";

type ContentfulSettings = {
  spaceId: string;
  environmentId: string;
  managementToken: string;
  locale: string;
};

type CrudRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  published: boolean;
  fields: Record<string, unknown>;
};

type CrudResponse =
  | {
      ok: true;
      items?: CrudRecord[];
      item?: CrudRecord;
      locale: string;
      tableName: string;
      total?: number;
    }
  | { ok: false; message: string };

type MediaUploadKind = "document" | "image" | "music" | "podcast" | "video";

type MediaUploadResponse =
  | {
      ok: true;
      assetId: string;
      contentTypeId: string;
      entryId: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      hash: string;
      locale: string;
      url: string;
    }
  | { ok: false; message: string };

type CommonSiteRow = {
  id: number;
  site: string;
  note: string;
};

type CrudModule = {
  id: string;
  label: string;
  contentType: string;
  description: string;
  group: "main" | "tool";
};

type NavModule =
  | CrudModule
  | {
      id: "tools";
      label: string;
      description: string;
      group: "info";
    };

const MAIN_MODULES: CrudModule[] = [
  {
    id: "subscriptions",
    label: "鋒兄訂閱",
    contentType: "subscription",
    description: "訂閱、續約日、用途、保留建議與封存狀態。"
  },
  {
    id: "foods",
    label: "鋒兄食品（＋商品庫存）",
    contentType: "food",
    description: "食品名稱、數量、價格、商店、到期日與圖片。"
  },
  {
    id: "notes",
    label: "鋒兄筆記",
    contentType: "article",
    description: "筆記、文章、參考連結與附件 metadata。"
  },
  {
    id: "common",
    label: "鋒兄常用",
    contentType: "commonaccount",
    description: "常用站台帳號，以 Object 欄位避開 Contentful 50 欄限制。"
  },
  {
    id: "images",
    label: "鋒兄圖片",
    contentType: "image",
    description: "圖片檔案、分類、封面、hash 與備註。"
  },
  {
    id: "videos",
    label: "鋒兄影片",
    contentType: "video",
    description: "影片檔案、封面、分類、大小與來源。"
  },
  {
    id: "music",
    label: "鋒兄音樂",
    contentType: "music",
    description: "音樂檔案、歌詞、語言、封面與分類。"
  },
  {
    id: "documents",
    label: "鋒兄文件",
    contentType: "commondocument",
    description: "文件檔案、來源、分類、封面與 hash。"
  },
  {
    id: "podcasts",
    label: "鋒兄播客",
    contentType: "podcast",
    description: "播客檔案、封面、分類與來源。"
  },
  {
    id: "bank",
    label: "鋒兄銀行（＋電子票證）",
    contentType: "bank",
    description: "銀行與電子票證餘額、活動、轉帳、提款與卡片資訊。"
  },
  {
    id: "routine",
    label: "鋒兄例行",
    contentType: "routine",
    description: "例行事項、日期、連結、圖片與備註。"
  },
  {
    id: "settings",
    label: "鋒兄設定",
    contentType: "fengbrosetting",
    description: "鋒兄設定值、分類、啟用狀態與備註。"
  },
  {
    id: "about",
    label: "鋒兄關於",
    contentType: "fengbroabout",
    description: "鋒兄關於頁內容、分類、連結與啟用狀態。"
  }
].map((item) => ({ ...item, group: "main" as const }));

const TOOL_MODULES: CrudModule[] = [
  {
    id: "tool-price",
    label: "鋒兄比價",
    contentType: "toolpricehistory",
    description: "一般商品比價、來源、快照日、價格與建議。"
  },
  {
    id: "tool-phone",
    label: "手機比價",
    contentType: "landtophistory",
    description: "手機商品 snapshot、品牌、來源與價格歷史。"
  },
  {
    id: "tool-tube",
    label: "鋒兄Tube",
    contentType: "fengbrotube",
    description: "影片頻道、video ID、分類、發布時間與啟用狀態。"
  },
  {
    id: "tool-finance",
    label: "鋒兄金融",
    contentType: "fengbrofinance",
    description: "金融 watchlist、標的、市場、價格與更新時間。"
  }
].map((item) => ({ ...item, group: "tool" as const }));

const CRUD_MODULES = [...MAIN_MODULES, ...TOOL_MODULES];

const NAV_MODULES: NavModule[] = [
  ...MAIN_MODULES,
  {
    id: "tools",
    label: "鋒兄工具",
    description: "比價、手機比價、Tube、金融工具子項目。",
    group: "info"
  }
];

const FIELD_LABELS: Record<string, string> = {
  account: "帳號",
  activity: "活動",
  address: "地址",
  alternative: "替代方案",
  amount: "數量",
  archived: "封存",
  brand: "品牌",
  card: "卡片",
  category: "分類",
  channel: "頻道",
  content: "內容",
  continue: "續訂",
  cover: "封面",
  currency: "幣別",
  currentPrice: "目前價格",
  deposit: "存款",
  enabled: "啟用",
  file: "檔案",
  fileSize: "檔案大小",
  filetype: "檔案類型",
  friendliness: "友善度",
  hash: "Hash",
  landtopPrice: "藍拓價格",
  language: "語言",
  lastRunAt: "上次執行",
  lastStatus: "上次狀態",
  lastSuccessAt: "上次成功",
  lastUpdatedAt: "更新時間",
  lastdate1: "日期 1",
  lastdate2: "日期 2",
  lastdate3: "日期 3",
  link: "連結",
  lyrics: "歌詞",
  market: "市場",
  method: "方法",
  name: "名稱",
  newDate: "日期",
  nextdate: "下次扣款",
  note: "備註",
  notes: "備註集合",
  photo: "圖片",
  photohash: "圖片 Hash",
  price: "價格",
  productId: "商品 ID",
  publishedAt: "發布時間",
  purpose: "用途",
  ref: "參考",
  retentionRecommendation: "保留建議",
  schedule: "排程",
  settingKey: "設定鍵",
  shop: "商店",
  site: "網址",
  sites: "站台集合",
  snapshotDate: "快照日期",
  snapshotKey: "快照鍵",
  source: "來源",
  sourceUrl: "來源網址",
  suggestedPrice: "建議價格",
  symbol: "代號",
  targetUrl: "目標網址",
  title: "標題",
  todate: "到期日",
  transfer: "轉帳",
  usageFrequency: "使用頻率",
  url: "網址",
  value: "設定值",
  videoId: "影片 ID",
  withdrawals: "提款"
};

const schemaByName = new Map(TABLE_SCHEMA_LIST.map((schema) => [schema.name, schema]));
const COMMON_SITE_ROW_LIMIT = 37;

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function numberedKey(prefix: "note" | "site", index: number) {
  return `${prefix}${(index + 1).toString().padStart(2, "0")}`;
}

function parseObjectField(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function commonSiteRowsFromFields(sitesValue: unknown, notesValue: unknown): CommonSiteRow[] {
  const sites = parseObjectField(sitesValue);
  const notes = parseObjectField(notesValue);
  const rows = Array.from({ length: COMMON_SITE_ROW_LIMIT }, (_, index) => ({
    id: index + 1,
    site: stringifyFieldValue(sites[numberedKey("site", index)]).trim(),
    note: stringifyFieldValue(notes[numberedKey("note", index)]).trim()
  })).filter((row) => row.site || row.note);

  return rows.length > 0 ? rows : [{ id: 1, site: "", note: "" }];
}

function commonSiteRowsToObject(rows: CommonSiteRow[], key: "note" | "site") {
  const entries = rows
    .map((row) => (key === "site" ? row.site : row.note).trim())
    .map((value, index) => [numberedKey(key, index), value] as const)
    .filter(([, value]) => value);

  return Object.fromEntries(entries);
}

function displayCommonCollection(value: unknown, key: "note" | "site") {
  const source = parseObjectField(value);
  const values = Array.from({ length: COMMON_SITE_ROW_LIMIT }, (_, index) =>
    stringifyFieldValue(source[numberedKey(key, index)]).trim()
  ).filter(Boolean);

  if (values.length === 0) return "-";
  const preview = values.slice(0, 2).join("、");
  return `${values.length} 組：${preview}${values.length > 2 ? "..." : ""}`;
}

function nextCommonSiteRowId(rows: CommonSiteRow[]) {
  return Math.max(0, ...rows.map((row) => row.id)) + 1;
}

function isLongField(attribute: TableAttribute) {
  return attribute.type === "object" || (attribute.size ?? 0) > 256;
}

function defaultValue(attribute: TableAttribute) {
  if (attribute.type === "boolean") return attribute.default ?? false;
  if (attribute.type === "object") return "{}";
  return "";
}

function stringifyFieldValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function displayValue(value: unknown) {
  const text = stringifyFieldValue(value).replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text || "-";
}

function isRequiredField(attribute: TableAttribute) {
  return "required" in attribute && Boolean(attribute.required);
}

function recordTitle(record: CrudRecord) {
  const value =
    record.fields.name ??
    record.fields.title ??
    record.fields.snapshotKey ??
    record.fields.symbol ??
    record.id;
  return displayValue(value);
}

function messageClass(ok: boolean) {
  return ok ? "result success" : "result error";
}

function mediaKindForContentType(contentType?: string): MediaUploadKind | null {
  if (contentType === "commondocument") return "document";
  if (contentType === "image" || contentType === "music" || contentType === "podcast" || contentType === "video") {
    return contentType;
  }
  return null;
}

function mediaAccept(kind: MediaUploadKind) {
  if (kind === "image") return "image/*";
  if (kind === "video") return "video/*";
  if (kind === "music" || kind === "podcast") return "audio/*";
  return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,application/*,text/*";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("無法讀取檔案，請重新選擇後再上傳。"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function normalizeMediaUrl(value: unknown) {
  const text = stringifyFieldValue(value).trim();
  if (!text) return null;
  if (text.startsWith("//")) return `https:${text}`;
  if (/^https?:\/\//i.test(text)) return text;
  return null;
}

function mediaActionLabel(contentType: string) {
  if (contentType === "image") return "開啟圖片";
  if (contentType === "video") return "開啟影片";
  if (contentType === "music") return "開啟音樂";
  if (contentType === "podcast") return "開啟播客";
  if (contentType === "commondocument") return "開啟文件";
  return "開啟檔案";
}

function isMediaContentType(contentType?: string) {
  return ["image", "video", "music", "commondocument", "podcast"].includes(contentType ?? "");
}

function toDateInputValue(value: unknown) {
  const text = stringifyFieldValue(value).trim();
  if (!text) return "";
  return text.includes("T") ? text.slice(0, 10) : text;
}

function formatDate(value: unknown) {
  const text = stringifyFieldValue(value).trim();
  if (!text) return "-";
  return text.includes("T") ? text.slice(0, 10) : text;
}

function monthKey(value: unknown) {
  const date = formatDate(value);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

function daysFromToday(value: unknown) {
  const date = formatDate(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const target = new Date(`${date}T00:00:00+08:00`);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - base.getTime()) / 86400000);
}

function formatMoney(record: CrudRecord) {
  const rawPrice = record.fields.price ?? record.fields.deposit ?? record.fields.currentPrice ?? record.fields.landtopPrice;
  const numeric = Number(String(rawPrice ?? "").replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return displayValue(rawPrice);
  const currency = displayValue(record.fields.currency);
  const prefix = currency === "USD" ? "$" : "NT$ ";
  return `${prefix}${numeric.toLocaleString("zh-TW")}`;
}

function recordSearchText(record: CrudRecord) {
  return [record.id, recordTitle(record), ...Object.values(record.fields).map(stringifyFieldValue)]
    .join(" ")
    .toLowerCase();
}

function moduleSummary(module: CrudModule, records: CrudRecord[]) {
  if (module.contentType === "subscription") {
    const continuing = records.filter((record) => Boolean(record.fields.continue)).length;
    return `${records.length} 筆 / 續訂 ${continuing} 筆`;
  }
  if (module.contentType === "food") {
    const amount = records.reduce((total, record) => total + (Number(record.fields.amount) || 0), 0);
    return `${records.length} 筆 / 庫存 ${amount}`;
  }
  if (module.contentType === "bank") {
    const total = records.reduce((sum, record) => sum + (Number(record.fields.deposit) || 0), 0);
    return `${records.length} 筆 / NT$ ${total.toLocaleString("zh-TW")}`;
  }
  return `${records.length} records`;
}

function MediaRecordPreview(props: { contentType: string; record: CrudRecord }) {
  const fileUrl = () => normalizeMediaUrl(props.record.fields.file);
  const coverUrl = () => normalizeMediaUrl(props.record.fields.cover);
  const fileType = () => displayValue(props.record.fields.filetype);
  const title = () => recordTitle(props.record);

  return (
    <div class="record-media-preview">
      <Show when={fileUrl()} fallback={<div class="media-empty">尚未提供可預覽的檔案 URL。</div>}>
        {(url) => (
          <>
            <Show when={props.contentType === "image"}>
              <img src={url()} alt={title()} loading="lazy" />
            </Show>
            <Show when={props.contentType === "video"}>
              <video controls preload="metadata" poster={coverUrl() ?? undefined}>
                <source src={url()} type={fileType() === "-" ? undefined : fileType()} />
              </video>
            </Show>
            <Show when={props.contentType === "music" || props.contentType === "podcast"}>
              <div class="record-audio-preview">
                <Show when={coverUrl()}>{(cover) => <img src={cover()} alt="" loading="lazy" />}</Show>
                <audio controls preload="metadata">
                  <source src={url()} type={fileType() === "-" ? undefined : fileType()} />
                </audio>
              </div>
            </Show>
            <Show when={props.contentType === "commondocument"}>
              <iframe title={title()} src={url()} loading="lazy" />
            </Show>
          </>
        )}
      </Show>
      <div class="record-media-footer">
        <span>{fileType()}</span>
        <Show when={fileUrl()}>
          {(url) => (
            <a href={url()} target="_blank" rel="noreferrer">
              {mediaActionLabel(props.contentType)}
            </a>
          )}
        </Show>
      </div>
    </div>
  );
}

function CommonSitesEditor(props: {
  rows: CommonSiteRow[];
  onChange: (rows: CommonSiteRow[]) => void;
}) {
  function updateRow(id: number, key: "note" | "site", value: string) {
    props.onChange(props.rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    if (props.rows.length >= COMMON_SITE_ROW_LIMIT) return;
    props.onChange([...props.rows, { id: nextCommonSiteRowId(props.rows), site: "", note: "" }]);
  }

  function removeRow(id: number) {
    const nextRows = props.rows.filter((row) => row.id !== id);
    props.onChange(nextRows.length > 0 ? nextRows : [{ id: 1, site: "", note: "" }]);
  }

  function clearRows() {
    props.onChange([{ id: 1, site: "", note: "" }]);
  }

  return (
    <div class="common-sites-editor">
      <div class="common-sites-heading">
        <div>
          <strong>站台集合</strong>
          <p>用表格編輯常用站台與備註，儲存時會自動轉成 Contentful 的 sites / notes 物件。</p>
        </div>
        <div class="common-sites-actions">
          <button class="secondary" disabled={props.rows.length >= COMMON_SITE_ROW_LIMIT} type="button" onClick={addRow}>
            新增站台
          </button>
          <button class="secondary" type="button" onClick={clearRows}>
            清空
          </button>
        </div>
      </div>

      <div class="common-sites-table">
        <div class="common-sites-row common-sites-row-head">
          <span>#</span>
          <span>站台網址</span>
          <span>備註 / 帳號提示</span>
          <span>操作</span>
        </div>
        <For each={props.rows}>
          {(row, index) => (
            <div class="common-sites-row">
              <span class="common-sites-index">{index() + 1}</span>
              <input
                inputMode="url"
                placeholder="https://example.com"
                type="url"
                value={row.site}
                onInput={(event) => updateRow(row.id, "site", event.currentTarget.value)}
              />
              <input
                placeholder="登入方式、帳號、用途..."
                value={row.note}
                onInput={(event) => updateRow(row.id, "note", event.currentTarget.value)}
              />
              <button class="danger" type="button" onClick={() => removeRow(row.id)}>
                移除
              </button>
            </div>
          )}
        </For>
      </div>

      <small>目前 {props.rows.length} / {COMMON_SITE_ROW_LIMIT} 組。空白列不會寫入 Contentful。</small>
    </div>
  );
}

export function FengbroCrudWorkspace(props: { canManage: boolean; settings: ContentfulSettings }) {
  const [activeId, setActiveId] = createSignal(CRUD_MODULES[0].id);
  const [records, setRecords] = createSignal<CrudRecord[]>([]);
  const [draft, setDraft] = createSignal<Record<string, unknown>>({});
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = createSignal(false);
  const [commonSiteRows, setCommonSiteRows] = createSignal<CommonSiteRow[]>([{ id: 1, site: "", note: "" }]);
  const [hasLoadedRecords, setHasLoadedRecords] = createSignal(false);
  const [isEditorOpen, setIsEditorOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("all");
  const [monthFilter, setMonthFilter] = createSignal("all");
  let loadSequence = 0;
  let mediaFormRef: HTMLFormElement | undefined;

  const activeModule = createMemo(() => CRUD_MODULES.find((module) => module.id === activeId()));
  const activeSchema = createMemo(() => schemaByName.get(activeModule()?.contentType ?? ""));
  const activeFields = createMemo(() => activeSchema()?.attributes ?? []);
  const editorFields = createMemo(() =>
    activeModule()?.contentType === "commonaccount"
      ? activeFields().filter((field) => field.key !== "sites" && field.key !== "notes")
      : activeFields()
  );
  const visibleColumns = createMemo(() => {
    const module = activeModule();
    if (module?.contentType === "subscription") return ["account", "price", "nextdate", "continue", "note"];
    if (module?.contentType === "food") return ["amount", "price", "shop", "todate", "photo"];
    if (module?.contentType === "bank") return ["deposit", "withdrawals", "transfer", "card", "account"];
    if (module?.contentType === "fengbrosetting") return ["settingKey", "value", "category", "enabled", "note"];
    if (module?.contentType === "fengbroabout") return ["content", "category", "url", "enabled", "note"];
    return activeFields()
      .filter((field) => field.key !== "name" && field.key !== "title")
      .slice(0, 5)
      .map((field) => field.key);
  });
  const activeMediaKind = createMemo(() => mediaKindForContentType(activeModule()?.contentType));
  const monthOptions = createMemo(() => {
    const months = new Set(
      records()
        .map((record) => monthKey(record.fields.nextdate ?? record.fields.todate ?? record.fields.lastdate1 ?? record.fields.snapshotDate))
        .filter(Boolean)
    );
    return Array.from(months).sort();
  });
  const filteredRecords = createMemo(() => {
    const text = query().trim().toLowerCase();
    const status = statusFilter();
    const month = monthFilter();

    return records().filter((record) => {
      if (text && !recordSearchText(record).includes(text)) return false;
      if (status === "published" && !record.published) return false;
      if (status === "draft" && record.published) return false;
      if (status === "continuing" && !Boolean(record.fields.continue)) return false;
      if (status === "stopped" && Boolean(record.fields.continue)) return false;
      if (month !== "all") {
        const recordMonth = monthKey(record.fields.nextdate ?? record.fields.todate ?? record.fields.lastdate1 ?? record.fields.snapshotDate);
        if (recordMonth !== month) return false;
      }
      return true;
    });
  });
  const autoLoadKey = createMemo(() =>
    [
      activeModule()?.contentType ?? "",
      props.canManage ? "manage" : "readonly",
      props.settings.spaceId,
      props.settings.environmentId,
      props.settings.managementToken ? "token" : "no-token",
      props.settings.locale
    ].join("|")
  );

  createEffect(() => {
    activeId();
    setRecords([]);
    setHasLoadedRecords(false);
    setEditingId(null);
    setIsEditorOpen(false);
    setQuery("");
    setStatusFilter("all");
    setMonthFilter("all");
    resetDraft();
    mediaFormRef?.reset();
    setMessage(null);
  });

  createEffect(() => {
    autoLoadKey();
    if (!props.canManage || !activeModule()) return;
    void loadRecords();
  });

  const settingsPayload = () => ({
    spaceId: props.settings.spaceId,
    environmentId: props.settings.environmentId,
    managementToken: props.settings.managementToken,
    locale: props.settings.locale
  });

  function resetDraft() {
    setDraft(Object.fromEntries(activeFields().map((field) => [field.key, defaultValue(field)])));
    setCommonSiteRows([{ id: 1, site: "", note: "" }]);
  }

  function startCreate() {
    setEditingId(null);
    resetDraft();
    setIsEditorOpen(true);
    setMessage(null);
  }

  function closeEditor() {
    setEditingId(null);
    setIsEditorOpen(false);
    resetDraft();
    setMessage(null);
  }

  function startEdit(record: CrudRecord) {
    setEditingId(record.id);
    setDraft(
      Object.fromEntries(
        activeFields().map((field) => [
          field.key,
          field.type === "boolean"
            ? Boolean(record.fields[field.key])
            : field.type === "datetime"
              ? toDateInputValue(record.fields[field.key])
              : stringifyFieldValue(record.fields[field.key])
        ])
      )
    );
    if (activeModule()?.contentType === "commonaccount") {
      setCommonSiteRows(commonSiteRowsFromFields(record.fields.sites, record.fields.notes));
    }
    setIsEditorOpen(true);
    setMessage(null);
  }

  function duplicateRecord(record: CrudRecord) {
    setEditingId(null);
    setDraft(
      Object.fromEntries(
        activeFields().map((field) => [
          field.key,
          field.type === "boolean"
            ? Boolean(record.fields[field.key])
            : field.type === "datetime"
              ? toDateInputValue(record.fields[field.key])
              : stringifyFieldValue(record.fields[field.key])
        ])
      )
    );
    if (activeModule()?.contentType === "commonaccount") {
      setCommonSiteRows(commonSiteRowsFromFields(record.fields.sites, record.fields.notes));
    }
    setMessage({ ok: true, text: `已複製「${recordTitle(record)}」，調整後可新增為另一筆資料。` });
  }

  function updateDraft(key: string, value: unknown) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function buildValues() {
    const values: Record<string, unknown> = {};

    if (activeModule()?.contentType === "commonaccount") {
      const rows = commonSiteRows().filter((row) => row.site.trim() || row.note.trim());
      values.name = draft().name;
      values.sites = commonSiteRowsToObject(rows, "site");
      values.notes = commonSiteRowsToObject(rows, "note");
      return values;
    }

    for (const field of activeFields()) {
      const value = draft()[field.key];
      if (field.type === "object") {
        if (typeof value !== "string") {
          values[field.key] = value;
          continue;
        }
        const trimmed = value.trim();
        if (!trimmed) continue;
        try {
          values[field.key] = JSON.parse(trimmed);
        } catch {
          throw new Error(`${fieldLabel(field.key)} 必須是有效 JSON。`);
        }
        continue;
      }

      values[field.key] = value;
    }

    return values;
  }

  async function callCrud(action: "create" | "delete" | "list" | "update", extra = {}) {
    const module = activeModule();
    if (!module) throw new Error("尚未選擇資料模組。");

    const response = await fetch("/api/contentful-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        tableName: module.contentType,
        settings: settingsPayload(),
        ...extra
      })
    });
    return (await response.json()) as CrudResponse;
  }

  async function loadRecords() {
    if (!props.canManage) {
      setMessage({ ok: false, text: "請先輸入 Space ID 與 Contentful Management Token。" });
      return;
    }

    const requestId = ++loadSequence;
    setIsLoading(true);
    setHasLoadedRecords(false);
    setMessage(null);
    try {
      const payload = await callCrud("list");
      if (requestId !== loadSequence) return;
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      setRecords(payload.items ?? []);
      setHasLoadedRecords(true);
      setMessage({
        ok: true,
        text: `已載入 ${payload.total ?? payload.items?.length ?? 0} 筆 ${payload.tableName} 資料。Locale: ${payload.locale}`
      });
    } catch (error) {
      if (requestId !== loadSequence) return;
      setMessage({ ok: false, text: error instanceof Error ? error.message : "無法載入資料。" });
    } finally {
      if (requestId === loadSequence) {
        setIsLoading(false);
      }
    }
  }

  async function saveRecord() {
    if (!props.canManage) {
      setMessage({ ok: false, text: "請先輸入 Space ID 與 Contentful Management Token。" });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const values = buildValues();
      const entryId = editingId();
      const payload = await callCrud(entryId ? "update" : "create", { entryId, values });

      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }

      setMessage({
        ok: true,
        text: `${entryId ? "已更新" : "已新增"} ${activeModule()?.label}。Locale: ${payload.locale}`
      });
      setEditingId(null);
      setIsEditorOpen(false);
      resetDraft();
      await loadRecords();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "無法儲存資料。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord(record: CrudRecord) {
    if (!window.confirm(`刪除「${recordTitle(record)}」？`)) return;

    setMessage(null);
    try {
      const payload = await callCrud("delete", { entryId: record.id });
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      setMessage({ ok: true, text: `已刪除「${recordTitle(record)}」。` });
      await loadRecords();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "無法刪除資料。" });
    }
  }

  async function readMediaUploadResponse(response: Response): Promise<MediaUploadResponse> {
    const text = await response.text();
    try {
      return JSON.parse(text) as MediaUploadResponse;
    } catch {
      const trimmed = text.replace(/\s+/g, " ").trim();
      const isHtmlError = /<!doctype html|<html|stormkit\s*-\s*errors/i.test(trimmed);
      const isTooLarge = response.status === 413 || /request entity too large/i.test(trimmed);
      const platformMessage =
        response.status >= 500 && isHtmlError
          ? "部署平台回傳 HTML 錯誤頁，通常是檔案大小或請求限制造成。請改用較小檔案，或先上傳到外部儲存後再填 URL。"
          : null;
      return {
        ok: false,
        message: isTooLarge
          ? "檔案太大，部署平台拒絕這次上傳。請改用較小檔案，或先把檔案上傳到外部儲存後再填 URL。"
          : (platformMessage ??
            `Upload failed with a non-JSON response${response.status ? ` (${response.status})` : ""}: ${(trimmed || response.statusText).slice(0, 260)}`)
      };
    }
  }

  async function uploadMedia(event: SubmitEvent) {
    event.preventDefault();
    const kind = activeMediaKind();
    if (!kind) return;

    if (!props.canManage) {
      setMessage({ ok: false, text: "請先輸入 Space ID 與 Contentful Management Token。" });
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setMessage({ ok: false, text: "請先選擇要上傳的檔案。" });
      return;
    }

    setIsUploadingMedia(true);
    setMessage(null);
    try {
      const fileData = await fileToDataUrl(file);
      const response = await fetch("/api/contentful-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          fileName: file.name,
          contentType: file.type,
          fileData,
          displayName: String(formData.get("displayName") ?? ""),
          category: String(formData.get("category") ?? ""),
          note: String(formData.get("note") ?? ""),
          ref: String(formData.get("ref") ?? ""),
          spaceId: props.settings.spaceId,
          environmentId: props.settings.environmentId,
          locale: props.settings.locale,
          managementToken: props.settings.managementToken
        })
      });
      const payload = await readMediaUploadResponse(response);

      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }

      form.reset();
      setMessage({
        ok: true,
        text: `已上傳 ${payload.fileName}，建立 ${payload.contentTypeId} entry。Asset: ${payload.assetId}，Entry: ${payload.entryId}`
      });
      await loadRecords();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "無法上傳媒體。" });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  return (
    <section class="panel crud-panel" aria-labelledby="crud-title">
      <div class="panel-heading crud-workspace-heading">
        <div>
          <p class="eyebrow dark">Contentful CRUD</p>
          <h2 id="crud-title">FengBro CRUD Workspace</h2>
          <p>對齊 Appwrite 工作台：左側模組、上方篩選、表格列表、列操作與 CSV 匯入匯出。</p>
        </div>
        <div class="toolbar">
          <button class="secondary" type="button" onClick={startCreate}>
            新增資料
          </button>
          <button class="primary" type="button" disabled={isLoading()} onClick={loadRecords}>
            {isLoading() ? "載入中..." : "載入資料"}
          </button>
        </div>
      </div>

      <div class="crud-layout appwrite-like">
        <nav class="module-nav" aria-label="FengBro modules">
          <For each={NAV_MODULES}>
            {(module) => (
              <button
                class={`module-button ${
                  module.id === "tools"
                    ? activeModule()?.group === "tool"
                      ? "active"
                      : ""
                    : activeId() === module.id
                      ? "active"
                      : ""
                }`}
                type="button"
                onClick={() => {
                  if (module.id === "tools") {
                    setActiveId(TOOL_MODULES[0].id);
                    return;
                  }
                  if (module.group === "info") {
                    setActiveId(module.id);
                    return;
                  }
                  setActiveId(module.id);
                }}
              >
                <span class="module-icon" aria-hidden="true">
                  {module.id === "tools" ? "⌘" : module.id === "settings" ? "⚙" : module.id === "about" ? "i" : "▣"}
                </span>
                <span>
                  <strong>{module.label}</strong>
                  <em>{module.description}</em>
                </span>
              </button>
            )}
          </For>
        </nav>

        <div class="crud-content">
          <Show
            when={activeModule()}
            fallback={
              <div class="info-panel">
                <Show
                  when={activeId() === "settings"}
                  fallback={
                    <>
                      <h3>鋒兄關於</h3>
                      <p>
                        這是 SolidStart + Contentful 版本的鋒兄資料工作台，保留 Appwrite CSV
                        欄位格式，並用 Contentful Content Type 作為資料表。
                      </p>
                    </>
                  }
                >
                  <h3>鋒兄設定</h3>
                  <p>
                    Space ID、Environment、Locale、Delivery Token 與 Management Token
                    請在下方 Contentful Connection Settings 設定；CRUD 工作區會共用同一組連線參數。
                  </p>
                </Show>
              </div>
            }
          >
            {(module) => (
              <>
                <Show when={module().group === "tool"}>
                  <div class="tool-tabs compact-tabs">
                    <For each={TOOL_MODULES}>
                      {(tool) => (
                        <button class={activeId() === tool.id ? "active" : ""} type="button" onClick={() => setActiveId(tool.id)}>
                          {tool.label}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="crud-header appwrite-header">
                  <div>
                    <h3>{module().label}</h3>
                    <p>{module().description}</p>
                    <small>Content type: {module().contentType}</small>
                  </div>
                  <span class="badge neutral">{moduleSummary(module(), records())}</span>
                </div>

                <div class="filter-bar">
                  <div class="quick-filters">
                    <button class={statusFilter() === "all" ? "active" : ""} type="button" onClick={() => setStatusFilter("all")}>
                      全部
                    </button>
                    <button
                      class={statusFilter() === "published" ? "active" : ""}
                      type="button"
                      onClick={() => setStatusFilter("published")}
                    >
                      已發布
                    </button>
                    <button class={statusFilter() === "draft" ? "active" : ""} type="button" onClick={() => setStatusFilter("draft")}>
                      草稿
                    </button>
                    <Show when={module().contentType === "subscription"}>
                      <>
                        <button
                          class={statusFilter() === "continuing" ? "active" : ""}
                          type="button"
                          onClick={() => setStatusFilter("continuing")}
                        >
                          續訂中
                        </button>
                        <button
                          class={statusFilter() === "stopped" ? "active" : ""}
                          type="button"
                          onClick={() => setStatusFilter("stopped")}
                        >
                          不續訂
                        </button>
                      </>
                    </Show>
                  </div>
                  <div class="advanced-filters">
                    <input
                      aria-label="搜尋資料"
                      placeholder="搜尋名稱、帳號、備註或網址"
                      value={query()}
                      onInput={(event) => setQuery(event.currentTarget.value)}
                    />
                    <select aria-label="月份篩選" value={monthFilter()} onChange={(event) => setMonthFilter(event.currentTarget.value)}>
                      <option value="all">全部月份</option>
                      <For each={monthOptions()}>{(month) => <option value={month}>{month}</option>}</For>
                    </select>
                    <button
                      class="secondary"
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("all");
                        setMonthFilter("all");
                      }}
                    >
                      清除篩選
                    </button>
                  </div>
                </div>

                <Show when={message()}>
                  {(current) => (
                    <div class={messageClass(current().ok)} role="status">
                      <p>{current().text}</p>
                    </div>
                  )}
                </Show>

                <Show when={activeMediaKind()}>
                  {(kind) => (
                    <form ref={mediaFormRef} class="media-upload-panel" onSubmit={uploadMedia}>
                      <div>
                        <h4>上傳{module().label}</h4>
                        <p>建立 Contentful Asset，並同步建立 {module().contentType} entry，填入檔案 URL、hash 與備註。</p>
                      </div>
                      <div class="media-upload-grid">
                        <label>
                          <span>檔案</span>
                          <input accept={mediaAccept(kind())} name="file" required type="file" />
                        </label>
                        <label>
                          <span>名稱</span>
                          <input name="displayName" placeholder="預設使用檔名" />
                        </label>
                        <label>
                          <span>分類</span>
                          <input name="category" placeholder="category" />
                        </label>
                        <label>
                          <span>來源 / Ref</span>
                          <input name="ref" placeholder="optional source URL or note" />
                        </label>
                        <label class="wide-field">
                          <span>備註</span>
                          <textarea name="note" rows={3} />
                        </label>
                      </div>
                      <button class="primary" disabled={isUploadingMedia()} type="submit">
                        {isUploadingMedia() ? "上傳中..." : `上傳${module().label}`}
                      </button>
                    </form>
                  )}
                </Show>

                <div class="editor-toggle-panel">
                  <div>
                    <h4>{editingId() ? "編輯資料" : "新增資料"}</h4>
                    <p>
                      {isEditorOpen()
                        ? "資料表單已展開，填寫完成後可建立或更新資料。"
                        : "新增/編輯資料預設收合，展開後才顯示各欄位。"}
                    </p>
                  </div>
                  <button class={isEditorOpen() ? "secondary" : "primary"} type="button" onClick={isEditorOpen() ? closeEditor : startCreate}>
                    {isEditorOpen() ? "收合表單" : "展開新增資料"}
                  </button>
                </div>

                <div class="workspace-grid appwrite-workspace-grid">
                  <div class="records-panel">
                    <Show
                      when={filteredRecords().length > 0}
                      fallback={
                        <div class="empty-state">
                          <Show
                            when={!isLoading()}
                            fallback={<p>正在從 Contentful 載入資料...</p>}
                          >
                            <p>
                              <Show
                                when={hasLoadedRecords() && records().length === 0}
                                fallback="目前篩選條件沒有符合的 Contentful entries。"
                              >
                                Contentful 目前是 0 筆資料。請先用下方 CSV import 匯入，或確認資料是否在同一個 Space / Environment / Content type。
                              </Show>
                            </p>
                          </Show>
                        </div>
                      }
                    >
                      <div class="record-table-wrap">
                        <table class="record-table appwrite-record-table">
                          <thead>
                            <tr>
                              <th class="select-col">選取</th>
                              <th>服務</th>
                              <For each={visibleColumns()}>{(field) => <th>{fieldLabel(field)}</th>}</For>
                              <th>狀態</th>
                              <th class="actions-col">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={filteredRecords()}>
                              {(record) => (
                                <>
                                  <tr>
                                    <td class="select-col">
                                      <input aria-label={`選取 ${recordTitle(record)}`} type="checkbox" />
                                    </td>
                                    <td>
                                      <strong>
                                        <Show
                                          when={normalizeMediaUrl(record.fields.site ?? record.fields.sourceUrl ?? record.fields.file ?? record.fields.url)}
                                          fallback={recordTitle(record)}
                                        >
                                          {(url) => (
                                            <a href={url()} target="_blank" rel="noreferrer">
                                              {recordTitle(record)}
                                            </a>
                                          )}
                                        </Show>
                                      </strong>
                                      <small>{record.id}</small>
                                    </td>
                                    <For each={visibleColumns()}>
                                      {(field) => (
                                        <td>
                                          <Show
                                            when={field === "price" || field === "deposit" || field === "currentPrice" || field === "landtopPrice"}
                                            fallback={
                                              <Show
                                                when={field === "nextdate" || field === "todate" || field === "lastdate1" || field === "snapshotDate"}
                                                fallback={
                                                  <Show
                                                    when={field === "continue" || field === "enabled" || field === "archived"}
                                                    fallback={
                                                      field === "sites"
                                                        ? displayCommonCollection(record.fields[field], "site")
                                                        : field === "notes"
                                                          ? displayCommonCollection(record.fields[field], "note")
                                                          : displayValue(record.fields[field])
                                                    }
                                                  >
                                                    <span class={`status-chip ${Boolean(record.fields[field]) ? "on" : "off"}`}>
                                                      {Boolean(record.fields[field]) ? "是" : "否"}
                                                    </span>
                                                  </Show>
                                                }
                                              >
                                                <span>{formatDate(record.fields[field])}</span>
                                                <Show when={daysFromToday(record.fields[field]) !== null}>
                                                  <small class="date-diff">{daysFromToday(record.fields[field])} 天後</small>
                                                </Show>
                                              </Show>
                                            }
                                          >
                                            {formatMoney(record)}
                                          </Show>
                                        </td>
                                      )}
                                    </For>
                                    <td>
                                      <span class={`status-chip ${record.published ? "on" : "off"}`}>{record.published ? "已發布" : "草稿"}</span>
                                    </td>
                                    <td>
                                      <div class="row-actions icon-actions">
                                        <button class="secondary" type="button" title="編輯" onClick={() => startEdit(record)}>
                                          編輯
                                        </button>
                                        <button class="secondary" type="button" title="複製" onClick={() => duplicateRecord(record)}>
                                          複製
                                        </button>
                                        <button class="danger" type="button" title="刪除" onClick={() => deleteRecord(record)}>
                                          刪除
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  <Show when={isMediaContentType(activeModule()?.contentType)}>
                                    <tr class="media-preview-row">
                                      <td colSpan={visibleColumns().length + 4}>
                                        <MediaRecordPreview contentType={activeModule()?.contentType ?? ""} record={record} />
                                      </td>
                                    </tr>
                                  </Show>
                                </>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Show>
                  </div>

                  <form
                    class={`editor-panel ${isEditorOpen() ? "" : "collapsed"}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRecord();
                    }}
                  >
                    <div class="editor-heading">
                      <h4>{editingId() ? "編輯資料" : "新增資料"}</h4>
                      <button class="secondary" type="button" onClick={closeEditor}>
                        收合
                      </button>
                      <Show when={editingId()}>
                        <button class="secondary" type="button" onClick={startCreate}>
                          取消編輯
                        </button>
                      </Show>
                    </div>

                    <For each={editorFields()}>
                      {(field) => (
                        <label class={isLongField(field) ? "wide-field" : ""}>
                          <span>
                            {fieldLabel(field.key)}
                            <Show when={isRequiredField(field)}> *</Show>
                          </span>
                          <Show
                            when={field.type === "boolean"}
                            fallback={
                              <Show
                                when={isLongField(field)}
                                fallback={
                                  <input
                                    type={field.type === "integer" ? "number" : field.type === "datetime" ? "date" : "text"}
                                    value={String(draft()[field.key] ?? "")}
                                    onInput={(event) => updateDraft(field.key, event.currentTarget.value)}
                                  />
                                }
                              >
                                <textarea
                                  rows={field.type === "object" ? 7 : 4}
                                  value={String(draft()[field.key] ?? "")}
                                  onInput={(event) => updateDraft(field.key, event.currentTarget.value)}
                                />
                              </Show>
                            }
                          >
                            <label class="inline-check">
                              <input
                                type="checkbox"
                                checked={Boolean(draft()[field.key])}
                                onInput={(event) => updateDraft(field.key, event.currentTarget.checked)}
                              />
                              <span>啟用</span>
                            </label>
                          </Show>
                        </label>
                      )}
                    </For>

                    <Show when={activeModule()?.contentType === "commonaccount"}>
                      <CommonSitesEditor rows={commonSiteRows()} onChange={setCommonSiteRows} />
                    </Show>

                    <button class="primary" type="submit" disabled={isSaving()}>
                      {isSaving() ? "儲存中..." : editingId() ? "儲存更新" : "建立資料"}
                    </button>
                  </form>
                </div>

                <ContentfulCsvPanel
                  canManage={props.canManage}
                  onImported={loadRecords}
                  settings={settingsPayload()}
                  tableName={module().contentType}
                />
              </>
            )}
          </Show>
        </div>
      </div>
    </section>
  );
}
