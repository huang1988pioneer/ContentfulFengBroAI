/**
 * Client-side direct upload to Contentful
 * Bypasses server-side API limits for large files
 */

export type ClientUploadSettings = {
  spaceId: string;
  environmentId: string;
  locale: string;
  managementToken: string;
};

export type ClientUploadInput = ClientUploadSettings & {
  kind: string;
  fileName: string;
  contentType: string;
  file: File;
  displayName?: string;
  category?: string;
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

/**
 * Upload media file directly to Contentful from browser
 */
export async function uploadToContentfulDirect(
  input: ClientUploadInput,
  onProgress?: UploadProgressCallback
): Promise<ClientUploadResult> {
  const { spaceId, environmentId, managementToken, locale, file, kind, fileName, contentType } = input;
  const displayName = input.displayName || fileName;
  const category = input.category || "";
  const note = input.note || "";
  const ref = input.ref || "";
  
  const baseUrl = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}`;
  const headers = {
    "Authorization": `Bearer ${managementToken}`,
    "Content-Type": "application/json"
  };

  onProgress?.(10);

  // Step 1: Create asset with upload URL
  const createAssetResponse = await fetch(`${baseUrl}/assets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fields: {
        title: { [locale]: displayName },
        description: { [locale]: note },
        file: {
          [locale]: {
            fileName: fileName,
            contentType: contentType || "application/octet-stream"
          }
        }
      }
    })
  });

  if (!createAssetResponse.ok) {
    const error = await createAssetResponse.text();
    throw new Error(`Failed to create asset: ${error.slice(0, 200)}`);
  }

  const createdAsset = await createAssetResponse.json();
  const assetId = createdAsset.sys.id;
  const uploadUrl = createdAsset.fields.file[locale].upload;

  onProgress?.(25);

  // Step 2: Upload file to Contentful's upload URL
  const uploadResponse = await fetch(`https:${uploadUrl}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || "application/octet-stream"
    },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
  }

  onProgress?.(60);

  // Step 3: Process the asset
  const processResponse = await fetch(`${baseUrl}/assets/${assetId}/files/${locale}/process`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${managementToken}`,
      "X-Contentful-Version": String(createdAsset.sys.version)
    }
  });

  if (!processResponse.ok) {
    const error = await processResponse.text();
    throw new Error(`Failed to process asset: ${error.slice(0, 200)}`);
  }

  onProgress?.(70);

  // Step 4: Wait for processing and get asset details
  let processedAsset = await processResponse.json();
  let retries = 10;
  while (retries > 0 && !processedAsset.fields.file[locale].url) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const getAssetResponse = await fetch(`${baseUrl}/assets/${assetId}`, {
      headers: { "Authorization": `Bearer ${managementToken}` }
    });
    if (getAssetResponse.ok) {
      processedAsset = await getAssetResponse.json();
    }
    retries--;
  }

  onProgress?.(80);

  // Step 5: Publish the asset
  const publishAssetResponse = await fetch(`${baseUrl}/assets/${assetId}/published`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${managementToken}`,
      "X-Contentful-Version": String(processedAsset.sys.version)
    }
  });

  if (!publishAssetResponse.ok) {
    const error = await publishAssetResponse.text();
    throw new Error(`Failed to publish asset: ${error.slice(0, 200)}`);
  }

  const publishedAsset = await publishAssetResponse.json();
  const assetUrl = publishedAsset.fields.file[locale]?.url;
  const finalUrl = assetUrl?.startsWith("//") ? `https:${assetUrl}` : assetUrl || "";

  onProgress?.(85);

  // Step 6: Calculate hash
  const hash = await calculateFileHash(file);

  // Step 7: Create entry for the media
  const contentTypeId = kind === "document" ? "commondocument" : kind;
  const entryFields = buildMediaEntryFields({
    locale,
    title: displayName,
    category,
    note: appendAssetNote(note, assetId),
    ref,
    url: finalUrl,
    contentType: contentType || "application/octet-stream",
    fileSize: file.size,
    hash,
    contentTypeId
  });

  const createEntryResponse = await fetch(`${baseUrl}/entries`, {
    method: "POST",
    headers: {
      ...headers,
      "X-Contentful-Content-Type": contentTypeId
    },
    body: JSON.stringify({ fields: entryFields })
  });

  if (!createEntryResponse.ok) {
    const error = await createEntryResponse.text();
    return {
      assetId,
      contentTypeId,
      entryId: "",
      fileName,
      fileSize: file.size,
      fileType: contentType || "application/octet-stream",
      hash,
      locale,
      message: `Asset uploaded but entry creation failed: ${error.slice(0, 200)}`,
      partial: true,
      url: finalUrl
    };
  }

  const createdEntry = await createEntryResponse.json();
  const entryId = createdEntry.sys.id;

  onProgress?.(95);

  // Step 8: Publish the entry
  const publishEntryResponse = await fetch(`${baseUrl}/entries/${entryId}/published`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${managementToken}`,
      "X-Contentful-Version": String(createdEntry.sys.version)
    }
  });

  if (!publishEntryResponse.ok) {
    return {
      assetId,
      contentTypeId,
      entryId,
      fileName,
      fileSize: file.size,
      fileType: contentType || "application/octet-stream",
      hash,
      locale,
      message: "Entry created but publish failed",
      partial: true,
      url: finalUrl
    };
  }

  onProgress?.(100);

  return {
    assetId,
    contentTypeId,
    entryId,
    fileName,
    fileSize: file.size,
    fileType: contentType || "application/octet-stream",
    hash,
    locale,
    url: finalUrl
  };
}

function buildMediaEntryFields(options: {
  locale: string;
  title: string;
  category: string;
  note: string;
  ref: string;
  url: string;
  contentType: string;
  fileSize: number;
  hash: string;
  contentTypeId: string;
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

function appendAssetNote(note: string, assetId: string, message?: string) {
  const parts = [note, `Contentful Asset ID: ${assetId}`];
  if (message) parts.push(`Upload note: ${message}`);
  return parts.filter(Boolean).join("\n");
}

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
