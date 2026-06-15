import { createEffect, createSignal, Show } from "solid-js";

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
  total: number;
  itemCount: number;
  firstEntryTitle: string | null;
  checkedAt: string;
};

type TestFailure = {
  ok: false;
  message: string;
  status?: number;
};

type TestResult = TestSuccess | TestFailure;

const STORAGE_KEY = "fengbro-contentful-settings";

const text = {
  saved: "\u5df2\u5132\u5b58",
  saveSettings: "\u5132\u5b58\u8a2d\u5b9a",
  testing: "\u6e2c\u8a66\u4e2d...",
  testConnection: "\u6e2c\u8a66\u9023\u7dda",
  unknownError: "\u6e2c\u8a66\u9023\u7dda\u6642\u767c\u751f\u672a\u77e5\u932f\u8aa4"
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

export default function Home() {
  const [settings, setSettings] = createSignal<ContentfulSettings>(loadSettings());
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSaved, setIsSaved] = createSignal(false);
  const [result, setResult] = createSignal<TestResult | null>(null);

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
  });

  const updateSetting = <K extends keyof ContentfulSettings>(key: K, value: ContentfulSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setIsSaved(false);
    setResult(null);
  };

  const saveSettings = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    }
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 1800);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setResult(null);

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

  const activeToken = () => (settings().usePreview ? settings().previewToken : settings().deliveryToken);
  const canTest = () => settings().spaceId.trim().length > 0 && activeToken().trim().length > 0 && !isTesting();

  return (
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">SolidStart Contentful Tool</p>
        <div class="hero-row">
          <div>
            <h1>&#x92D2;&#x5144;&#x8A2D;&#x5B9A;</h1>
            <p class="hero-copy">
              &#x8A2D;&#x5B9A; Contentful &#x53C3;&#x6578;&#x4E26;&#x6E2C;&#x8A66; Delivery &#x6216; Preview API
              &#x662F;&#x5426;&#x80FD;&#x8B80;&#x53D6;&#x8CC7;&#x6599;&#x3002;
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
              &#x6E2C;&#x8A66;&#x9023;&#x7DDA;&#x6703;&#x8B80;&#x53D6;&#x4E00;&#x7B46; entry
              &#x9A57;&#x8B49; token &#x8207;&#x74B0;&#x5883;&#x662F;&#x5426;&#x6B63;&#x78BA;&#x3002;
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
          </label>

          <label>
            <span>Management Token</span>
            <input
              type="password"
              value={settings().managementToken}
              onInput={(event) => updateSetting("managementToken", event.currentTarget.value)}
              placeholder="Optional management token"
              autocomplete="off"
            />
          </label>

          <label>
            <span>Locale</span>
            <input
              value={settings().locale}
              onInput={(event) => updateSetting("locale", event.currentTarget.value)}
              placeholder="zh-TW"
              autocomplete="off"
            />
          </label>
        </div>

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
                <div class="result error" role="status">
                  <strong>&#x9023;&#x7DDA;&#x5931;&#x6557;</strong>
                  <p>{value.message}</p>
                  <Show when={value.status}>
                    <small>HTTP status: {value.status}</small>
                  </Show>
                </div>
              );
            }

            return (
              <div class="result success" role="status">
                <strong>&#x9023;&#x7DDA;&#x6210;&#x529F;</strong>
                <p>
                  {value.mode} API &#x5DF2;&#x9023;&#x4E0A; {value.spaceId}/{value.environmentId}
                  &#xFF0C;&#x5171;&#x627E;&#x5230; {value.total} &#x7B46;&#x9805;&#x76EE;&#x3002;
                </p>
                <small>
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
    </main>
  );
}
