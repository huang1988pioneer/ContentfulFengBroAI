# ContentfulFengBroAI 設定指南

本指南將協助您完成所有三種設定方法。

## 方法 1：本地開發環境設定 (.env)

### 步驟 1：編輯 .env 檔案

已為您創建 `.env` 檔案，請用文字編輯器開啟並填入您的 Contentful 資訊：

```bash
# 替換以下值為您的實際 Contentful 資訊
CONTENTFUL_SPACE_ID=your_space_id_here
CONTENTFUL_ENVIRONMENT_ID=master
CONTENTFUL_DELIVERY_TOKEN=your_delivery_token_here
CONTENTFUL_PREVIEW_TOKEN=your_preview_token_here
CONTENTFUL_MANAGEMENT_TOKEN=your_management_token_here
CONTENTFUL_LOCALE=zh-TW
```

### 步驟 2：取得 Contentful Token

1. 前往 [Contentful](https://app.contentful.com/)
2. 選擇您的 Space
3. 進入 **Settings** → **API keys**
4. 創建或選擇一個 API key
5. 複製以下資訊：
   - **Space ID**
   - **Content Delivery API - access token** (Delivery Token)
   - **Content Preview API - access token** (Preview Token)

6. 若要取得 Management Token：
   - 進入 **Settings** → **CMA tokens**
   - 點擊 **Generate personal access token**
   - 給予描述名稱（如 "FengBro Local Dev"）
   - 複製 token（**只會顯示一次！**）

### 步驟 3：啟動本地開發伺服器

```bash
npm run dev
```

訪問 `http://localhost:3000`

---

## 方法 2：Vercel 生產環境設定

### ✅ 已完成

從您的截圖來看，Vercel 環境變數已經設定完成：
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ENVIRONMENT_ID`
- `CONTENTFUL_DELIVERY_TOKEN`
- `CONTENTFUL_PREVIEW_TOKEN`
- `CONTENTFUL_MANAGEMENT_TOKEN`
- `NODE_ENV`

### 步驟：觸發重新部署

剛剛推送的更新會自動觸發 Vercel 部署。您可以：

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇 `contentful-feng-bro-ai` 專案
3. 查看 **Deployments** 頁面
4. 等待最新部署完成（約 1-2 分鐘）
5. 部署完成後，環境變數將生效

---

## 方法 3：網頁介面直接設定（最快）

這是**最快速的方法**，不需要等待部署。

### 步驟 1：訪問您的應用

前往：https://contentful-feng-bro-ai.vercel.app/

### 步驟 2：填寫設定表單

在首頁找到設定表單，填入以下資訊：

1. **Space ID**：您的 Contentful Space ID
2. **Environment ID**：通常是 `master`
3. **Delivery Access Token**：您的 Delivery API token
4. **Preview Access Token**：您的 Preview API token
5. **Management Token**：您的 Management API token（**上傳功能必需**）
6. **Locale**：語言設定（如 `zh-TW` 或 `en-US`）

### 步驟 3：儲存設定

點擊 **"儲存設定"** 按鈕。

設定會儲存在瀏覽器的 localStorage 中，下次訪問時會自動載入。

### 步驟 4：測試上傳功能

1. 導航到 CRUD 工作區
2. 選擇媒體類型（如"鋒兄影片"）
3. 點擊上傳按鈕
4. 選擇檔案並填寫資訊
5. 點擊 **"上傳媒體檔案"**

---

## 上傳檔案大小限制

### Contentful 限制
- **免費帳號**：最高 50 MB
- **付費帳號**：最高 1 GB (1000 MB)
- **圖片檔案**：最高 100 MB（超過會被視為一般資產）

### 直接上傳的優勢
現在使用**直接從瀏覽器上傳到 Contentful** 的方式，完全繞過部署平台（Vercel/Netlify）的 4-6 MB 限制。

---

## 疑難排解

### 錯誤：Management token is required
**原因**：未設定 Management Token

**解決方法**：
- 使用方法 3 在網頁介面直接輸入 token（最快）
- 或等待 Vercel 部署完成（如果已設定環境變數）

### 錯誤：Access token invalid
**原因**：Token 格式不正確或包含多餘字元

**解決方法**：
- 確認 token 沒有前後空格
- 不要包含 "Bearer" 前綴
- 重新從 Contentful 複製 token

### 上傳失敗：檔案太大
**原因**：超過 Contentful 帳號限制

**解決方法**：
- 免費帳號：使用小於 50 MB 的檔案
- 付費帳號：可上傳最高 1 GB
- 或先上傳到外部儲存（S3、Cloudflare R2），再填入 URL

---

## 檢查清單

完成所有三種方法的設定：

- [ ] **方法 1**：本地 `.env` 檔案已填入正確的值
- [ ] **方法 2**：Vercel 環境變數已設定並重新部署
- [ ] **方法 3**：網頁介面已填寫並儲存設定

測試上傳功能：

- [ ] 可以訪問 CRUD 工作區
- [ ] 可以選擇媒體類型
- [ ] 可以成功上傳小檔案（< 10 MB）
- [ ] 可以成功上傳大檔案（> 10 MB，需付費帳號）

---

## 下一步

設定完成後，您可以：

1. **初始化表格**：在設定頁面點擊 "Initialize All Tables"
2. **匯入資料**：使用 CSV 匯入功能批次匯入資料
3. **上傳媒體**：上傳圖片、影片、音樂等檔案
4. **CRUD 操作**：新增、編輯、刪除 entries

祝使用愉快！🎉
