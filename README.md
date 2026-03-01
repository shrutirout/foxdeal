# FoxDeal

Price tracker for Indian e-commerce. Search a product by name, see it across Amazon, Flipkart, Myntra, Croma, and more — then pick what to track. Get email alerts when prices drop, and ask AI to analyse whether the deal is worth it.

## What it does

- **Search by name** — type a product name and Serper finds real Google listings from verified Indian e-commerce sites. No scraping until you decide to track something.
- **Compare by URL** — paste a product URL and we scrape it, then use Serper to find the same product on other platforms for comparison.
- **Progressive tracking** — select which listings to track. Products are scraped and added one by one with a live progress counter (1/4, 2/4...).
- **Deal scoring** — each tracked product is scored 0–100 based on product rating, review count, seller trust, and platform reliability.
- **Price history charts** — see how a product's price has moved over time.
- **Daily price checks** — a cron job re-scrapes all tracked products and sends email alerts when prices drop.
- **AI deal verdict** — on-demand analysis of whether the current deal is worth it. Factors in deal score, MRP discount, ratings, and price history if available. Only runs when you ask for it.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Frontend | React 19, Tailwind CSS 4, Shadcn UI |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Product search | Serper (Google search API, 2500 free queries on signup) |
| Scraping | Firecrawl (AI-powered structured extraction) |
| AI analysis | Google Gemini 2.5 Flash |
| Email | Resend |
| Charts | Recharts |

## Project structure

```
app/
  page.jsx              main dashboard
  actions.js            all server actions
  layout.js             root layout
  auth/callback/        oauth callback
  api/cron/             daily price check endpoint
  api/test-email/       email test endpoint

components/
  AddProductForm.js     search/url tabs + progressive adding UI
  ProductCard.js        tracked product with chart and AI verdict
  ProductComparisonModal.js   shows Serper results + scraped original
  PriceChart.js         price history chart
  AuthButton.js         sign in/out
  AuthModal.js          email/google auth

lib/
  serper.js             google search via serper.dev
  gemini-ai-verdict.js  on-demand deal analysis via gemini
  firecrawl.js          product scraping with platform configs
  dealScore.js          weighted scoring algorithm
  email.js              price drop email alerts
  utils.js              tailwind utility

utils/supabase/
  server.js             server-side client
  client.js             browser-side client
  middleware.js         session refresh
```

## How the deal score works

Four weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Product rating | 40% | Star rating converted to 0–100 |
| Review count | 30% | Social proof — tiered from 0 (no reviews) to 100 (1000+) |
| Seller trust | 20% | Seller rating or known trusted seller lookup |
| Platform trust | 10% | Baseline per-platform score (Amazon 9.5, Flipkart 9.0, etc.) |

Score labels: 85+ Excellent, 70–84 Good, 55–69 Average, 40–54 Below Average, below 40 Poor.

## Supported platforms

Amazon India, Flipkart, Myntra, Ajio, Tata CLiQ, Croma, Reliance Digital, Vijay Sales, Meesho, JioMart, Nykaa, Pepperfry, FirstCry, Lenskart, boAt, ShopClues.

## Database schema

Two tables, both with Row Level Security:

**products**
- id, user_id, url, name, current_price, currency, image_url
- original_price, seller_name, rating, review_count, platform_domain, deal_score
- created_at, updated_at
- unique on (user_id, url)

**price_history**
- id, product_id, price, currency, checked_at
- cascading delete with parent product

Schema SQL is in `test/supabase-schema.sql`.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd foxdeal
npm install
```

### 2. Get API keys

- **Supabase** — project URL, anon key, service role key from supabase.com
- **Firecrawl** — API key from firecrawl.dev
- **Gemini** — API key from aistudio.google.com/app/apikey
- **Serper** — API key from serper.dev (2500 free queries on signup, no credit card)
- **Resend** — API key from resend.com

### 3. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FIRECRAWL_API_KEY=
GEMINI_API_KEY=
SERPER_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate a cron secret: `openssl rand -base64 32`

### 4. Database

Run `test/supabase-schema.sql` in the Supabase SQL Editor to create both tables, indexes, RLS policies, and the updated_at trigger.

### 5. Auth

In Supabase → Authentication → URL Configuration:
- Site URL: your app URL
- Redirect URL: `{your-url}/auth/callback`

### 6. Run locally

```bash
npm run dev
```

### 7. Cron job

Set up a daily POST to `/api/cron/check-prices` from cron-job.org or similar:
- Method: POST
- Header: `Authorization: Bearer YOUR_CRON_SECRET`
- Frequency: once daily

## Deployment

1. Push to GitHub
2. Import on vercel.com
3. Add all env vars
4. Deploy
5. Update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs with the production domain

## License

MIT
