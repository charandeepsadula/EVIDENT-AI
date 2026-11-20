# Supabase setup

Create and configure the Supabase project yourself. This repository does not create external accounts or projects.

1. In Supabase, create a project and copy its Project URL and publishable key from the project’s Connect/API settings.
2. Copy `frontend/.env.example` to `frontend/.env.local`; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Copy `backend/.env.example` to `backend/.env`; set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Keep the service role key only in the backend environment. Never use it in a `NEXT_PUBLIC_*` variable or paste it into source code.
5. Apply `supabase/migrations/20261118000000_initial_schema.sql` to the project using the Supabase SQL Editor or Supabase CLI.
6. In Authentication settings, enable email/password sign-in and add `http://localhost:3000` to the local site/redirect URL allowlist. Configure the production callback URLs only when you deploy.
7. Restart the frontend, API, and worker after changing environment files.

The migration creates private investigation storage and RLS policies. Worker-owned findings, sources, agent runs, and evidence cannot be written by authenticated browser clients; the trusted backend worker writes them with its server-only service role key.

The migration has not yet been applied to a real project in this workspace. Review the policies and retention rules before using real or sensitive investigation material.
