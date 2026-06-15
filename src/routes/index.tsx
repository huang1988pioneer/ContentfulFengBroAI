import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { ContentfulCsvPanel } from "../components/ContentfulCsvPanel";
import { FengbroCrudWorkspace } from "../components/FengbroCrudWorkspace";
import { FengbroToolsConsole } from "../components/FengbroToolsConsole";

type ContentfulSettings = {
  spaceId: string;
  environmentId: string;
  deliveryToken: string;
  previewToken: string;
  managementToken: string;
  locale: string;
  usePreview: boolean;
};

type TestResult =
  | {
      ok: true;
      mode: string;
      spaceId: string;
      environmentId: string;
      locale: string;
      localeFallback: boolean;
      total: number;
      itemCount: number;
      firstEntryTitle: string | null;
    }
  | { ok: false; message: string; status?: number };

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

type TableInitializeResult = TableStatus & {
  action: "created" | "skipped" | "updated";
};

type SecretStatus = {
  configured: boolean;
  displayValue: string;
};

type ServerConfigResponse =
  | {
      ok: true;
      values: { spaceId: string; environmentId: string; locale: string };
      tokens: { delivery: SecretStatus; preview: SecretStatus; management: SecretStatus };
    }
  | { ok: false; message: string };

type ServerConfigSuccess = Extract<ServerConfigResponse, { ok: true }>;

const STORAGE_KEY = "fengbro-contentful-settings";

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
  if (!status?.configured) return "deployment env missing";
  return `deployment env configured: ${status.displayValue}`;
}

export default function Home() {
  return <FengbroToolsConsole />;

  const [settings, setSettings] = createSignal<ContentfulSettings>(loadSettings());
  const [serverConfig, setServerConfig] = createSignal<ServerConfigResponse | null>(null);
  const [isSaved, setIsSaved] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<TestResult | null>(null);
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
        message: error instanceof Error ? error.message : "Unable to load deployment env status."
      });
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    }
  });

  const currentServerConfig = (): ServerConfigSuccess | null => {
    const config = serverConfig();
    return config?.ok ? config : null;
  };

  const hasSpaceId = () => settings().spaceId.trim().length > 0 || Boolean(currentServerConfig()?.values.spaceId);
  const hasManagementToken = () =>
    settings().managementToken.trim().length > 0 || Boolean(currentServerConfig()?.tokens.management.configured);
  const canManage = () => hasSpaceId() && hasManagementToken();
  const activeToken = () => (settings().usePreview ? settings().previewToken : settings().deliveryToken);
  const hasActiveToken = () => {
    if (activeToken().trim()) return true;
    const config = currentServerConfig();
    return settings().usePreview
      ? Boolean(config?.tokens.preview.configured)
      : Boolean(config?.tokens.delivery.configured);
  };

  const crudSettings = () => ({
    spaceId: settings().spaceId,
    environmentId: settings().environmentId,
    managementToken: settings().managementToken,
    locale: settings().locale
  });

  const updateSetting = <K extends keyof ContentfulSettings>(key: K, value: ContentfulSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setIsSaved(false);
    if (key === "managementToken" || key === "spaceId" || key === "environmentId") {
      setTableMessage(null);
      setTables([]);
    }
    if (key === "deliveryToken" || key === "previewToken" || key === "spaceId" || key === "environmentId") {
      setTestResult(null);
    }
  };

  const saveSettings = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    }
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 1800);
  };

  const clearLocalSettings = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const config = currentServerConfig();
    setSettings({
      ...defaultSettings,
      spaceId: config?.values.spaceId ?? "",
      environmentId: config?.values.environmentId ?? "master",
      locale: config?.values.locale ?? ""
    });
    setTestResult(null);
    setTables([]);
    setTableMessage({
      ok: true,
      message: "Local settings cleared. Blank token fields will use deployment environment variables."
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    if (!hasSpaceId() || !hasActiveToken()) {
      setTestResult({
        ok: false,
        message: "Enter Contentful Space ID and Access Token, or configure deployment environment variables."
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
      setTestResult((await response.json()) as TestResult);
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to connect to Contentful."
      });
    } finally {
      setIsTesting(false);
    }
  };

  const loadTableStatuses = async () => {
    if (!canManage()) {
      setTableMessage({
        ok: false,
        message: "Enter Contentful Space ID and Management Token before loading table status."
      });
      return;
    }
    setIsLoadingTables(true);
    setTableMessage(null);
    try {
      const response = await fetch("/api/contentful-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", settings: crudSettings() })
      });
      const payload = (await response.json()) as
        | { ok: true; tables: TableStatus[] }
        | { ok: false; message: string };
      if (!payload.ok) {
        setTableMessage({ ok: false, message: payload.message });
        return;
      }
      setTables(payload.tables);
      setTableMessage({ ok: true, message: `Loaded ${payload.tables.length} table definitions.` });
    } catch (error) {
      setTableMessage({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load table status."
      });
    } finally {
      setIsLoadingTables(false);
    }
  };

  const initializeTables = async (tableName?: string) => {
    if (!canManage()) {
      setTableMessage({
        ok: false,
        message: "Enter Contentful Space ID and Management Token before initializing tables."
      });
      return;
    }
    tableName ? setInitializingTableId(tableName) : setIsInitializingAll(true);
    setTableMessage(null);
    try {
      const response = await fetch("/api/contentful-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize", tableName, settings: crudSettings() })
      });
      const payload = (await response.json()) as
        | { ok: true; results: TableInitializeResult[] }
        | { ok: false; message: string };
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
        message: error instanceof Error ? error.message : "Unable to initialize tables."
      });
    } finally {
      setInitializingTableId(null);
      setIsInitializingAll(false);
    }
  };

  return (
    <main class="shell">
      <section class="hero">
        <div class="hero-row">
          <div>
            <p class="eyebrow">SolidStart Contentful Tool</p>
            <h1>FengBro Settings</h1>
            <p class="hero-copy">
              Configure Contentful, test Delivery/Preview access, initialize Appwrite-style tables, and manage CRUD.
            </p>
          </div>
          <div class="status-pill">Contentful</div>
        </div>
      </section>

      <section class="panel" aria-labelledby="settings-title">
        <div class="panel-heading">
          <div>
            <h2 id="settings-title">Contentful Parameters</h2>
            <p>Blank fields fall back to deployment environment variables on the server.</p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={settings().usePreview}
              onInput={(event) => updateSetting("usePreview", event.currentTarget.checked)}
            />
            <span>Use Preview API</span>
          </label>
        </div>

        <div class="form-grid">
          <label>
            <span>Space ID</span>
            <input value={settings().spaceId} onInput={(event) => updateSetting("spaceId", event.currentTarget.value)} />
          </label>
          <label>
            <span>Environment ID</span>
            <input
              value={settings().environmentId}
              onInput={(event) => updateSetting("environmentId", event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Delivery Access Token</span>
            <input
              type="password"
              value={settings().deliveryToken}
              onInput={(event) => updateSetting("deliveryToken", event.currentTarget.value)}
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.delivery)}</small>
          </label>
          <label>
            <span>Preview Access Token</span>
            <input
              type="password"
              value={settings().previewToken}
              onInput={(event) => updateSetting("previewToken", event.currentTarget.value)}
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.preview)}</small>
          </label>
          <label>
            <span>Management Token</span>
            <input
              type="password"
              value={settings().managementToken}
              onInput={(event) => updateSetting("managementToken", event.currentTarget.value)}
            />
            <small class="field-hint">{tokenHint(currentServerConfig()?.tokens.management)}</small>
          </label>
          <label>
            <span>Locale</span>
            <input value={settings().locale} onInput={(event) => updateSetting("locale", event.currentTarget.value)} />
          </label>
        </div>

        <Show when={serverConfig()}>
          {(config) => {
            const current = config();
            return current.ok ? (
              <div class="env-summary">
                <strong>Deployment env status</strong>
                <span>Space: {current.values.spaceId || "missing"}</span>
                <span>Environment: {current.values.environmentId || "master"}</span>
                <span>Locale: {current.values.locale || "en-US"}</span>
                <span>Management: {tokenHint(current.tokens.management)}</span>
              </div>
            ) : (
              <div class="env-summary warning">
                <strong>Deployment env status</strong>
                <span>{current.message}</span>
              </div>
            );
          }}
        </Show>

        <div class="actions">
          <button class="secondary" type="button" onClick={clearLocalSettings}>
            Clear Local Settings
          </button>
          <button class="secondary" type="button" onClick={saveSettings}>
            {isSaved() ? "Saved" : "Save Settings"}
          </button>
          <button class="primary" type="button" disabled={isTesting()} onClick={testConnection}>
            {isTesting() ? "Testing..." : "Test Connection"}
          </button>
        </div>

        <Show when={testResult()}>
          {(current) => {
            const value = current();
            return value.ok ? (
              <div class={resultClass(true)} role="status">
                <strong>Connection succeeded</strong>
                <p>
                  {value.mode} API connected to {value.spaceId}/{value.environmentId}; found {value.total} entries.
                </p>
                <Show when={value.localeFallback}>
                  <p class="notice">Locale fallback was used because the requested locale is not enabled.</p>
                </Show>
                <small>
                  Locale: {value.locale}; returned {value.itemCount} entries
                  <Show when={value.firstEntryTitle}>; first entry: {value.firstEntryTitle}</Show>
                </small>
              </div>
            ) : (
              <div class={resultClass(false)} role="status">
                <strong>Connection failed</strong>
                <p>{value.message}</p>
                <Show when={value.status}>
                  <small>HTTP status: {value.status}</small>
                </Show>
              </div>
            );
          }}
        </Show>
      </section>

      <FengbroCrudWorkspace canManage={canManage()} settings={crudSettings()} />

      <section class="panel" aria-labelledby="csv-title">
        <div class="panel-heading">
          <div>
            <h2 id="csv-title">CSV Import / Export</h2>
            <p>Batch import or export Contentful entries using the Appwrite-compatible table schema.</p>
          </div>
        </div>
        <ContentfulCsvPanel canManage={canManage()} settings={crudSettings()} />
      </section>

      <section class="panel table-panel" aria-labelledby="table-init-title">
        <div class="panel-heading">
          <div>
            <h2 id="table-init-title">Table Initialization</h2>
            <p>Check Contentful content type status and initialize all FengBro table schemas.</p>
          </div>
          <div class="toolbar">
            <button class="secondary" type="button" disabled={isLoadingTables()} onClick={loadTableStatuses}>
              {isLoadingTables() ? "Loading..." : "Load Table Status"}
            </button>
            <button class="primary" type="button" disabled={isInitializingAll()} onClick={() => initializeTables()}>
              {isInitializingAll() ? "Initializing..." : "Initialize All Tables"}
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
          fallback={<div class="empty-state">Use the Management Token above, or deployment env vars, to load table status.</div>}
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
                        ? table.conflictFields.length || table.missingFields.length
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
                    <p class="table-notes">missing: {table.missingFields.join(", ")}</p>
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
                      {initializingTableId() === table.id ? "Initializing..." : "Initialize"}
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
