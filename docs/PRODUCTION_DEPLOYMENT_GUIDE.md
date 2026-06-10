# Production Deployment Guide

This guide walks through the complete setup process for deploying AgriData Technologies to production with separate development and production environments.

## 📋 Overview

We use a two-environment strategy:
- **Development**: `develop` branch → Preview deployments (testing)
- **Production**: `main` branch → Production deployments (live users)

---

## 🎯 Phase 1: Infrastructure Setup

### 1.1 Production Supabase Project

**Action Required:** Create a new production Supabase project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project:
   - Name: `agridata-ai-production`
   - Database password: (generate secure password)
   - Region: Choose closest to your users
3. Save these credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

**Note:** Keep your existing Supabase project for development

---

### 1.2 Production Database

**Option A: Use Supabase's built-in PostgreSQL** (Recommended)
- Your production Supabase project includes a PostgreSQL database
- Connection string found in: Project Settings → Database → Connection string (URI)
- Save as: `DATABASE_URL`

**Option B: Separate PostgreSQL instance**
- Provision a dedicated PostgreSQL instance (e.g., AWS RDS, Azure Database)
- Ensure it's accessible from Vercel's deployment regions
- Save connection string as: `DATABASE_URL`

---

## 🎯 Phase 2: Azure DevOps Configuration

### 2.1 Create Variable Groups

You need to create **two variable groups** in Azure DevOps:

#### Development Variable Group: `Vercel-Deploy-Variables-Dev`

1. Go to Azure DevOps → Pipelines → Library
2. Click "+ Variable group"
3. Name: `Vercel-Deploy-Variables-Dev`
4. Add these variables:

| Variable | Value | Secret? |
|----------|-------|---------|
| `VERCEL_TOKEN` | Your Vercel token | ✅ Yes |
| `VERCEL_ORG_ID` | Your Vercel org ID | No |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | No |
| `DATABASE_URL` | Development DB URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Dev Supabase URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev Supabase service key | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | Dev app URL (e.g., https://agridata-dev.vercel.app) | No |
| `TWILIO_ACCOUNT_SID` | Twilio SID | ✅ Yes |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | ✅ Yes |
| `TWILIO_PHONE_NUMBER` | whatsapp:+263713618310 | No |

#### Production Variable Group: `Vercel-Deploy-Variables-Prod`

1. Create another variable group
2. Name: `Vercel-Deploy-Variables-Prod`
3. Add these variables (same structure, different values):

| Variable | Value | Secret? |
|----------|-------|---------|
| `VERCEL_TOKEN` | Same as dev | ✅ Yes |
| `VERCEL_ORG_ID` | Same as dev | No |
| `VERCEL_PROJECT_ID` | Same as dev (or different if separate projects) | No |
| `DATABASE_URL` | **Production DB URL** | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | **Prod Supabase URL** | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Prod Supabase anon key** | No |
| `SUPABASE_SERVICE_ROLE_KEY` | **Prod Supabase service key** | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | **Prod app URL (e.g., https://agridata.ai)** | No |
| `TWILIO_ACCOUNT_SID` | Same as dev | ✅ Yes |
| `TWILIO_AUTH_TOKEN` | Same as dev | ✅ Yes |
| `TWILIO_PHONE_NUMBER` | Same as dev | No |

---

### 2.2 Create Pipelines

#### Create Development Pipeline

1. Go to Azure DevOps → Pipelines → New Pipeline
2. Select your repository
3. Choose "Existing Azure Pipelines YAML file"
4. Path: `/azure-pipelines-dev.yml`
5. Branch: `develop`
6. Click "Run" to test

#### Create Production Pipeline

1. Go to Azure DevOps → Pipelines → New Pipeline
2. Select your repository
3. Choose "Existing Azure Pipelines YAML file"
4. Path: `/azure-pipelines-prod.yml`
5. Branch: `main`
6. Click "Run" to test

#### Configure Branch Policies (Recommended)

Protect your `main` branch:
1. Go to Repos → Branches
2. Click on `main` → Branch policies
3. Enable:
   - ✅ Require a minimum number of reviewers (recommend 1)
   - ✅ Build validation (select your production pipeline)
   - ✅ Limit merge types to "Squash merge only" (optional)

---

## 🎯 Phase 3: Vercel Configuration

### 3.1 Configure Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your AgriData Technologies project
3. Go to Settings → Git

#### Production Branch Configuration
- **Production Branch:** Set to `main`
- This ensures only `main` triggers production deployments

#### Preview Branch Configuration
- Enable "Automatic Deployments" for `develop` branch
- This creates preview deployments for testing

### 3.2 Environment Variables in Vercel

Set environment variables directly in Vercel for better control:

1. Go to Settings → Environment Variables
2. Add variables for each environment:

**Production Environment:**
- Select "Production" only
- Add all production values (matching your Azure DevOps prod group)

**Preview Environment:**
- Select "Preview" only
- Add all development values (matching your Azure DevOps dev group)

**Note:** Azure pipelines will also pass environment variables, but setting them in Vercel provides a fallback.

---

## 🎯 Phase 4: Database Setup

### 4.1 Run Production Migrations

**Important:** This should be done AFTER production database is provisioned.

```bash
# Option A: From local machine (pointing to prod DB)
export DATABASE_URL="your-production-database-url"
pnpm db:migrate

# Option B: Let Azure pipeline handle it
# (Pipeline automatically runs migrations on deployment)
```

### 4.2 Seed Production Data

After migrations, seed required data:

```bash
# Seed workflows (required for WhatsApp bot)
export DATABASE_URL="your-production-database-url"
pnpm run seed:workflows

# Create admin user
pnpm run bootstrap-admin
```

**Note:** Do NOT seed test data in production!

---

## 🎯 Phase 5: Twilio Configuration

### 5.1 Update Webhook URLs

Your WhatsApp number `+263713618310` needs separate webhook configurations:

#### Development Webhook
1. Go to Twilio Console → Messaging → Senders
2. Select your WhatsApp sender
3. Under "Sandbox settings" or development configuration:
   - Webhook URL: `https://your-dev-domain.vercel.app/api/webhooks/whatsapp`
   - Method: POST

#### Production Webhook
1. In Twilio Console → Messaging → Senders
2. Select your WhatsApp sender (`+263713618310`)
3. Under "A MESSAGE COMES IN":
   - Webhook URL: `https://your-production-domain.com/api/webhooks/whatsapp`
   - Method: POST

**Note:** The webhook route now uses the actual request URL for signature validation, ensuring an exact match with what Twilio sees. The `NEXT_PUBLIC_APP_URL` environment variable is still required for other parts of the application (e.g., invite links), but the webhook signature validation no longer depends on it matching exactly.

---

## 🎯 Phase 6: Deployment Workflow

### Automated Deployment Flow

The pipelines are configured for **automatic continuous deployment**:

**Development → Production Flow:**

```
1. Push to develop branch
   ↓
2. Dev pipeline triggers automatically
   ↓
3. Build & deploy to Vercel preview
   ↓
4. If successful → Auto-merge develop to main
   ↓
5. Prod pipeline triggers automatically
   ↓
6. Build & deploy to Vercel production
```

**No manual PR needed!** The system automatically promotes successful preview deployments to production.

### Development Workflow

```
1. Create feature branch from develop
2. Make changes & test locally
3. Push to feature branch
4. Create PR to develop
5. Review & merge to develop
6. Auto-deployment starts:
   - Preview deployed
   - If successful, auto-merged to main
   - Production deployed
```

### Manual Production Control (If Needed)

If you need to pause auto-deployment:
1. Comment out the auto-merge step in `azure-pipelines-dev.yml`
2. Manually merge develop to main when ready
3. Production pipeline will still trigger automatically

---

## ✅ Pre-Launch Checklist

Before launching to production, verify:

### Infrastructure
- [ ] Production Supabase project created
- [ ] Production database provisioned
- [ ] Connection strings secured

### Azure DevOps
- [ ] `Vercel-Deploy-Variables-Dev` variable group created
- [ ] `Vercel-Deploy-Variables-Prod` variable group created
- [ ] Development pipeline configured and tested
- [ ] Production pipeline configured and tested
- [ ] Branch policies enabled on `main`

### Vercel
- [ ] Production branch set to `main`
- [ ] Preview deployments enabled for `develop`
- [ ] Environment variables configured
- [ ] Custom domain configured (if applicable)

### Database
- [ ] Migrations run on production database
- [ ] Workflows seeded
- [ ] Admin user created
- [ ] No test data in production

### Twilio
- [ ] Production webhook URL configured
- [ ] Webhook URL matches `NEXT_PUBLIC_APP_URL`
- [ ] Test message sent successfully

### Testing
- [ ] Send test WhatsApp message
- [ ] Verify webhook receives message (check logs)
- [ ] Complete full reporting flow
- [ ] Verify report appears in dashboard
- [ ] Test admin login
- [ ] Test organization creation

---

## 🚨 Troubleshooting

### Pipeline Fails on Migration Step
- Ensure `DATABASE_URL` is set correctly in variable group
- Verify database is accessible from Azure DevOps agents
- Check migration files in `drizzle/` directory

### Webhook Returns 401 Unauthorized
- Verify `NEXT_PUBLIC_APP_URL` matches webhook URL exactly
- Include `https://` in the URL
- Check Twilio signature validation in logs

### Vercel Deployment Fails
- Verify all environment variables are set
- Check build logs for missing dependencies
- Ensure Node.js version matches (18.x)

### Database Connection Issues
- Verify connection string format
- Check SSL requirements for production database
- Ensure IP allowlist includes Vercel deployment regions

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Azure Pipelines Documentation](https://docs.microsoft.com/azure/devops/pipelines/)
- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)

---

## 🔄 Maintenance

### Updating Production
1. Always test in development first
2. Create PR to main with detailed description
3. Get review approval
4. Monitor deployment carefully
5. Be ready to rollback if needed

### Rollback Procedure
1. In Vercel dashboard → Deployments
2. Find previous stable deployment
3. Click "Promote to Production"
4. OR revert commit in main branch and push

### Monitoring
- Check Azure DevOps pipeline runs regularly
- Monitor Vercel deployment logs
- Set up error tracking (e.g., Sentry)
- Monitor database performance
- Track WhatsApp webhook logs

---

**Last Updated:** January 9, 2026
