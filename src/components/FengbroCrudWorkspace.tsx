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
      id: "about" | "settings" | "tools";
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
    description: "文件檔案、類型、分類、封面與 hash。"
  },
  {
    id: "podcasts",
    label: "鋒兄播客",
    contentType: "podcast",
    description: "播客檔案、封面、分類與來源。"
  },
  {
    id: "bank",
    label: "鋒兄銀行 (+電子票證)",
    contentType: "bank",
    description: "銀行、電子票證、帳號、提款、轉帳與活動連結。"
  },
  {
    id: "routine",
    label: "鋒兄例行",
    contentType: "routine",
    description: "例行事項、日期、連結、圖片與備註。"
  }
].map((item) => ({ ...item, group: "main" as const }));

const TOOL_MODULES: CrudModule[] = [
  {
    id: "tool-price",
    label: "鋒兄比價",
    contentType: "toolpricehistory",
    description: "一般商品比價快照、來源、價格與日期。"
  },
  {
    id: "tool-phone",
    label: "手機比價",
    contentType: "landtophistory",
    description: "手機商品 snapshot、品牌、來源網址與價格。"
  },
  {
    id: "tool-tube",
    label: "鋒兄Tube",
    contentType: "fengbrotube",
    description: "影片頻道、影片 ID、來源網址、分類與發布日期。"
  },
  {
    id: "tool-finance",
    label: "鋒兄金融",
    contentType: "fengbrofinance",
    description: "金融 watchlist、代號、市場、價格與更新時間。"
  }
].map((item) => ({ ...item, group: "tool" as const }));

const CRUD_MODULES = [...MAIN_MODULES, ...TOOL_MODULES];

const NAV_MODULES: NavModule[] = [
  ...MAIN_MODULES,
  {
    id: "tools",
    label: "鋒兄工具",
    description: "比價、手機比價、Tube、金融等工具子項目。",
    group: "info"
  },
  {
    id: "settings",
    label: "鋒兄設定",
    description: "使用上方 Contentful 設定區管理 Space、Token、Locale。",
    group: "info"
  },
  {
    id: "about",
    label: "鋒兄關於",
    description: "SolidStart + Contentful 的鋒兄資料工作台。",
    group: "info"
  }
];

const schemaByName = new Map(TABLE_SCHEMA_LIST.map((schema) => [schema.name, schema]));

function fieldLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
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
  return text.length > 90 ? `${text.slice(0, 90)}...` : text || "-";
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
  if (
    contentType === "image" ||
    contentType === "music" ||
    contentType === "podcast" ||
    contentType === "video"
  ) {
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

function normalizeMediaUrl(value: unknown) {
  const text = stringifyFieldValue(value).trim();
  if (!text) return null;
  if (text.startsWith("//")) return `https:${text}`;
  if (/^https?:\/\//i.test(text)) return text;
  return null;
}

function mediaActionLabel(contentType: string) {
  if (contentType === "image") return "顯示圖片";
  if (contentType === "video") return "播放影片";
  if (contentType === "music") return "播放音樂";
  if (contentType === "podcast") return "播放播客";
  if (contentType === "commondocument") return "預覽文件";
  return "開啟檔案";
}

function isMediaContentType(contentType?: string) {
  return ["image", "video", "music", "commondocument", "podcast"].includes(contentType ?? "");
}

function MediaRecordPreview(props: { contentType: string; record: CrudRecord }) {
  const fileUrl = () => normalizeMediaUrl(props.record.fields.file);
  const coverUrl = () => normalizeMediaUrl(props.record.fields.cover);
  const fileType = () => displayValue(props.record.fields.filetype);
  const title = () => recordTitle(props.record);

  return (
    <div class="record-media-preview">
      <Show when={fileUrl()} fallback={<div class="media-empty">尚未提供可預覽的檔案網址</div>}>
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
                <Show when={coverUrl()}>
                  {(cover) => <img src={cover()} alt="" loading="lazy" />}
                </Show>
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

export function FengbroCrudWorkspace(props: {
  canManage: boolean;
  settings: ContentfulSettings;
}) {
  const [activeId, setActiveId] = createSignal(CRUD_MODULES[0].id);
  const [records, setRecords] = createSignal<CrudRecord[]>([]);
  const [draft, setDraft] = createSignal<Record<string, unknown>>({});
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = createSignal(false);

  const activeModule = createMemo(() => CRUD_MODULES.find((module) => module.id === activeId()));
  const activeSchema = createMemo(() => schemaByName.get(activeModule()?.contentType ?? ""));
  const activeFields = createMemo(() => activeSchema()?.attributes ?? []);
  const visibleColumns = createMemo(() => activeFields().slice(0, 4));
  const activeMediaKind = createMemo(() => mediaKindForContentType(activeModule()?.contentType));

  createEffect(() => {
    activeId();
    setRecords([]);
    setEditingId(null);
    resetDraft();
    setMessage(null);
  });

  const settingsPayload = () => ({
    spaceId: props.settings.spaceId,
    environmentId: props.settings.environmentId,
    managementToken: props.settings.managementToken,
    locale: props.settings.locale
  });

  function resetDraft() {
    setDraft(Object.fromEntries(activeFields().map((field) => [field.key, defaultValue(field)])));
  }

  function startCreate() {
    setEditingId(null);
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
            : stringifyFieldValue(record.fields[field.key])
        ])
      )
    );
    setMessage(null);
  }

  function updateDraft(key: string, value: unknown) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function buildValues() {
    const values: Record<string, unknown> = {};

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
          throw new Error(`${fieldLabel(field.key)} must be valid JSON.`);
        }
        continue;
      }

      values[field.key] = value;
    }

    return values;
  }

  async function callCrud(action: "create" | "delete" | "list" | "update", extra = {}) {
    const module = activeModule();
    if (!module) throw new Error("No active module selected.");

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
      setMessage({ ok: false, text: "請先填入 Space ID 與 Contentful Management Token。" });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const payload = await callCrud("list");
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      setRecords(payload.items ?? []);
      setMessage({
        ok: true,
        text: `Loaded ${payload.total ?? payload.items?.length ?? 0} records from ${payload.tableName}. Locale: ${payload.locale}`
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to load records." });
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRecord() {
    if (!props.canManage) {
      setMessage({ ok: false, text: "請先填入 Space ID 與 Contentful Management Token。" });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const values = buildValues();
      const entryId = editingId();
      const payload = await callCrud(entryId ? "update" : "create", {
        entryId,
        values
      });

      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }

      setMessage({
        ok: true,
        text: `${entryId ? "Updated" : "Created"} ${activeModule()?.label}. Locale: ${payload.locale}`
      });
      setEditingId(null);
      resetDraft();
      await loadRecords();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save record." });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord(record: CrudRecord) {
    if (!window.confirm(`Delete ${recordTitle(record)}?`)) return;

    setMessage(null);
    try {
      const payload = await callCrud("delete", { entryId: record.id });
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      setMessage({ ok: true, text: `Deleted ${recordTitle(record)}.` });
      await loadRecords();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to delete record." });
    }
  }

  async function uploadMedia(event: SubmitEvent) {
    event.preventDefault();
    const kind = activeMediaKind();
    if (!kind) return;

    if (!props.canManage) {
      setMessage({ ok: false, text: "請先填入 Space ID 與 Contentful Management Token。" });
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    formData.set("kind", kind);
    formData.set("spaceId", props.settings.spaceId);
    formData.set("environmentId", props.settings.environmentId);
    formData.set("locale", props.settings.locale);
    formData.set("managementToken", props.settings.managementToken);

    setIsUploadingMedia(true);
    setMessage(null);
    try {
      const response = await fetch("/api/contentful-upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as MediaUploadResponse;

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
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to upload media." });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  return (
    <section class="panel crud-panel" aria-labelledby="crud-title">
      <div class="panel-heading">
        <div>
          <h2 id="crud-title">FengBro CRUD Workspace</h2>
          <p>
            使用 SolidStart 直接管理 Contentful entries；模組與欄位參考 fengbroaiappwrite 的 Table 架構。
          </p>
        </div>
        <div class="toolbar">
          <button class="secondary" type="button" onClick={startCreate}>
            新增
          </button>
          <button class="primary" type="button" disabled={isLoading()} onClick={loadRecords}>
            {isLoading() ? "載入中..." : "載入資料"}
          </button>
        </div>
      </div>

      <div class="crud-layout">
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
                <strong>{module.label}</strong>
                <span>{module.description}</span>
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
                        此專案選型為 SolidStart，資料層使用 Contentful Delivery API 與
                        Management API。先初始化 Table，再進入各模組 CRUD。
                      </p>
                    </>
                  }
                >
                  <h3>鋒兄設定</h3>
                  <p>
                    Space ID、Environment、Locale、Delivery Token 與 Management Token
                    請在上方設定區管理。欄位留空時會改讀部署平台的 environment variables。
                  </p>
                </Show>
              </div>
            }
          >
            {(module) => (
              <>
                <Show when={module().group === "tool"}>
                  <div class="tool-tabs">
                    <For each={TOOL_MODULES}>
                      {(tool) => (
                        <button
                          class={activeId() === tool.id ? "active" : ""}
                          type="button"
                          onClick={() => setActiveId(tool.id)}
                        >
                          {tool.label}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="crud-header">
                  <div>
                    <h3>{module().label}</h3>
                    <p>{module().description}</p>
                    <small>Content type: {module().contentType}</small>
                  </div>
                  <span class="badge neutral">{records().length} records</span>
                </div>

                <Show when={message()}>
                  {(current) => (
                    <div class={messageClass(current().ok)} role="status">
                      <p>{current().text}</p>
                    </div>
                  )}
                </Show>

                <ContentfulCsvPanel
                  canManage={props.canManage}
                  settings={settingsPayload()}
                  tableName={module().contentType}
                />

                <Show when={activeMediaKind()}>
                  {(kind) => (
                    <form class="media-upload-panel" onSubmit={uploadMedia}>
                      <div>
                        <h4>上傳{module().label}</h4>
                        <p>
                          會先建立 Contentful Asset，再建立 {module().contentType} entry 並寫入檔案 URL、類型、hash、分類與備註。
                        </p>
                      </div>
                      <div class="media-upload-grid">
                        <label>
                          <span>檔案</span>
                          <input accept={mediaAccept(kind())} name="file" required type="file" />
                        </label>
                        <label>
                          <span>名稱</span>
                          <input name="displayName" placeholder="留空使用檔名" />
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

                <div class="workspace-grid">
                  <div class="records-panel">
                    <Show
                      when={records().length > 0}
                      fallback={
                        <div class="empty-state">
                          <p>尚未載入資料，或這個 Contentful content type 目前沒有 entries。</p>
                        </div>
                      }
                    >
                      <div class="record-table-wrap">
                        <table class="record-table">
                          <thead>
                            <tr>
                              <th>Entry</th>
                              <For each={visibleColumns()}>
                                {(field) => <th>{fieldLabel(field.key)}</th>}
                              </For>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={records()}>
                              {(record) => (
                                <>
                                <tr>
                                  <td>
                                    <strong>{recordTitle(record)}</strong>
                                    <small>{record.id}</small>
                                  </td>
                                  <For each={visibleColumns()}>
                                    {(field) => <td>{displayValue(record.fields[field.key])}</td>}
                                  </For>
                                  <td>{record.published ? "published" : "draft"}</td>
                                  <td>
                                    <div class="row-actions">
                                      <button class="secondary" type="button" onClick={() => startEdit(record)}>
                                        編輯
                                      </button>
                                      <button class="danger" type="button" onClick={() => deleteRecord(record)}>
                                        刪除
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                  <Show when={isMediaContentType(activeModule()?.contentType)}>
                                    <tr class="media-preview-row">
                                      <td colSpan={visibleColumns().length + 3}>
                                        <MediaRecordPreview
                                          contentType={activeModule()?.contentType ?? ""}
                                          record={record}
                                        />
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
                    class="editor-panel"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRecord();
                    }}
                  >
                    <div class="editor-heading">
                      <h4>{editingId() ? "編輯資料" : "新增資料"}</h4>
                      <Show when={editingId()}>
                        <button class="secondary" type="button" onClick={startCreate}>
                          取消編輯
                        </button>
                      </Show>
                    </div>

                    <For each={activeFields()}>
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
                                    type={field.type === "integer" ? "number" : "text"}
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
                              <span>enabled</span>
                            </label>
                          </Show>
                        </label>
                      )}
                    </For>

                    <button class="primary" type="submit" disabled={isSaving()}>
                      {isSaving() ? "儲存中..." : editingId() ? "更新" : "建立"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </Show>
        </div>
      </div>
    </section>
  );
}
