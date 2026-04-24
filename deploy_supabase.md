# Deploying Veritas Chatbot on Render with Supabase Postgres

This guide explains how to switch your backend database from Render Postgres to Supabase Postgres.

## Goal

Update your Render backend service to use Supabase as the database and apply migrations safely.

## Before You Start

You need:

- Render account with your backend service already deployed.
- Supabase project already created.
- Supabase database password (from project settings).
- Gemini API key used by your backend.

## Step 1: Collect Supabase Database Values

From Supabase Dashboard:

- Go to Project Settings > Database.
- Copy these values:
  - Host: db.<project-ref>.supabase.co
  - Port: 5432
  - Database name: postgres
  - User: postgres
  - Password: your database password

Build this connection URL:

postgresql://postgres:<SUPABASE_DB_PASSWORD>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require

Important:

- Keep sslmode=require in the URL.
- If your password has special characters, URL-encode it.

## Step 2: Open Render Service Environment Variables

In Render:

- Open your backend Web Service.
- Go to Environment.

Remove old Render-DB-specific variables if present (optional but recommended):

- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD
- Internal DB URL variables from old setup

Add or update these variables:

- DATABASE_URL = postgresql://postgres:<SUPABASE_DB_PASSWORD>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
- GEMINI_API_KEY = your current Gemini API key

Why this matters:

- The backend reads DATABASE_URL directly.
- Alembic migrations also depend on DATABASE_URL.

## Step 3: Trigger a Deploy on Render

In Render:

- Click Manual Deploy > Deploy latest commit.
- Wait for deploy to finish.

Check logs for startup errors.

## Step 4: Run Database Migrations Against Supabase

Choose one of these methods.

Option A (Recommended): Render Shell on backend service

- Open Shell for the backend service.
- Run:
  - cd backend
  - alembic upgrade head

Option B: One-off migration job in Render

- Create a one-off job/command using the same environment variables.
- Run command:
  - cd backend && alembic upgrade head

Expected result:

- Alembic reports successful upgrade to head.

## Step 5: Verify the Application

After migration:

- Open backend health/docs endpoint and confirm service is up.
- Test key flows:
  - Chat request
  - Admin documents upload/list
  - Admin settings update
- Confirm new records appear in Supabase tables.

## Step 6: Disable Old Render Postgres (After Validation)

Only after full validation:

- Stop using old Render Postgres connection strings.
- Delete or suspend old Render Postgres instance to avoid extra cost.

## Step 7: Rollback Plan (If Needed)

If deployment fails:

- Restore previous DATABASE_URL value in Render.
- Redeploy backend service.
- Investigate migration or network/SSL issue before retrying.

## Troubleshooting

### Error: connection refused or timeout

- Verify host is exactly db.<project-ref>.supabase.co.
- Confirm outbound network from Render is allowed.
- Verify port 5432 is used.

### Error: Network is unreachable to Supabase host (IPv6)

If logs show connection to an IPv6 address and Render cannot reach it,
switch from the direct DB host to the Supabase pooler connection string.

- In Supabase, open Connect > Connection pooling.
- Copy the full URI shown there.
- Set Render DATABASE_URL to that URI and keep sslmode=require.
- Redeploy.

Notes:

- This is still a single DATABASE_URL value.
- Keep using one env var for DB in Render; separate DB fields are not required.

### Error: SSL required

- Ensure ?sslmode=require is included in DATABASE_URL.

### Error: authentication failed

- Recheck Supabase DB password.
- URL-encode special characters in password.

### Error: Alembic cannot find URL

- Confirm DATABASE_URL is set in Render environment for the backend service.
- Re-run migration command in that same environment.

## Final Checklist

- DATABASE_URL points to Supabase.
- GEMINI_API_KEY is present.
- Latest deploy is healthy.
- alembic upgrade head completed.
- Chat + admin flows tested.
- Old Render DB removed after confirmation.
