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

export type UploadProgressCallback = (percent: number, label?: string) => void;

type ContentfulSys = {
  id: string;
  version?: number;
};

type ContentfulAsset = {
  fields?: {
    file?: Record<string, { url?: string }>;
  };
  sys: ContentfulSys;
};

type ContentfulEntry = {
  sys: ContentfulSys;
};

const CONTENTFUL_API = "https://api.contentful.com";
const CONTENTFUL_UPLOAD_API = "https://upload.contentful.com";

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

function assetUrl(asset: ContentfulAsset | null, locale: string) {
  const raw = asset?.fields?.file?.[locale]?.url ?? "";
  if (!raw) return "";
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
  
  if (options.contentTypeId === "music") {
    fields.cover = { [options.locale]: "" };
    fields.lyrics = { [options.locale]: "" };
    fields.language = { [options.locale]: "" };
  }
  
  if (["commondocument", "podcast"].includes(options.contentTypeId)) {
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

async function readResponseText(response: Response) {
  return (await response.text()).replace(/\s+/g, " ").trim();
}

function compactContentfulError(prefix: string, response: Response, detail: string) {
  const safeDetail = detail || response.statusText || String(response.status);
  return `${prefix} (${response.status}): ${safeDetail.slice(0, 260)}`;
}

async function readJson<T>(response: Response, prefix: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(compactContentfulError(prefix, response, text.replace(/\s+/g, " ").trim()));
  }

  if (!text.trim()) {
    throw new Error(`${prefix}: Contentful returned an empty response.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${prefix}: Contentful returned a non-JSON response.`);
  }
}

async function requestOk(response: Response, prefix: string) {
  if (response.ok) return;
  throw new Error(compactContentfulError(prefix, response, await readResponseText(response)));
}

function uploadToContentfulUploadApi(
  url: string,
  token: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return new Promise<{ sys: ContentfulSys }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("上傳到 Contentful 的連線中斷，請確認網路後再試。"));
    xhr.ontimeout = () => reject(new Error("上傳等待逾時，請改用較小檔案或稍後再試。"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Contentful Upload API 拒絕檔案 (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
        return;
      }

      try {
        resolve(JSON.parse(xhr.responseText || "{}") as { sys: ContentfulSys });
      } catch {
        reject(new Error("Contentful Upload API 回傳格式不正確，請重新上傳。"));
      }
    };
    xhr.send(file);
  });
}

async function pollAssetForUrl(baseUrl: string, headers: HeadersInit, assetId: string, locale: string, onProgress?: UploadProgressCallback) {
  let latest: ContentfulAsset | null = null;

  // Poll for up to 60 seconds (increased from 18)
  for (let index = 0; index < 60; index += 1) {
    const response = await fetch(`${baseUrl}/assets/${assetId}`, { headers });
    if (response.ok) {
      latest = (await response.json()) as ContentfulAsset;
      const url = assetUrl(latest, locale);
      if (url) {
        onProgress?.(85, "Asset ready");
        return latest;
      }
    }
    
    // Update progress every 3 seconds
    if (index % 3 === 0) {
      const progressPercent = 70 + Math.min(Math.floor(index / 4), 15);
      onProgress?.(progressPercent, `Processing (${index}s)`);
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // If still no URL after 60 seconds, throw error
  if (!latest || !assetUrl(latest, locale)) {
    throw new Error("Contentful 處理檔案超時（60秒）。檔案可能太大或 Contentful 服務繁忙，請稍後再試或使用較小檔案。");
  }

  return latest;
}

export async function uploadToContentfulDirect(
  input: ClientUploadInput,
  onProgress?: UploadProgressCallback
): Promise<ClientUploadResult> {
  const token = normalizeToken(input.managementToken);
  if (!token) throw new Error("缺少 Contentful Management Token，請先在鋒兄設定填入或部署環境變數。");
  if (!input.spaceId) throw new Error("缺少 Contentful Space ID。");

  const environmentId = input.environmentId || "master";
  const locale = input.locale || "en-US";
  const contentType = input.contentType || "application/octet-stream";
  const contentTypeId = contentTypeIdForKind(input.kind);
  const title = input.displayName || input.fileName;
  
  // Truncate filename if too long
  // Based on testing: Chinese characters ~17 chars work reliably
  // Use conservative limit: 50 chars (safe for mixed CN/EN/symbols)
  let fileName = input.fileName;
  if (fileName.length > 50) {
    const ext = fileName.split('.').pop() || '';
    const nameWithoutExt = fileName.substring(0, fileName.length - ext.length - 1);
    const maxNameLength = 50 - ext.length - 1; // -1 for the dot
    fileName = nameWithoutExt.substring(0, maxNameLength) + '.' + ext;
  }
  
  const baseUrl = `${CONTENTFUL_API}/spaces/${input.spaceId}/environments/${environmentId}`;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/vnd.contentful.management.v1+json" };

  onProgress?.(4, "Preparing upload");
  const upload = await uploadToContentfulUploadApi(
    `${CONTENTFUL_UPLOAD_API}/spaces/${input.spaceId}/uploads`,
    token,
    input.file,
    (percent) => onProgress?.(4 + Math.round(percent * 0.2), "Uploading file")
  );

  onProgress?.(24, "Creating asset");
  const createAssetResponse = await fetch(`${baseUrl}/assets`, {
    body: JSON.stringify({
      fields: {
        title: { [locale]: title },
        description: { [locale]: input.note || "" },
        file: {
          [locale]: {
            contentType,
            fileName: fileName,
            uploadFrom: {
              sys: {
                type: "Link",
                linkType: "Upload",
                id: upload.sys.id
              }
            }
          }
        }
      }
    }),
    headers: jsonHeaders,
    method: "POST"
  });
  const createdAsset = await readJson<ContentfulAsset>(createAssetResponse, "建立 Contentful Asset 失敗");
  const assetId = createdAsset.sys.id;

  onProgress?.(40, "Processing asset");
  const processResponse = await fetch(`${baseUrl}/assets/${assetId}/files/${locale}/process`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(createdAsset.sys.version ?? 1)
    },
    method: "PUT"
  });
  await requestOk(processResponse, "Contentful 處理檔案失敗");

  const processedAsset = await pollAssetForUrl(baseUrl, authHeaders, assetId, locale, onProgress);
  
  // Ensure we have a URL before publishing
  const url = assetUrl(processedAsset, locale);
  if (!url) {
    throw new Error("Contentful Asset 已建立但未能取得檔案 URL。請稍後在 Contentful Media 中檢查此 Asset。");
  }
  
  const latestVersion = processedAsset.sys.version ?? createdAsset.sys.version ?? 1;

  onProgress?.(86, "Publishing asset");
  const publishAssetResponse = await fetch(`${baseUrl}/assets/${assetId}/published`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(latestVersion)
    },
    method: "PUT"
  });
  await requestOk(publishAssetResponse, "發布 Contentful Asset 失敗");

  const publishedAssetResponse = await fetch(`${baseUrl}/assets/${assetId}`, { headers: authHeaders });
  const publishedAsset = publishedAssetResponse.ok ? ((await publishedAssetResponse.json()) as ContentfulAsset) : processedAsset;
  const finalUrl = assetUrl(publishedAsset, locale);
  const hash = await calculateFileHash(input.file);
  const missingUrlMessage = finalUrl
    ? undefined
    : "Asset 已建立，但 Contentful 尚未產生檔案 URL；資料會先建立，稍後可重新載入確認。";

  onProgress?.(92, "Creating entry");
  const createEntryResponse = await fetch(`${baseUrl}/entries`, {
    body: JSON.stringify({
      fields: buildMediaEntryFields({
        category: input.category || "",
        contentType,
        contentTypeId,
        fileSize: input.file.size,
        hash,
        locale,
        note: appendAssetNote(input.note || "", assetId, missingUrlMessage),
        ref: input.ref || "",
        title,
        url: finalUrl
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
      fileName: fileName,
      fileSize: input.file.size,
      fileType: contentType,
      hash,
      locale,
      message: `檔案已上傳，但建立資料失敗：${await readResponseText(createEntryResponse)}`,
      partial: true,
      url: finalUrl
    };
  }

  const createdEntry = (await createEntryResponse.json()) as ContentfulEntry;

  onProgress?.(97, "Publishing entry");
  const publishEntryResponse = await fetch(`${baseUrl}/entries/${createdEntry.sys.id}/published`, {
    headers: {
      ...authHeaders,
      "X-Contentful-Version": String(createdEntry.sys.version ?? 1)
    },
    method: "PUT"
  });

  if (!publishEntryResponse.ok) {
    return {
      assetId,
      contentTypeId,
      entryId: createdEntry.sys.id,
      fileName: fileName,
      fileSize: input.file.size,
      fileType: contentType,
      hash,
      locale,
      message: `資料已建立，但發布失敗：${await readResponseText(publishEntryResponse)}`,
      partial: true,
      url: finalUrl
    };
  }

  onProgress?.(100, "Complete");
  return {
    assetId,
    contentTypeId,
    entryId: createdEntry.sys.id,
    fileName: fileName,
    fileSize: input.file.size,
    fileType: contentType,
    hash,
    locale,
    message: missingUrlMessage,
    partial: Boolean(missingUrlMessage),
    url: finalUrl
  };
}
