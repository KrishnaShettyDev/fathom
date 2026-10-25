begin;
create table public.agency_organizations (
  organization_id uuid primary key references public.organizations(id),
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(created_by,request_id)
);
create table public.brand_invitations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_workspaces(id),
  brand_name text not null,
  recipient_email text not null check (length(recipient_email) between 3 and 254 and recipient_email = lower(btrim(recipient_email)) and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  access_level text not null check (access_level in ('analyst','operator')),
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  state text not null default 'pending' check(state in ('pending','accepted','cancelled')),
  accepted_by uuid references auth.users(id),
  accepted_agency_id uuid references public.agency_organizations(organization_id),
  accepted_at timestamptz,
  unique(brand_id,id),
  unique(brand_id,request_id),
  check(expires_at > created_at),
  check((state='accepted') = (accepted_by is not null and accepted_agency_id is not null and accepted_at is not null))
);
create unique index invitation_pending_recipient on public.brand_invitations(brand_id,recipient_email) where state='pending';
create index invitation_recipient on public.brand_invitations(recipient_email,created_at desc);
create table public.brand_access_grants (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_workspaces(id),
  agency_organization_id uuid not null references public.agency_organizations(organization_id),
  access_level text not null check(access_level in ('analyst','operator')),
  invitation_id uuid not null,
  active boolean not null default true,
  accepted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(brand_id,agency_organization_id),
  foreign key(brand_id,invitation_id) references public.brand_invitations(brand_id,id),
  check(active = (revoked_at is null))
);
create index grant_agency on public.brand_access_grants(agency_organization_id,brand_id) where active;

create function private.verified_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  return actor;
end;
$$;
create function private.current_verified_email() returns text language sql stable security definer set search_path='' as $$
  select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
create function private.is_agency_admin(agency uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.agency_organizations a join public.organization_memberships m on m.organization_id=a.organization_id and m.user_id=a.created_by
    where a.organization_id=agency and a.created_by=auth.uid() and m.active);
$$;
create function private.user_has_brand_access(actor uuid,target_brand uuid,capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.brand_memberships bm
    join public.organization_memberships om on om.organization_id=bm.organization_id and om.user_id=bm.user_id
    where bm.brand_id=target_brand and bm.user_id=actor and bm.active and om.active and capability=any(bm.capabilities))
  or exists(select 1 from public.brand_access_grants g
    join public.organization_memberships m on m.organization_id=g.agency_organization_id
    where g.brand_id=target_brand and g.active and m.user_id=actor and m.active
      and (capability='workspace.read' or (capability='integrations.connect' and g.access_level='operator')));
$$;
create or replace function private.has_brand_access(target_brand uuid,capability text default 'workspace.read')
returns boolean language sql stable security definer set search_path='' as $$
  select private.user_has_brand_access(auth.uid(),target_brand,capability);
$$;
revoke all on function private.verified_actor(),private.current_verified_email(),private.is_agency_admin(uuid),private.user_has_brand_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.current_verified_email(),private.is_agency_admin(uuid) to authenticated;

alter table public.agency_organizations enable row level security;
alter table public.brand_invitations enable row level security;
alter table public.brand_access_grants enable row level security;
revoke all on public.agency_organizations,public.brand_invitations,public.brand_access_grants from anon,authenticated;
grant select on public.agency_organizations,public.brand_invitations,public.brand_access_grants to authenticated;
create policy agencies_read on public.agency_organizations for select to authenticated using(private.is_agency_admin(organization_id));
create policy invitations_read on public.brand_invitations for select to authenticated using(private.has_brand_access(brand_id,'workspace.manage') or recipient_email=private.current_verified_email());
create policy grants_read on public.brand_access_grants for select to authenticated using(private.has_brand_access(brand_id,'workspace.manage') or private.is_agency_admin(agency_organization_id));

create function public.create_agency(agency_name text,creation_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); org uuid;
begin
  if agency_name is null or length(btrim(agency_name)) not between 1 and 120 or creation_request_id is null then raise exception 'Invalid agency details' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||creation_request_id::text,1));
  select organization_id into org from public.agency_organizations where created_by=actor and request_id=creation_request_id;
  if org is not null then
    if not private.is_agency_admin(org) then raise exception 'Access revoked' using errcode='42501'; end if;
    return org;
  end if;
  insert into public.organizations(name,created_by) values(btrim(agency_name),actor) returning id into org;
  insert into public.organization_memberships(organization_id,user_id) values(org,actor);
  insert into public.agency_organizations(organization_id,created_by,request_id) values(org,actor,creation_request_id);
  return org;
end;
$$;
create function public.create_brand_invitation(target_brand uuid,email_address text,requested_access text,invitation_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_invitations; invite uuid; target_name text;
begin
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
  if requested_access is null or requested_access not in ('analyst','operator') or invitation_request_id is null or email_address is null then raise exception 'Invalid invitation' using errcode='22023'; end if;
  select name into target_name from public.brand_workspaces where id=target_brand for update;
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Access revoked' using errcode='42501'; end if;
  select * into existing from public.brand_invitations where brand_id=target_brand and request_id=invitation_request_id;
  if existing.id is not null then
    if existing.recipient_email <> lower(btrim(email_address)) or existing.access_level <> requested_access or existing.created_by <> actor then raise exception 'Request payload changed' using errcode='22023'; end if;
    return existing.id;
  end if;
  -- Expired rows remain historical but no longer block a new invitation.
  update public.brand_invitations set state='cancelled' where brand_id=target_brand and recipient_email=lower(btrim(email_address)) and state='pending' and expires_at<=now();
  insert into public.brand_invitations(brand_id,brand_name,recipient_email,access_level,created_by,request_id)
    values(target_brand,target_name,lower(btrim(email_address)),requested_access,actor,invitation_request_id) returning id into invite;
  insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'agency.invited',jsonb_build_object('invitation_id',invite,'access_level',requested_access));
  return invite;
end;
$$;
create function public.accept_brand_invitation(invitation uuid,agency uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); pending public.brand_invitations; grant_id uuid;
begin
  select * into pending from public.brand_invitations where id=invitation for update;
  if pending.id is null or pending.recipient_email is distinct from private.current_verified_email() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if pending.state <> 'pending' or pending.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='22023'; end if;
  if not private.is_agency_admin(agency) then raise exception 'Agency administration required' using errcode='42501'; end if;
  if not private.user_has_brand_access(pending.created_by,pending.brand_id,'workspace.manage') then raise exception 'Inviter authority revoked' using errcode='42501'; end if;
  if exists(select 1 from public.brand_access_grants where brand_id=pending.brand_id and agency_organization_id=agency and active) then raise exception 'Agency already connected' using errcode='22023'; end if;
  update public.brand_invitations set state='accepted',accepted_by=actor,accepted_agency_id=agency,accepted_at=now() where id=invitation;
  insert into public.brand_access_grants(brand_id,agency_organization_id,access_level,invitation_id,accepted_by)
    values(pending.brand_id,agency,pending.access_level,invitation,actor)
    on conflict(brand_id,agency_organization_id) do update set active=true,access_level=excluded.access_level,invitation_id=excluded.invitation_id,accepted_by=excluded.accepted_by,created_at=now(),revoked_at=null
    returning id into grant_id;
  insert into audit.events(brand_id,actor_id,event_type,details) values(pending.brand_id,actor,'agency.accepted',jsonb_build_object('invitation_id',invitation,'agency_organization_id',agency,'grant_id',grant_id));
  return pending.brand_id;
end;
$$;
create function public.cancel_brand_invitation(target_brand uuid,invitation uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); pending public.brand_invitations;
begin
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
  select * into pending from public.brand_invitations where id=invitation and brand_id=target_brand for update;
  if pending.id is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if pending.state='cancelled' then return; end if;
  if pending.state='accepted' then raise exception 'Revoke the accepted grant instead' using errcode='22023'; end if;
  update public.brand_invitations set state='cancelled' where id=invitation;
  insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'agency.invitation_cancelled',jsonb_build_object('invitation_id',invitation));
end;
$$;
create function public.revoke_agency_access(target_brand uuid,access_grant uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); selected public.brand_access_grants;
begin
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
  select * into selected from public.brand_access_grants where id=access_grant and brand_id=target_brand for update;
  if selected.id is null then raise exception 'Grant unavailable' using errcode='42501'; end if;
  if not selected.active then return; end if;
  update public.brand_access_grants set active=false,revoked_at=now() where id=access_grant;
  insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'agency.revoked',jsonb_build_object('grant_id',access_grant,'agency_organization_id',selected.agency_organization_id));
end;
$$;
revoke all on function public.create_agency(text,uuid),public.create_brand_invitation(uuid,text,text,uuid),public.accept_brand_invitation(uuid,uuid),public.cancel_brand_invitation(uuid,uuid),public.revoke_agency_access(uuid,uuid) from public,anon;
grant execute on function public.create_agency(text,uuid),public.create_brand_invitation(uuid,text,text,uuid),public.accept_brand_invitation(uuid,uuid),public.cancel_brand_invitation(uuid,uuid),public.revoke_agency_access(uuid,uuid) to authenticated;
commit;
