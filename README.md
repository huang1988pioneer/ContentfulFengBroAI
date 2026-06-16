# ContentfulFengBroAI

SolidStart app with Contentful environment variables mapped through server-side
configuration helpers.

## Features

- **Direct Browser-to-Contentful Upload**: Upload large files (up to 1GB for paid accounts) directly from browser, bypassing deployment platform limits
- **Contentful CRUD Workspace**: Full CRUD operations for all FengBro content types
- **CSV Import/Export**: Batch import and export entries via CSV
- **Table Management**: Initialize and manage Contentful content types
- **Multi-language Support**: Configurable locale support

## Setup

### Local Development

Copy `.env.example` to `.env` and fill in your Contentful values:

```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ENVIRONMENT_ID=master
CONTENTFUL_DELIVERY_TOKEN=your_delivery_api_token
CONTENTFUL_PREVIEW_TOKEN=your_preview_api_token
CONTENTFUL_MANAGEMENT_TOKEN=your_management_api_token
CONTENTFUL_LOCALE=zh-TW
```

### Production (Vercel)

Set environment variables in your Vercel project settings:
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ENVIRONMENT_ID`
- `CONTENTFUL_DELIVERY_TOKEN`
- `CONTENTFUL_PREVIEW_TOKEN`
- `CONTENTFUL_MANAGEMENT_TOKEN`
- `CONTENTFUL_LOCALE`

After setting environment variables, trigger a new deployment for changes to take effect.

### Browser Settings (Alternative)

You can also configure settings directly in the web interface without environment variables:
1. Navigate to the home page
2. Fill in the settings form (Space ID, Management Token, etc.)
3. Click "Save Settings"
4. Settings are stored in browser localStorage

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Architecture

- `src/lib/env.ts` - Contentful environment variable mapping
- `src/lib/contentful.ts` - Delivery and preview clients
- `src/lib/contentful-management.ts` - Management API for content type initialization and CRUD
- `src/lib/contentful-client-upload.ts` - Direct browser-to-Contentful upload (bypasses server limits)

## Requirements

- Node.js 18+
- Contentful account with Management API access
- For large file uploads: Contentful paid plan (1GB limit) or free plan (50MB limit)


