# IQ Test App - Deployment Guide

## Overview

This is a static React app that uses:
- **Supabase** for database and Edge Functions
- **Stripe** for payments
- **Resend** for emails
- **GitHub Pages** for hosting

## Step 1: Set Up Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/afsoyuczexiztsjntkvi

2. Go to **SQL Editor** and run the schema from `supabase/schema.sql`:
   - This creates the tables: `app_settings`, `tests`, `questions`, `test_sessions`
   - Sets up the admin password
   - Configures Row Level Security policies

## Step 2: Configure Supabase Edge Functions

### Add Environment Variables

Go to **Settings → Edge Functions** and add:

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_51SshGBFIjOFz6lW0ol2zbflOsQmOtOEicgUqW1oXA6PvKiKBooOsPa6gpevkrTOgnd2fQSVTaG3sX2HBXAj3ci8y00gLHrwoal` |
| `RESEND_API_KEY` | Your Resend API key (get from https://resend.com) |

### Deploy Edge Functions

On your computer with Supabase CLI installed:

```bash
cd /path/to/iq_test_static

# Login to Supabase (if not already)
npx supabase login

# Link to your project
npx supabase link --project-ref afsoyuczexiztsjntkvi

# Deploy all functions
npx supabase functions deploy create-checkout
npx supabase functions deploy verify-payment
npx supabase functions deploy send-results-email
```

## Step 3: Deploy to GitHub Pages

### Option A: Using GitHub Actions (Recommended)

1. Create a GitHub repository named `iq-test`

2. Push the code:
```bash
cd /path/to/iq_test_static
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/iq-test.git
git push -u origin main
```

3. Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          
      - run: pnpm install
      - run: pnpm build
      
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. Go to repository **Settings → Pages** and set source to `gh-pages` branch

5. Your app will be at: `https://YOUR_USERNAME.github.io/iq-test/`

### Option B: Manual Deploy

1. Build the app:
```bash
pnpm build
```

2. The `dist` folder contains your static files
3. Upload to any static hosting (Netlify, Vercel, etc.)

## Step 4: Update URLs

After deploying, update the redirect URLs in the Edge Functions:

1. Edit `supabase/functions/create-checkout/index.ts`
2. Change the `origin` fallback to your actual URL:
```typescript
const origin = req.headers.get('origin') || 'https://YOUR_USERNAME.github.io/iq-test';
```
3. Redeploy the function

## Step 5: Test the App

1. Go to your deployed URL
2. Click **Admin** and login with password: `3hB8T3)Vw&Ui`
3. Create a test with questions
4. Activate the test
5. Go back to home and take the test
6. Complete payment (use test card: `4242 4242 4242 4242`)
7. View results and check email

## Troubleshooting

### "No tests available"
- Make sure you've created a test in Admin
- Make sure the test is set to **Active**

### Payment not working
- Check Supabase Edge Function logs
- Verify STRIPE_SECRET_KEY is set correctly
- Make sure the redirect URLs match your domain

### Email not sending
- Check RESEND_API_KEY is set
- Check Resend dashboard for errors
- Verify the email address is valid

### Admin login not working
- Run the SQL schema to create the `app_settings` table
- Check that the password row exists in the database

## File Structure

```
iq_test_static/
├── src/
│   ├── pages/
│   │   ├── Home.tsx        # Landing page
│   │   ├── Admin.tsx       # Admin panel
│   │   ├── Test.tsx        # Test taking
│   │   └── Results.tsx     # Results + payment
│   └── lib/
│       └── supabase.ts     # Supabase client
├── supabase/
│   ├── schema.sql          # Database schema
│   └── functions/
│       ├── create-checkout/    # Stripe checkout
│       ├── verify-payment/     # Payment verification
│       └── send-results-email/ # Email sending
└── dist/                   # Built files (after pnpm build)
```

## Security Notes

- Admin password is stored in Supabase (can be changed in database)
- Stripe secret key is only in Edge Functions (never in frontend)
- All API keys are environment variables
- RLS policies protect database access
