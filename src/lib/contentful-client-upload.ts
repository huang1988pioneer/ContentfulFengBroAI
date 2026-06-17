export type ClientUploadSettings = {
  environmentId: string;
  locale: string;
  managementToken: string;
  spaceId: string;
};

export type ClientUploadInput = ClientUploadSettings & {
  category?: string;
  contentType: string;
  displayName?: string;
  file: File;
  fileName: string;
  kind: string;
  note?: string;
  ref?: string;
};

export type ClientUploadResult = {
  assetId: string;
  contentTypeId: string;
  entryId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  hash: string;
  locale: string;
  message?: string;
  partial?: boolean;
  url: string;
};

export type UploadProgressCallback = (percent: number) => void;

function normalizeToken(value?: string) {
  return (value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function contentTypeIdForKind(kind: string) {
  return kind === "document" ? "commondocument" : kind;
}

function assetUrl(asset: any, locale: string) {
  const raw = asset?.fields?.file?.[locale]?.url ?? "";
  return raw.startsWith("//") ? `https:${raw}` : raw;
}

function appendAssetNote(note: string, assetId: string, message?: string) {
  const parts = [note, `Contentful Asset ID: ${assetId}`];
  if (message) parts.push(`Upload note: ${message}`);
  return parts.filter(Boolean).join("\n");
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

async function calculateFileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readError(response: Response) {
  return (await response.text()).replace(/\s+/g, " ").slice(0, 220);
}

export async function uploadToContentfulDirect(
  input: ClientUploadInput,
  onProgress?: UploadProgressCallback
): Promise<ClientUploadResult> {
  const token = normalizeToken(input.managementToken);
  if (!token) throw new Error("上傳設定尚未完成，請稍後再試。");

  const locale = input.locale || "zh-TW";
  const contentType = input.contentType || "application/octet-stream";
  const contentTypeId = contentTypeIdForKind(input.kind);
  const title = input.displayName || input.fileName;
  const baseUrl = `https://api.contentful.com/spaces/${input.spaceId}/environments/${input.environmentId || "master"}`;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  onProgress?.(8);
  const createAssetResponse = await fetch(`${baseUrl}/assets`, {
    body: JSON.stringify({
      fields: {
        description: { [locale]: input.note || "" },
        file: {
          [locale]: {
            contentType,
            fileName: input.fileName
          }
        },
        title: { [locale]: title }
      }
    }),
    headers: jsonHeaders,
    method: "POST"
  });

  if (!createAssetResponse.ok) {
    throw new Error(`無法建立 Contentful Asset：${await readError(createAssetResponse)}`);
  }

  const createdAsset = await createAssetResponse.json();
  const assetId = createdAsset.sys.id;
  const uploadUrl = createdAsset.fields.file?.[locale]?.upload;
  if (!uploadUrl) throw new Error("Contentful 沒有回傳上傳位置，請重新上傳。");

  onProgress?.(18);
  await uploadFileToContentful(uploadUrl.startsWith("//") ? `https:${uploadUrl}` : uploadUrl, input.file, contentType, (percent) => {
    onProgress?.(18 + Math.round(percent * 0.47));
  });

  onProgress?.(66);
  const processResponse = await fetch(`${baseUrl}/assets/${assetId}/files/${locale}/process`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(createdAsset.sys.version)
    },
    method: "PUT"
  });

  if (!processResponse.ok) {
    throw new Error(`檔案已上傳，但 Contentful 處理失敗：${await readError(processResponse)}`);
  }

  let processedAsset = await processResponse.json();
  for (let index = 0; index < 12 && !assetUrl(processedAsset, locale); index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const assetResponse = await fetch(`${baseUrl}/assets/${assetId}`, { headers: authHeaders });
    if (assetResponse.ok) processedAsset = await assetResponse.json();
    onProgress?.(70 + Math.min(index * 2, 12));
  }

  onProgress?.(84);
  const publishAssetResponse = await fetch(`${baseUrl}/assets/${assetId}/published`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(processedAsset.sys.version)
    },
    method: "PUT"
  });

  if (!publishAssetResponse.ok) {
    throw new Error(`檔案已上傳，但發布 Asset 失敗：${await readError(publishAssetResponse)}`);
  }

  const publishedAsset = await publishAssetResponse.json();
  const url = assetUrl(publishedAsset, locale);
  const hash = await calculateFileHash(input.file);

  onProgress?.(90);
  const createEntryResponse = await fetch(`${baseUrl}/entries`, {
    body: JSON.stringify({
      fields: buildMediaEntryFields({
        category: input.category || "",
        contentType,
        contentTypeId,
        fileSize: input.file.size,
        hash,
        locale,
        note: appendAssetNote(input.note || "", assetId),
        ref: input.ref || "",
        title,
        url
      })
    }),
    headers: {
      ...jsonHeaders,
      "X-Contentful-Content-Type": contentTypeId
    },
    method: "POST"
  });

  if (!createEntryResponse.ok) {
    return {
      assetId,
      contentTypeId,
      entryId: "",
      fileName: input.fileName,
      fileSize: input.file.size,
      fileType: contentType,
      hash,
      locale,
      message: `檔案已上傳，但建立資料失敗：${await readError(createEntryResponse)}`,
      partial: true,
      url
    };
  }

  const createdEntry = await createEntryResponse.json();
  const publishEntryResponse = await fetch(`${baseUrl}/entries/${createdEntry.sys.id}/published`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(createdEntry.sys.version)
    },
    method: "PUT"
  });

  if (!publishEntryResponse.ok) {
    return {
      assetId,
      contentTypeId,
      entryId: createdEntry.sys.id,
      fileName: input.fileName,
      fileSize: input.file.size,
      fileType: contentType,
      hash,
      locale,
      message: "檔案與資料已建立，但發布資料失敗。",
      partial: true,
      url
    };
  }

  onProgress?.(100);
  return {
    assetId,
    contentTypeId,
    entryId: createdEntry.sys.id,
    fileName: input.fileName,
    fileSize: input.file.size,
    fileType: contentType,
    hash,
    locale,
    url
  };
}

function uploadFileToContentful(url: string, file: File, contentType: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("上傳到 Contentful 時連線中斷，請重新上傳。"));
    xhr.ontimeout = () => reject(new Error("上傳等待超時，請確認網路後重新上傳。"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上傳到 Contentful 失敗：${xhr.statusText || xhr.status}`));
    };
    xhr.send(file);
  });
}
