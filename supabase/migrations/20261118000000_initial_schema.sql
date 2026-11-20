-- EVIDENT AI initial schema. Apply to a Supabase project after reviewing the
-- policies for your organization and retention requirements.
create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en','te','hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','analyst','reviewer','member')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null default 'Untitled investigation' check (length(title) <= 240),
  submitted_type text not null check (submitted_type in ('text','url','image','video','audio','document','screenshot','social')),
  language text not null default 'auto' check (language in ('en','te','hi','auto')),
  submitted_content text,
  status text not null default 'QUEUED' check (status in ('QUEUED','PROCESSING','ANALYZING','EVIDENCE_REVIEW','NEEDS_REVIEW','COMPLETED','PARTIALLY_COMPLETED','FAILED','CANCELLED')),
  progress smallint not null default 0 check (progress between 0 and 100),
  current_stage text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint investigations_content_length_check check (submitted_content is null or length(submitted_content) <= 20000),
  constraint investigations_url_check check (submitted_type <> 'url' or submitted_content ~ '^https?://')
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text,
  perceptual_hash text,
  extracted_text text check (extracted_text is null or length(extracted_text) <= 20000),
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  text text not null check (length(trim(text)) between 1 and 10000),
  language text,
  factual_verdict text check (factual_verdict in ('VERIFIED','FALSE','MISLEADING','UNVERIFIED','INSUFFICIENT_EVIDENCE')),
  media_authenticity text check (media_authenticity in ('NO_INDICATORS_DETECTED','POTENTIAL_INDICATORS','AI_GENERATION_INDICATORS','INCONCLUSIVE','NOT_ANALYZED')),
  reasoning_summary text,
  uncertainty text,
  limitations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  title text,
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  retrieval_score numeric(5,4) check (retrieval_score is null or retrieval_score between 0 and 1),
  reliability_basis text,
  reliability_assessment text,
  created_at timestamptz not null default now(),
  unique (investigation_id, url)
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  quotation text,
  extracted_passage text,
  direction text not null check (direction in ('supporting','contradicting','context','neutral')),
  relevance numeric(4,3) check (relevance between 0 and 1),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','validated','rejected','needs_review')),
  citation_status text not null default 'unchecked' check (citation_status in ('unchecked','valid','invalid','unavailable')),
  retrieved_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  agent_name text not null,
  status text not null check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','SKIPPED','NEEDS_REVIEW')),
  model_name text,
  prompt_version text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  token_count integer check (token_count is null or token_count >= 0),
  cost_usd numeric(12,6) check (cost_usd is null or cost_usd >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_findings (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  claim_id uuid references public.claims(id) on delete set null,
  finding_type text not null,
  summary text not null,
  structured_result jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  supporting_evidence_ids uuid[] not null default '{}',
  needs_human_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forensic_results (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  media_type text not null check (media_type in ('image','video','audio','document')),
  tool_name text not null,
  tool_version text,
  indicator text not null,
  finding text not null,
  confidence numeric(4,3) check (confidence between 0 and 1),
  timestamp_ms bigint check (timestamp_ms is null or timestamp_ms >= 0),
  limitations text,
  created_at timestamptz not null default now()
);

create table if not exists public.investigation_events (
  id bigint generated always as identity primary key,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  event_type text not null,
  stage text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  to_type text not null,
  to_id uuid not null,
  relationship text not null,
  created_at timestamptz not null default now(),
  unique (investigation_id, from_type, from_id, to_type, to_id, relationship)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  format text not null check (format in ('json','pdf','evidence_archive')),
  status text not null default 'ready' check (status in ('queued','ready','failed')),
  storage_path text,
  report_json jsonb,
  share_token_hash text,
  share_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (investigation_id, version, format)
);

create table if not exists public.monitoring_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  query text not null check (length(trim(query)) between 1 and 1000),
  enabled boolean not null default true,
  source_scope jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid references public.investigations(id) on delete cascade,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  investigation_id uuid references public.investigations(id) on delete set null,
  metric text not null,
  quantity numeric(16,4) not null check (quantity >= 0),
  unit text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists investigations_owner_created_idx on public.investigations(owner_id, created_at desc);
create index if not exists investigations_org_created_idx on public.investigations(organization_id, created_at desc);
create index if not exists investigations_status_idx on public.investigations(status, updated_at desc);
create index if not exists claims_investigation_idx on public.claims(investigation_id);
create index if not exists evidence_investigation_idx on public.evidence(investigation_id, created_at);
create index if not exists evidence_claim_idx on public.evidence(claim_id);
create index if not exists agent_runs_investigation_idx on public.agent_runs(investigation_id, created_at);
create index if not exists forensic_investigation_idx on public.forensic_results(investigation_id, created_at);
create index if not exists events_investigation_idx on public.investigation_events(investigation_id, created_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists audit_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index if not exists usage_user_occurred_idx on public.usage_records(user_id, occurred_at desc);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at before update on public.organizations for each row execute function public.touch_updated_at();
drop trigger if exists investigations_touch_updated_at on public.investigations;
create trigger investigations_touch_updated_at before update on public.investigations for each row execute function public.touch_updated_at();
drop trigger if exists claims_touch_updated_at on public.claims;
create trigger claims_touch_updated_at before update on public.claims for each row execute function public.touch_updated_at();
drop trigger if exists monitoring_rules_touch_updated_at on public.monitoring_rules;
create trigger monitoring_rules_touch_updated_at before update on public.monitoring_rules for each row execute function public.touch_updated_at();

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = auth.uid());
$$;

create or replace function public.can_access_investigation(target_investigation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.investigations i where i.id = target_investigation and (i.owner_id = auth.uid() or (i.organization_id is not null and public.is_org_member(i.organization_id))));
$$;

create or replace function public.is_org_creator(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organizations o where o.id = target_org and o.created_by = auth.uid());
$$;

create or replace function public.can_manage_org(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = auth.uid() and m.role in ('owner','admin'));
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.investigations enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.claims enable row level security;
alter table public.sources enable row level security;
alter table public.evidence enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_findings enable row level security;
alter table public.forensic_results enable row level security;
alter table public.investigation_events enable row level security;
alter table public.entity_relationships enable row level security;
alter table public.reports enable row level security;
alter table public.monitoring_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_keys enable row level security;
alter table public.usage_records enable row level security;

create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy organizations_member_read on public.organizations for select using (public.is_org_member(id));
create policy organizations_creator_insert on public.organizations for insert with check (created_by = auth.uid());
create policy organizations_admin_update on public.organizations for update using (public.can_manage_org(id)) with check (public.can_manage_org(id));
create policy org_members_read on public.organization_members for select using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy org_members_owner_insert on public.organization_members for insert with check ((user_id = auth.uid() and role = 'owner' and public.is_org_creator(organization_id)) or (public.can_manage_org(organization_id) and role <> 'owner'));
create policy org_members_admin_update on public.organization_members for update using (public.can_manage_org(organization_id) and role <> 'owner') with check (public.can_manage_org(organization_id) and role <> 'owner');
create policy org_members_admin_delete on public.organization_members for delete using (public.can_manage_org(organization_id) and role <> 'owner');
create policy investigations_member_read on public.investigations for select using (owner_id = auth.uid() or public.is_org_member(organization_id));
create policy investigations_owner_insert on public.investigations for insert with check (owner_id = auth.uid() and (organization_id is null or public.is_org_member(organization_id)));
create policy investigations_owner_delete on public.investigations for delete using (owner_id = auth.uid());

create policy uploaded_files_access on public.uploaded_files for select using (public.can_access_investigation(investigation_id));
create policy uploaded_files_insert on public.uploaded_files for insert with check (owner_id = auth.uid() and public.can_access_investigation(investigation_id));
create policy uploaded_files_delete on public.uploaded_files for delete using (owner_id = auth.uid());
create policy claims_access on public.claims for select using (public.can_access_investigation(investigation_id));
create policy sources_access on public.sources for select using (public.can_access_investigation(investigation_id));
create policy evidence_access on public.evidence for select using (public.can_access_investigation(investigation_id));
create policy agent_runs_access on public.agent_runs for select using (public.can_access_investigation(investigation_id));
create policy agent_findings_access on public.agent_findings for select using (public.can_access_investigation(investigation_id));
create policy forensic_results_access on public.forensic_results for select using (public.can_access_investigation(investigation_id));
create policy events_access on public.investigation_events for select using (public.can_access_investigation(investigation_id));
create policy relationships_access on public.entity_relationships for select using (public.can_access_investigation(investigation_id));
create policy reports_access on public.reports for select using (public.can_access_investigation(investigation_id));
create policy monitoring_owner on public.monitoring_rules for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy notifications_self on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_read on public.audit_logs for select using (actor_id = auth.uid() or public.is_org_member(organization_id));
create policy api_keys_self on public.api_keys for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy usage_read on public.usage_records for select using (user_id = auth.uid() or public.is_org_member(organization_id));

-- Audit, agent, source, forensic, and usage records are intentionally read-only
-- to authenticated clients; trusted server workflows will write those records.
-- Clients may create an investigation only with user-controlled input fields.
-- Processing state, agent findings, verdicts, and evidence are service-owned.
revoke insert, update on public.investigations from authenticated;
grant insert (owner_id, organization_id, title, submitted_type, submitted_content, language) on public.investigations to authenticated;
grant update (title) on public.investigations to authenticated;
revoke insert, update, delete on public.claims, public.sources, public.evidence,
  public.agent_runs, public.agent_findings, public.forensic_results,
  public.investigation_events, public.entity_relationships, public.reports,
  public.audit_logs, public.usage_records from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('investigation-files','investigation-files',false,524288000,
  array['image/jpeg','image/png','image/webp','image/tiff','video/mp4','video/quicktime','video/webm','video/x-matroska','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/flac','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy investigation_storage_select on storage.objects for select to authenticated
using (bucket_id = 'investigation-files' and public.can_access_investigation((storage.foldername(name))[1]::uuid));
create policy investigation_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'investigation-files' and public.can_access_investigation((storage.foldername(name))[1]::uuid));
create policy investigation_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'investigation-files' and public.can_access_investigation((storage.foldername(name))[1]::uuid));
