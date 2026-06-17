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
  const [importProgress, setImportProgress] = createSignal({ current: 0, total: 0, percent: 0 });
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
    
    // Check if response is OK before parsing
    if (!response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text) as CsvResponse;
        return json;
      } catch {
        throw new Error(`Server error (${response.status}): ${text.slice(0, 200)}`);
      }
    }
    
    // Parse successful response
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("Server returned empty response");
    }
    
    try {
      return JSON.parse(text) as CsvResponse;
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
    }
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
    setImportProgress({ current: 0, total: 0, percent: 0 });
    
    try {
      // First, parse CSV locally to get total count
      const rows = parseCsvLocally(csvText());
      const total = rows.length;
      
      if (total === 0) {
        setMessage({ ok: false, text: "No valid data rows found in CSV." });
        return;
      }
      
      setImportProgress({ current: 0, total, percent: 0 });
      
      let imported = 0;
      const failures: string[] = [];
      
      // Import one by one with progress updates
      for (const [index, row] of rows.entries()) {
        try {
          await importSingleRow(row);
          imported++;
          setImportProgress({
            current: index + 1,
            total,
            percent: Math.round(((index + 1) / total) * 100)
          });
        } catch (error) {
          const rowPreview = Object.entries(row).slice(0, 2).map(([k, v]) => `${k}:${String(v).slice(0, 20)}`).join(", ");
          failures.push(`Row ${index + 1} (${rowPreview}): ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
      
      const locale = await getLocaleFromSettings();
      
      if (failures.length === 0) {
        setMessage({
          ok: true,
          text: `Imported ${imported} rows into ${tableName()}. Locale: ${locale}`
        });
      } else {
        setMessage({
          ok: imported > 0,
          text: `Imported ${imported}/${total} rows. ${failures.length} failed: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? `; and ${failures.length - 3} more...` : ""}`
        });
      }
      
      await props.onImported?.({ ok: true, imported, locale, tableName: tableName() });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to import CSV." });
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, percent: 0 });
    }
  }
  
  async function importSingleRow(row: Record<string, string>) {
    const response = await fetch("/api/contentful-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        tableName: tableName(),
        settings: settingsPayload(),
        values: row
      })
    });
    
    if (!response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text) as { ok: false; message: string };
        throw new Error(json.message || "Import failed");
      } catch {
        throw new Error(`Server error (${response.status})`);
      }
    }
    
    return response.json();
  }
  
  async function getLocaleFromSettings() {
    try {
      const response = await fetch("/api/contentful-config", {
        headers: { Accept: "application/json" }
      });
      const data = await response.json();
      return data.locale || settingsPayload().locale || "en-US";
    } catch {
      return settingsPayload().locale || "en-US";
    }
  }
  
  function parseCsvLocally(text: string): Array<Record<string, string>> {
    // Use the same robust CSV parser as the backend
    const cleanText = text.trim().replace(/^\uFEFF/, "");
    const parsedRows = parseCsvRows(cleanText);
    
    if (parsedRows.length < 2) return [];
    
    const [headers, ...dataRows] = parsedRows;
    
    if (!headers || headers.length === 0) {
      return [];
    }
    
    return dataRows
      .filter((row) => row.some((value) => value.trim().length > 0))
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header.trim(), row[index] ?? ""])
        )
      );
  }
  
  function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        row.push(field);
        field = "";
        continue;
      }

      if (char === '\n') {
        row.push(stripTrailingCarriageReturn(field));
        rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += char;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(stripTrailingCarriageReturn(field));
      rows.push(row);
    }

    return rows;
  }
  
  function stripTrailingCarriageReturn(value: string): string {
    return value.endsWith('\r') ? value.slice(0, -1) : value;
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
      
      <Show when={isImporting() && importProgress().total > 0}>
        <div class="progress-container" role="status">
          <div class="progress-info">
            <strong>Importing: {importProgress().current} / {importProgress().total}</strong>
            <span>{importProgress().percent}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style={{ width: `${importProgress().percent}%` }} />
          </div>
        </div>
      </Show>
    </section>
  );
}
