begin;
create schema if not exists private;
create schema if not exists audit;
revoke all on schema private, audit from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  active boolean not null default true,
  primary key (organization_id, user_id)
);
create index organization_memberships_user on public.organization_memberships(user_id, organization_id) where active;
create table public.brand_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_organization_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  website text check (website is null or (length(website) <= 2048 and website ~ '^https?://[^[:space:]]+$')),
  reporting_timezone text not null,
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (created_by, request_id)
);
create table public.brand_memberships (
  brand_id uuid not null references public.brand_workspaces(id),
  organization_id uuid not null,
  user_id uuid not null,
  active boolean not null default true,
  capabilities text[] not null default '{}',
  primary key (brand_id, user_id),
  foreign key (organization_id, user_id) references public.organization_memberships(organization_id, user_id),
  check (capabilities <@ array['workspace.read', 'workspace.manage', 'integrations.connect']::text[])
);
create index brand_memberships_user on public.brand_memberships(user_id, brand_id) where active;
create table audit.events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_workspaces(id),
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'
);
create index audit_events_brand_time on audit.events(brand_id, occurred_at desc);
create function audit.reject_mutation() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Audit history is append-only' using errcode = '42501'; end;
$$;
create trigger audit_immutable before update or delete on audit.events for each row execute function audit.reject_mutation();

-- Private definer helpers avoid recursive membership policies. Identity comes only
-- from the verified database JWT, never a caller-supplied user identifier.
create function private.has_brand_access(target_brand uuid, capability text default 'workspace.read')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.brand_memberships bm
    join public.organization_memberships om on om.organization_id = bm.organization_id and om.user_id = bm.user_id
    where bm.brand_id = target_brand and bm.user_id = auth.uid()
      and bm.active and om.active and capability = any(bm.capabilities)
  );
$$;
create function private.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id = target_org and m.user_id = auth.uid() and m.active);
$$;
revoke all on function private.has_brand_access(uuid,text), private.is_org_member(uuid) from public, anon;
grant execute on function private.has_brand_access(uuid,text), private.is_org_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.brand_workspaces enable row level security;
alter table public.brand_memberships enable row level security;
alter table audit.events enable row level security;
revoke all on public.organizations, public.organization_memberships, public.brand_workspaces, public.brand_memberships from anon, authenticated;
grant select on public.organizations, public.organization_memberships, public.brand_workspaces, public.brand_memberships to authenticated;
create policy organizations_read on public.organizations for select to authenticated using (private.is_org_member(id));
create policy organization_memberships_read on public.organization_memberships for select to authenticated using (user_id = (select auth.uid()) and active);
create policy brands_read on public.brand_workspaces for select to authenticated using (private.has_brand_access(id));
create policy brand_memberships_read on public.brand_memberships for select to authenticated using (user_id = (select auth.uid()) and private.has_brand_access(brand_id));

create function public.create_owner_workspace(
  organization_name text, brand_name text, timezone_name text,
  website_url text, onboarding_request_id uuid, owner_attested boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing_brand uuid;
  org uuid;
  brand uuid;
begin
  if actor is null or not exists(select 1 from auth.users where id = actor and email_confirmed_at is not null) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if owner_attested is distinct from true then raise exception 'Ownership attestation required' using errcode = '22023'; end if;
  if organization_name is null or length(btrim(organization_name)) not between 1 and 120
     or brand_name is null or length(btrim(brand_name)) not between 1 and 120
     or onboarding_request_id is null then raise exception 'Invalid workspace details' using errcode = '22023'; end if;
  if timezone_name is null or not exists(select 1 from pg_catalog.pg_timezone_names where name = timezone_name) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || onboarding_request_id::text,0));
  select id into existing_brand from public.brand_workspaces where created_by = actor and request_id = onboarding_request_id;
  if existing_brand is not null then
    if not private.has_brand_access(existing_brand) then raise exception 'Access revoked' using errcode = '42501'; end if;
    return existing_brand;
  end if;
  insert into public.organizations(name,created_by) values(btrim(organization_name),actor) returning id into org;
  insert into public.organization_memberships(organization_id,user_id) values(org,actor);
  insert into public.brand_workspaces(owner_organization_id,name,website,reporting_timezone,created_by,request_id)
    values(org,btrim(brand_name),nullif(btrim(website_url),''),timezone_name,actor,onboarding_request_id) returning id into brand;
  insert into public.brand_memberships(brand_id,organization_id,user_id,capabilities)
    values(brand,org,actor,array['workspace.read','workspace.manage','integrations.connect']);
  insert into audit.events(brand_id,actor_id,event_type,details)
    values(brand,actor,'workspace.created',jsonb_build_object('owner_attested',true,'organization_id',org));
  return brand;
end;
$$;
revoke all on function public.create_owner_workspace(text,text,text,text,uuid,boolean) from public, anon;
grant execute on function public.create_owner_workspace(text,text,text,text,uuid,boolean) to authenticated;
revoke all on all tables in schema audit from anon, authenticated;
revoke all on all functions in schema audit from public, anon, authenticated;
commit;
