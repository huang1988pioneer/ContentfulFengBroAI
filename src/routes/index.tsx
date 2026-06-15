import { createEffect, createSignal, For, onMount, Show } from "solid-js";

type ContentfulSettings = {
  spaceId: string;
  environmentId: string;
  deliveryToken: string;
  previewToken: string;
  managementToken: string;
  locale: string;
  usePreview: boolean;
};

type TestSuccess = {
  ok: true;
  mode: string;
  spaceId: string;
  environmentId: string;
  locale: string;
  localeFallback: boolean;
  total: number;
  itemCount: number;
  firstEntryTitle: string | null;
  checkedAt: string;
};

type TestFailure = {
  ok: false;
  message: string;
  locale?: string;
  localeFallback?: boolean;
  status?: number;
};

type TestResult = TestSuccess | TestFailure;

type TableStatus = {
  id: string;
  title: string;
  expectedFields: number;
  actualFields: number;
  missingFields: string[];
  conflictFields: Array<{ id: string; expected: string; actual: string }>;
  exists: boolean;
  published: boolean;
};

type TableStatusesResponse =
  | { ok: true; tables: TableStatus[] }
  | { ok: false; message: string };

type TableInitializeResult = TableStatus & {
  action: "created" | "updated" | "skipped";
};

type TableInitializeResponse =
  | { ok: true; results: TableInitializeResult[] }
  | { ok: false; message: string };

type SecretStatus = {
  configured: boolean;
  displayValue: string;
};

type ServerConfigSuccess = {
  ok: true;
  values: {
    spaceId: string;
    environmentId: string;
    locale: string;
  };
  tokens: {
    delivery: SecretStatus;
    preview: SecretStatus;
    management: SecretStatus;
  };
};

type ServerConfigResponse = ServerConfigSuccess | { ok: false; message: string };

const STORAGE_KEY = "fengbro-contentful-settings";

const text = {
  saved: "\u5df2\u5132\u5b58",
  saveSettings: "\u5132\u5b58\u8a2d\u5b9a",
  testing: "\u6e2c\u8a66\u4e2d...",
  testConnection: "\u6e2c\u8a66\u9023\u7dda",
  tableStatus: "\u8F09\u5165 Table \u72C0\u614B",
  loadingStatus: "\u8F09\u5165\u4E2D...",
  initAll: "\u521D\u59CB\u5316\u5168\u90E8 Table",
  initializingAll: "\u521D\u59CB\u5316\u4E2D...",
  initSingle: "\u521D\u59CB\u5316",
  unknownError: "\u767C\u751F\u672A\u77E5\u932F\u8AA4",
  missingMgmtToken:
    "\u8ACB\u5148\u586B\u5165 Contentful Management Token\uff0c\u6216\u5728\u90E8\u7F72\u5E73\u53F0\u8A2D\u5B9A CONTENTFUL_MANAGEMENT_TOKEN \u5F8C\u91CD\u65B0\u90E8\u7F72\u3002",
  envConfigured: "deployment env configured",
  envMissing: "deployment env missing",
  localeFallback: "Locale is not enabled in Contentful, so the request used the space default locale."
};

const defaultSettings: ContentfulSettings = {
  spaceId: "",
  environmentId: "master",
  deliveryToken: "",
  previewToken: "",
  managementToken: "",
  locale: "",
  usePreview: false
};

function loadSettings() {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function resultClass(ok: boolean) {
  return ok ? "result success" : "result error";
}

function tableBadgeClass(status: TableStatus) {
  if (!status.exists) return "badge neutral";
  if (status.conflictFields.length > 0 || status.missingFields.length > 0) return "badge warning";
  return "badge success";
}

function tokenHint(status?: SecretStatus) {
  if (!status?.configured) return text.envMissing;
  return `${text.envConfigured}: ${status.displayValue}`;
}

export default function Home() {
  const [settings, setSettings] = createSignal<ContentfulSettings>(loadSettings());
  const [serverConfig, setServerConfig] = createSignal<ServerConfigResponse | null>(null);
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSaved, setIsSaved] = createSignal(false);
  const [result, setResult] = createSignal<TestResult | null>(null);
  const [tables, setTables] = createSignal<TableStatus[]>([]);
  const [tableMessage, setTableMessage] = createSignal<{ ok: boolean; message: string } | null>(null);
  const [isLoadingTables, setIsLoadingTables] = createSignal(false);
  const [isInitializingAll, setIsInitializingAll] = createSignal(false);
  const [initializingTableId, setInitializingTableId] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const response = await fetch("/api/contentful-config");
      const payload = (await response.json()) as ServerConfigResponse;
      setServerConfig(payload);

      if (payload.ok) {
        setSettings((current) => ({
          ...current,
          spaceId: current.spaceId.trim() ? current.spaceId : payload.values.spaceId,
          environmentId: current.environmentId.trim() ? current.environmentId : payload.values.environmentId,
          locale: current.locale.trim() ? current.locale : payload.values.locale
        }));
      }
    } catch (error) {
      setServerConfig({
        ok: false,
        message: error instanceof Error ? error.message : text.unknownError
      });
    }
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
  });

  const updateSetting = <K extends keyof ContentfulSettings>(key: K, value: ContentfulSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setIsSaved(false);
    if (key === "managementToken" || key === "spaceId" || key === "environmentId") {
      setTableMessage(null);
      setTables([]);
    }
    if (key === "deliveryToken" || key === "previewToken" || key === "spaceId" || key === "environmentId") {
      setResult(null);
    }
  };

  const saveSettings = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    }
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 1800);
  };

  const currentServerConfig = () => {
    const config = serverConfig();
    return config?.ok ? config : null;
  };

  const hasSpaceId = () => settings().spaceId.trim().length > 0 || Boolean(currentServerConfig()?.values.spaceId);
  const hasManagementToken = () =>
    settings().managementToken.trim().length > 0 || Boolean(currentServerConfig()?.tokens.management.configured);
  const canManageTables = () => hasSpaceId() && hasManagementToken();

  const activeToken = () => (settings().usePreview ? settings().previewToken : settings().deliveryToken);
  const hasActiveToken = () => {
    if (activeToken().trim().length > 0) return true;
    const config = currentServerConfig();
    return settings().usePreview
      ? Boolean(config?.tokens.preview.configured)
      : Boolean(config?.tokens.delivery.configured);
  };
  const canTest = () => !isTesting();

  const testConnection = async () => {
    setIsTesting(true);
    setResult(null);

    if (!hasSpaceId() || !hasActiveToken()) {
      setResult({
        ok: false,
        message:
          "請先填入 Contentful Space ID 與 Access Token，或確認部署平台的 environment variables 已設定並重新部署。"
      });
      setIsTesting(false);
      return;
    }

    try {
      const response = await fetch("/api/test-contentful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings())
      });
      const payload = (await response.json()) as TestResult;
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : text.unknownError
      });
    } finally {
      setIsTesting(false);
    }
  };

  const loadTableStatuses = async () => {
    if (!canManageTables()) {
      setTableMessage({ ok: false, message: text.missingMgmtToken });
      return;
    }

    setIsLoadingTables(true);
    setTableMessage(null);

    try {
      const response = await fetch("/api/contentful-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          settings: {
            spaceId: settings().spaceId,
            environmentId: settings().environmentId,
            managementToken: settings().managementToken
          }
        })
      });

      const payload = (await response.json()) as TableStatusesResponse;
      if (!payload.ok) {
        setTableMessage({ ok: false, message: payload.message });
        return;
      }

      setTables(payload.tables);
      setTableMessage({
        ok: true,
        message: `Loaded ${payload.tables.length} table definitions.`
      });
    } catch (error) {
      setTableMessage({
        ok: false,
        message: error instanceof Error ? error.message : text.unknownError
      });
    } finally {
      setIsLoadingTables(false);
    }
  };

  const initializeTables = async (tableName?: string) => {
    if (!canManageTables()) {
      setTableMessage({ ok: false, message: text.missingMgmtToken });
      return;
    }

    if (tableName) {
      setInitializingTableId(tableName);
    } else {
      setIsInitializingAll(true);
    }
    setTableMessage(null);

    try {
      const response = await fetch("/api/contentful-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initialize",
          tableName,
          settings: {
            spaceId: settings().spaceId,
            environmentId: settings().environmentId,
            managementToken: settings().managementToken
          }
        })
      });

      const payload = (await response.json()) as TableInitializeResponse;
      if (!payload.ok) {
        setTableMessage({ ok: false, message: payload.message });
        return;
      }

      const created = payload.results.filter((item) => item.action === "created").length;
      const updated = payload.results.filter((item) => item.action === "updated").length;
      const skipped = payload.results.filter((item) => item.action === "skipped").length;

      setTableMessage({
        ok: true,
        message: `Initialization finished. created=${created}, updated=${updated}, skipped=${skipped}`
      });
      await loadTableStatuses();
    } catch (error) {
      setTableMessage({
        ok: false,
        message: error instanceof Error ? error.message : text.unknownError
      });
    } finally {
      setInitializingTableId(null);
      setIsInitializingAll(false);
    }
  };

  return (
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">SolidStart Contentful Tool</p>
        <div class="hero-row">
          <div>
            <h1>&#x92d2;&#x5144;&#x8a2d;&#x5b9a;</h1>
            <p class="hero-copy">
              &#x8A2D;&#x5B9A; Contentful &#x53C3;&#x6578;&#x3001;&#x6E2C;&#x8A66; API
              &#x9023;&#x7DDA;&#xFF0C;&#x4E26;&#x53C3;&#x8003; fengbroaiappwrite
              &#x6D41;&#x7A0B;&#x521D;&#x59CB;&#x5316; Table&#x3002;
            </p>
          </div>
          <div class="status-pill">Contentful</div>
        </div>
      </section>

      <section class="panel" aria-labelledby="settings-title">
        <div class="panel-heading">
          <div>
            <h2 id="settings-title">Contentful &#x53C3;&#x6578;</h2>
            <p>
              &#x8A2D;&#x5B9A;&#x6703;&#x5B58;&#x5728;&#x9019;&#x53F0;&#x700F;&#x89BD;&#x5668;&#x7684; localStorage&#x3002;
              &#x6B04;&#x4F4D;&#x7559;&#x7A7A;&#x6642;&#xFF0C;server API &#x6703;&#x6539;&#x7528;&#x90E8;&#x7F72;&#x5E73;&#x53F0;&#x7684; environment variables&#x3002;
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={settings().usePreview}
              onInput={(event) => updateSetting("usePreview", event.currentTarget.checked)}
            />
            <span>&#x4F7F;&#x7528; Preview API</span>
          </label>
        </div>

        <div class="form-grid">
          <label>
            <span>Space ID</span>
            <input
              value={settings().spaceId}
              onInput={(event) => updateSetting("spaceId", event.currentTarget.value)}
              placeholder="abc123xyz"
              autocomplete="off"
            />
          </label>

          <label>
            <span>Environment ID</span>
            <input
              value={settings().environmentId}
              onInput={(event) => updateSetting("environmentId", event.currentTarget.value)}
              placeholder="master"
              autocomplete="off"
            />
          </label>

          <label>
            <span>Delivery Access Token</span>
            <input
              type="password"
              value={settings().deliveryToken}
              onInput={(event) => updateSetting("deliveryToken", event.currentTarget.value)}
              placeholder="Content Delivery API token"
              autocomplete="off"
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.delivery)}</small>
          </label>

          <label>
            <span>Preview Access Token</span>
            <input
              type="password"
              value={settings().previewToken}
              onInput={(event) => updateSetting("previewToken", event.currentTarget.value)}
              placeholder="Content Preview API token"
              autocomplete="off"
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.preview)}</small>
          </label>

          <label>
            <span>Management Token</span>
            <input
              type="password"
              value={settings().managementToken}
              onInput={(event) => updateSetting("managementToken", event.currentTarget.value)}
              placeholder="Content Management API token"
              autocomplete="off"
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.management)}</small>
          </label>

          <label>
            <span>Locale</span>
            <input
              value={settings().locale}
              onInput={(event) => updateSetting("locale", event.currentTarget.value)}
              placeholder="Optional, leave blank for default locale"
              autocomplete="off"
            />
          </label>
        </div>

        <Show when={serverConfig()}>
          {(config) => (
            <Show
              when={config().ok ? (config() as ServerConfigSuccess) : null}
              fallback={
                <div class="env-summary warning">
                  <strong>Deployment env status</strong>
                  <span>{(config() as { ok: false; message: string }).message}</span>
                </div>
              }
            >
              {(current) => (
                <div class="env-summary">
                  <strong>Deployment env status</strong>
                  <span>Space: {current().values.spaceId || "missing"}</span>
                  <span>Environment: {current().values.environmentId || "master"}</span>
                  <span>Locale: {current().values.locale || "en-US"}</span>
                  <span>Management: {tokenHint(current().tokens.management)}</span>
                </div>
              )}
            </Show>
          )}
        </Show>

        <div class="actions">
          <button class="secondary" type="button" onClick={saveSettings}>
            {isSaved() ? text.saved : text.saveSettings}
          </button>
          <button class="primary" type="button" disabled={!canTest()} onClick={testConnection}>
            {isTesting() ? text.testing : text.testConnection}
          </button>
        </div>

        <Show when={result()}>
          {(current) => {
            const value = current();

            if (!value.ok) {
              return (
                <div class={resultClass(false)} role="status">
                  <strong>&#x9023;&#x7DDA;&#x5931;&#x6557;</strong>
                  <p>{value.message}</p>
                  <Show when={value.status}>
                    <small>HTTP status: {value.status}</small>
                  </Show>
                </div>
              );
            }

            return (
              <div class={resultClass(true)} role="status">
                <strong>&#x9023;&#x7DDA;&#x6210;&#x529F;</strong>
                <p>
                  {value.mode} API &#x5DF2;&#x9023;&#x4E0A; {value.spaceId}/{value.environmentId}
                  &#xFF0C;&#x5171;&#x627E;&#x5230; {value.total} &#x7B46;&#x9805;&#x76EE;&#x3002;
                </p>
                <Show when={value.localeFallback}>
                  <p class="notice">{text.localeFallback}</p>
                </Show>
                <small>
                  Locale: {value.locale}
                  {" · "}
                  &#x9019;&#x6B21;&#x56DE;&#x50B3; {value.itemCount} &#x7B46;
                  <Show when={value.firstEntryTitle}>
                    &#xFF0C;&#x7B2C;&#x4E00;&#x7B46;&#xFF1A;{value.firstEntryTitle}
                  </Show>
                </small>
              </div>
            );
          }}
        </Show>
      </section>

      <section class="panel table-panel" aria-labelledby="table-init-title">
        <div class="panel-heading">
          <div>
            <h2 id="table-init-title">Table Initialization</h2>
            <p>
              &#x53C3;&#x8003; fengbroaiappwrite &#x7684; create-table
              &#x6982;&#x5FF5;&#xFF0C;&#x53EF;&#x6AA2;&#x67E5; Contentful content type
              &#x72C0;&#x614B;&#x4E26;&#x521D;&#x59CB;&#x5316;&#x5305;&#x542B; CronContentful &#x5728;&#x5167;&#x7684;
              table schema&#x3002;
            </p>
          </div>
          <div class="toolbar">
            <button
              class="secondary"
              type="button"
              disabled={isLoadingTables()}
              onClick={loadTableStatuses}
            >
              {isLoadingTables() ? text.loadingStatus : text.tableStatus}
            </button>
            <button
              class="primary"
              type="button"
              disabled={isInitializingAll()}
              onClick={() => initializeTables()}
            >
              {isInitializingAll() ? text.initializingAll : text.initAll}
            </button>
          </div>
        </div>

        <Show when={tableMessage()}>
          {(message) => (
            <div class={resultClass(message().ok)} role="status">
              <p>{message().message}</p>
            </div>
          )}
        </Show>

        <Show
          when={tables().length > 0}
          fallback={
            <div class="empty-state">
              <p>
                &#x53EF;&#x4F7F;&#x7528;&#x756B;&#x9762;&#x8F38;&#x5165;&#x7684; Management Token&#xFF0C;
                &#x6216;&#x7559;&#x7A7A;&#x6539;&#x7528;&#x90E8;&#x7F72;&#x5E73;&#x53F0;&#x7684; CONTENTFUL_MANAGEMENT_TOKEN
                &#x4F86;&#x8F09;&#x5165; Table &#x72C0;&#x614B;&#x3002;
              </p>
            </div>
          }
        >
          <div class="table-list">
            <For each={tables()}>
              {(table) => (
                <article class="table-card">
                  <div class="table-card-header">
                    <div>
                      <h3>{table.title}</h3>
                      <p class="table-id">{table.id}</p>
                    </div>
                    <span class={tableBadgeClass(table)}>
                      {table.exists
                        ? table.conflictFields.length > 0 || table.missingFields.length > 0
                          ? "Needs sync"
                          : "Ready"
                        : "Missing"}
                    </span>
                  </div>

                  <div class="table-meta">
                    <span>expected {table.expectedFields}</span>
                    <span>actual {table.actualFields}</span>
                    <span>{table.published ? "published" : "draft"}</span>
                  </div>

                  <Show when={table.missingFields.length > 0}>
                    <p class="table-notes">
                      missing: {table.missingFields.join(", ")}
                    </p>
                  </Show>

                  <Show when={table.conflictFields.length > 0}>
                    <p class="table-notes">
                      conflict:{" "}
                      {table.conflictFields
                        .map((field) => `${field.id}(${field.actual} -> ${field.expected})`)
                        .join(", ")}
                    </p>
                  </Show>

                  <div class="table-card-actions">
                    <button
                      class="secondary"
                      type="button"
                      disabled={initializingTableId() === table.id}
                      onClick={() => initializeTables(table.id)}
                    >
                      {initializingTableId() === table.id ? text.initializingAll : text.initSingle}
                    </button>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </section>
    </main>
  );
}
