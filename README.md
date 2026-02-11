# FoxDeal

AI-powered price tracker that monitors products across 20+ Indian and international e-commerce platforms. Track prices, compare deals across sites, and get email alerts when prices drop.

## What it does

- **Track products** by pasting a URL from Amazon, Flipkart, Myntra, or any supported store
- **Smart search** by typing a product name -- Gemini AI finds it across multiple platforms automatically
- **Deal scoring** algorithm rates every product on a 0-100 scale based on rating, reviews, seller trust, and platform reliability
- **Cross-platform comparison** shows the same product on different sites side by side, sorted by deal score
- **Daily price checks** via a cron job that scrapes all tracked products and sends email alerts on price drops
- **Price history charts** to visualize how a product's price has moved over time

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Frontend | React 19, Tailwind CSS 4, Shadcn UI |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Scraping | Firecrawl (AI-powered extraction) |
| AI | Google Gemini 2.5 Flash |
| Email | Resend |
| Charts | Recharts |

## Project structure

```
app/
  page.jsx              main dashboard
  actions.js            server actions (all backend logic)
  layout.js             root layout with toaster
  auth/callback/        oauth callback handler
  api/cron/             daily price check endpoint
  api/test-email/       email testing endpoint
  error/                auth error page

components/
  AddProductForm.js     url input + smart search tabs
  ProductCard.js        tracked product display with chart toggle
  ProductComparisonModal.js   cross-platform comparison view
  ProductPreviewModal.js      product preview before tracking
  PriceChart.js         price history line chart
  AuthButton.js         sign in / sign out
  AuthModal.js          email + google auth dialog
  ui/                   shadcn primitives

lib/
  firecrawl.js          scraping with platform-specific configs
  dealScore.js          weighted scoring algorithm
  gemini.js             cross-platform url discovery via ai
  gemini-search-working.js   smart search via search page scraping
  email.js              price drop alert emails
  utils.js              tailwind class merging utility

utils/supabase/
  server.js             server-side supabase client
  client.js             browser-side supabase client
  middleware.js          session refresh middleware
```

## How the deal score works

Every product gets a score from 0 to 100 using four weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Product rating | 40% | Customer star rating converted to 0-100 |
| Review count | 30% | Social proof -- tiered scoring from 0 (no reviews) to 100 (1000+ reviews) |
| Seller trust | 20% | Seller rating from the platform, or a lookup against known trusted sellers |
| Platform trust | 10% | Baseline trust score per platform (Amazon 9.5, Flipkart 9.0, etc.) |

Score labels: 85+ Excellent, 70-84 Good, 55-69 Average, 40-54 Below Average, below 40 Poor.

## Supported platforms

Amazon.in, Flipkart, Myntra, Ajio, Tata CLiQ, Croma, Reliance Digital, Vijay Sales, Snapdeal, Nykaa, BigBasket, Lenskart, FirstCry, Pepperfry, boAt, Amazon.com, Walmart, eBay, and more.

## Database schema

Two tables with Row Level Security enabled:

**products** -- stores tracked products per user
- id, user_id, url, name, current_price, currency, image_url
- original_price, seller_name, rating, review_count, platform_domain, deal_score
- created_at, updated_at
- unique constraint on (user_id, url)

**price_history** -- records every price check
- id, product_id, price, currency, checked_at
- cascading delete when parent product is removed

Schema SQL is in `test/supabase-schema.sql`.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd foxdeal
npm install
```

### 2. Create accounts and get API keys

- **Supabase** -- create a project at supabase.com, grab Project URL, anon key, and service role key
- **Firecrawl** -- sign up at firecrawl.dev for scraping API key
- **Gemini** -- get an API key at aistudio.google.com/app/apikey
- **Resend** -- sign up at resend.com for email API key

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FIRECRAWL_API_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate a cron secret with `openssl rand -base64 32`.

### 4. Set up the database

Open the Supabase SQL Editor and run the contents of `test/supabase-schema.sql`. This creates both tables, indexes, RLS policies, and the updated_at trigger.

### 5. Configure auth

In Supabase dashboard under Authentication > URL Configuration:
- Set Site URL to your app URL
- Add redirect URL: `{your-url}/auth/callback`

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

### 7. Set up the cron job

The daily price checker runs at `POST /api/cron/check-prices` with a Bearer token.

For production, use an external cron service like cron-job.org:
- URL: `https://your-domain.com/api/cron/check-prices`
- Method: POST
- Header: `Authorization: Bearer YOUR_CRON_SECRET`
- Schedule: once daily

Test it manually:
```bash
curl -X POST http://localhost:3000/api/cron/check-prices \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Deployment

Works out of the box on Vercel:

1. Push to GitHub
2. Import the repo on vercel.com
3. Add all environment variables from `.env.local`
4. Deploy
5. Update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs with the production domain

## License

MIT
