# FoxDeal

Price tracker for Indian e-commerce. Search a product by name, see it across Amazon, Flipkart, Myntra, Croma, and more, then pick what to track. Get email alerts when prices drop, and ask AI to analyse whether the deal is worth it. Project is live and deployed at : [foxdeal.vercel.app]

## What it does

- **Search by name** - type a product name and Serper finds real Google listings from verified Indian e-commerce sites. No scraping until you decide to track something.
- **Search by URL** - paste a product URL and we scrape it and track it directly.
- **Progressive tracking** - select which listings to track. Products are scraped and added one by one with a live progress counter (1/4, 2/4...).
- **Deal scoring** - each tracked product is scored 0-100 based on product rating, review count, seller trust, and platform reliability.
- **Price history charts** - see how a product's price has moved over time.
- **Daily price checks** - a cron job re-scrapes all tracked products and sends email alerts when prices drop.
- **AI deal verdict** - on-demand analysis of whether the current deal is worth it. Factors in deal score, MRP discount, ratings, and price history if available. Only runs when you ask for it.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Frontend | React 19, Tailwind CSS 4, Shadcn UI |
| Auth | Clerk (email/password + Google OAuth) |
| Database | Neon (serverless PostgreSQL) |
| Product search | Serper (web search with site: operators, 2500 free queries on signup) |
| Scraping | Firecrawl (AI-powered structured extraction) |
| AI analysis | Google Gemini 2.5 Flash |
| Email | Resend |
| Charts | Recharts |
| Deployment | Vercel |

## Project structure

```
app/
  page.jsx              main dashboard
  actions.js            all server actions
  layout.js             root layout (wrapped in ClerkProvider)
  sso-callback/         Google OAuth redirect handler
  api/cron/             daily price check endpoint
  api/test-email/       email test endpoint

components/
  AddProductForm.js     search/url tabs + progressive adding UI
  ProductCard.js        tracked product with chart and AI verdict
  ProductComparisonModal.js   shows shopping search results
  PriceChart.js         price history chart
  AuthButton.js         sign in/out (Clerk)
  AuthModal.js          email/password + Google OAuth modal

lib/
  db.js                 Neon serverless client (sql tagged template)
  serper.js             google web search via serper.dev
  gemini-ai-verdict.js  on-demand deal analysis via gemini
  firecrawl.js          product scraping with platform configs
  dealScore.js          weighted scoring algorithm
  email.js              price drop email alerts
  utils.js              tailwind utility

proxy.js                Clerk middleware (Next.js 16 convention)
vercel.json             Vercel native cron schedule (2am UTC daily)
```

## How the deal score works

Four weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Product rating | 40% | Star rating converted to 0-100 |
| Review count | 30% | Social proof, tiered from 0 (no reviews) to 100 (1000+) |
| Seller trust | 20% | Seller rating or known trusted seller lookup |
| Platform trust | 10% | Baseline per-platform score (Amazon 9.5, Flipkart 9.0, etc.) |

Score labels: 85+ Excellent, 70-84 Good, 55-69 Average, 40-54 Below Average, below 40 Poor.

## Supported platforms

Amazon India, Flipkart, Myntra, Ajio, Tata CLiQ, Croma, Reliance Digital, Vijay Sales, Snapdeal, Amazon US, eBay, Walmart.

## Database schema

Two tables in Neon PostgreSQL:

**products**
- id, user_id (TEXT - Clerk user ID), url, name, current_price, currency, image_url
- original_price, seller_name, rating, review_count, platform_domain, deal_score
- created_at, updated_at
- unique on (user_id, url)

**price_history**
- id, product_id, price, currency, checked_at
- cascading delete with parent product

Security is enforced at the application layer: every query includes `WHERE user_id = $userId`.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd foxdeal
npm install
```

### 2. Get API keys

- **Clerk** - publishable key + secret key from clerk.com (create an app, enable Email + Password sign-in)
- **Neon** - DATABASE_URL (pooled connection string) from neon.tech
- **Firecrawl** - API key from firecrawl.dev
- **Gemini** - API key from aistudio.google.com/app/apikey
- **Serper** - API key from serper.dev (2500 free queries on signup, no credit card)
- **Resend** - API key from resend.com

### 3. Environment variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
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

Run this in the Neon SQL Editor to create both tables, indexes, and the updated_at trigger:

```sql
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  image_url TEXT,
  original_price DECIMAL(10,2),
  seller_name TEXT,
  rating DECIMAL(3,2),
  review_count INTEGER DEFAULT 0,
  platform_domain TEXT,
  deal_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 5. Clerk configuration

In the Clerk dashboard:
- Enable **Email** as a sign-in identifier
- Enable **Password** under authentication factors
- Optionally enable Google OAuth (requires Clerk dashboard config + Google Cloud Console setup)

### 6. Run locally

```bash
npm run dev
```

### 7. Cron job

The cron job is configured in `vercel.json` and runs automatically on Vercel once per day at 2am UTC. No external setup needed.

To trigger it manually:
- URL: `https://your-app.vercel.app/api/cron/check-prices`
- Method: GET or POST
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

## Deployment

1. Push to GitHub
2. Import on vercel.com
3. Add all env vars in Vercel project settings
4. Deploy
5. Update `NEXT_PUBLIC_APP_URL` with the production domain

## License

MIT
