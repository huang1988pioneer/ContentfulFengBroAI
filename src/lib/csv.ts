export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const [headers, ...dataRows] = rows;

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

export function stringifyCsv(headers: string[], rows: CsvRow[]) {
  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(","))
  ].join("\r\n");
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
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

function stripTrailingCarriageReturn(value: string) {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}
