import { createMemo, createSignal, For, Show } from "solid-js";
import { TABLE_SCHEMA_LIST } from "../lib/table-schemas";

type ContentfulSettings = {
  spaceId?: string;
  environmentId?: string;
  managementToken?: string;
  locale?: string;
};

type CsvPanelProps = {
  canManage?: boolean;
  onImported?: (payload: Extract<CsvResponse, { ok: true }>) => Promise<void> | void;
  settings?: ContentfulSettings;
  tableName?: string;
};

type CsvResponse =
  | {
      ok: true;
      csv?: string;
      fileName?: string;
      imported?: number;
      locale: string;
      rowCount?: number;
      tableName: string;
    }
  | { ok: false; message: string };

const sampleHints = new Map([
  ["subscription", "name,site,price,nextdate,note,account,currency,continue"],
  ["food", "name,amount,todate,photo,price,shop,photohash"],
  [
    "article",
    "title,content,category,newDate,url1,url2,url3,file1,file1name,file1type,file2,file2name,file2type,file3,file3name,file3type"
  ],
  ["commonaccount", "name,site01,note01,site02,note02,...,site37,note37"],
  ["bank", "name,deposit,site,address,withdrawals,transfer,activity,card,account"],
  ["routine", "name,note,lastdate1,lastdate2,lastdate3,link,photo"]
]);

export function ContentfulCsvPanel(props: CsvPanelProps) {
  const [selectedTable, setSelectedTable] = createSignal(
    props.tableName ?? TABLE_SCHEMA_LIST[0]?.name ?? ""
  );
  const [csvText, setCsvText] = createSignal("");
  const [isImporting, setIsImporting] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [message, setMessage] = createSignal<{ ok: boolean; text: string } | null>(null);

  const tableName = createMemo(() => props.tableName ?? selectedTable());
  const schema = createMemo(() => TABLE_SCHEMA_LIST.find((item) => item.name === tableName()));
  const canManage = createMemo(() => props.canManage ?? true);

  const settingsPayload = () => ({
    spaceId: props.settings?.spaceId ?? "",
    environmentId: props.settings?.environmentId ?? "master",
    managementToken: props.settings?.managementToken ?? "",
    locale: props.settings?.locale ?? ""
  });

  async function callCsv(action: "exportCsv" | "importCsv") {
    const response = await fetch("/api/contentful-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        csvText: csvText(),
        settings: settingsPayload(),
        tableName: tableName()
      })
    });
    return (await response.json()) as CsvResponse;
  }

  async function importCsv() {
    if (!canManage()) {
      setMessage({ ok: false, text: "Please enter Space ID and Contentful Management Token first." });
      return;
    }
    if (!csvText().trim()) {
      setMessage({ ok: false, text: "Paste or choose a CSV file before importing." });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const payload = await callCsv("importCsv");
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      setMessage({
        ok: true,
        text: `Imported ${payload.imported ?? 0} rows into ${payload.tableName}. Locale: ${payload.locale}`
      });
      await props.onImported?.(payload);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to import CSV." });
    } finally {
      setIsImporting(false);
    }
  }

  async function exportCsv() {
    if (!canManage()) {
      setMessage({ ok: false, text: "Please enter Space ID and Contentful Management Token first." });
      return;
    }

    setIsExporting(true);
    setMessage(null);
    try {
      const payload = await callCsv("exportCsv");
      if (!payload.ok) {
        setMessage({ ok: false, text: payload.message });
        return;
      }
      const blob = new Blob([payload.csv ?? ""], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.fileName ?? `${payload.tableName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({
        ok: true,
        text: `Exported ${payload.rowCount ?? 0} rows from ${payload.tableName}. Locale: ${payload.locale}`
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to export CSV." });
    } finally {
      setIsExporting(false);
    }
  }

  async function readFile(file?: File) {
    if (!file) return;
    setCsvText(await file.text());
    setMessage({ ok: true, text: `Loaded ${file.name}. Ready to import into ${tableName()}.` });
  }

  return (
    <section class="csv-panel">
      <div class="csv-panel-heading">
        <div>
          <small>Appwrite compatible CSV</small>
          <h3>CSV import / export</h3>
          <p>
            Supports quoted commas, escaped quotes, and multi-line notes. Current table:
            {" "}
            <strong>{schema()?.title ?? tableName()}</strong>
          </p>
        </div>
        <Show when={!props.tableName}>
          <label class="csv-table-picker">
            <span>Table</span>
            <select value={selectedTable()} onChange={(event) => setSelectedTable(event.currentTarget.value)}>
              <For each={TABLE_SCHEMA_LIST}>
                {(item) => <option value={item.name}>{item.title}</option>}
              </For>
            </select>
          </label>
        </Show>
      </div>

      <div class="csv-actions">
        <label class="file-button">
          <span>Choose CSV</span>
          <input
            accept=".csv,text/csv"
            type="file"
            onChange={(event) => void readFile(event.currentTarget.files?.[0])}
          />
        </label>
        <button class="secondary" disabled={isExporting()} type="button" onClick={() => void exportCsv()}>
          {isExporting() ? "Exporting..." : "Export CSV"}
        </button>
        <button class="primary" disabled={isImporting()} type="button" onClick={() => void importCsv()}>
          {isImporting() ? "Importing..." : "Import CSV"}
        </button>
      </div>

      <textarea
        class="csv-textarea"
        rows={8}
        value={csvText()}
        placeholder={sampleHints.get(tableName()) ?? "Paste CSV text here"}
        onInput={(event) => setCsvText(event.currentTarget.value)}
      />

      <Show when={message()}>
        {(current) => (
          <div class={`result ${current().ok ? "success" : "error"}`} role="status">
            <p>{current().text}</p>
          </div>
        )}
      </Show>
    </section>
  );
}
