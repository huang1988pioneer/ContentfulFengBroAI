# ContentfulFengBroAI

SolidStart app with Contentful environment variables mapped through server-side
configuration helpers.

## Setup

Copy `.env.example` to `.env.local` and fill in your Contentful values:

```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ENVIRONMENT_ID=master
CONTENTFUL_DELIVERY_TOKEN=your_delivery_api_token
CONTENTFUL_PREVIEW_TOKEN=your_preview_api_token
CONTENTFUL_MANAGEMENT_TOKEN=your_management_api_token
CONTENTFUL_LOCALE=en-US
```

`CONTENTFUL_MANAGEMENT_TOKEN` is only required for content type/table
initialization endpoints.

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

The Contentful mapping lives in `src/lib/env.ts`, the reusable delivery and
preview clients live in `src/lib/contentful.ts`, and the optional content type
initializer uses `CONTENTFUL_MANAGEMENT_TOKEN`.
