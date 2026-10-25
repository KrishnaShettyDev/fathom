begin;
create table public.support_sessions (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brand_workspaces(id),
 owner_id uuid not null references auth.users(id),operator_id uuid not null references auth.users(id),
 purpose text not null check(length(btrim(purpose)) between 1 and 1000),
 access_level text not null check(access_level in ('analyst','operator')),
 created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '24 hours')
);
create index support_active_actor on public.support_sessions(operator_id,brand_id,expires_at) where revoked_at is null;
create or replace function private.user_has_brand_access(actor uuid,target_brand uuid,capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.brand_memberships bm join public.organization_memberships om on om.organization_id=bm.organization_id and om.user_id=bm.user_id
 where bm.brand_id=target_brand and bm.user_id=actor and bm.active and om.active and capability=any(bm.capabilities))
 or exists(select 1 from public.brand_access_grants g join public.organization_memberships m on m.organization_id=g.agency_organization_id
 where g.brand_id=target_brand and g.active and m.user_id=actor and m.active and (capability='workspace.read' or (capability='integrations.connect' and g.access_level='operator')))
 or exists(select 1 from public.support_sessions s
 join public.brand_memberships bm on bm.brand_id=s.brand_id and bm.user_id=s.owner_id and bm.active and 'workspace.manage'=any(bm.capabilities)
 join public.organization_memberships om on om.organization_id=bm.organization_id and om.user_id=bm.user_id and om.active
 where s.brand_id=target_brand and s.operator_id=actor and s.revoked_at is null and s.expires_at>statement_timestamp()
 and (capability='workspace.read' or (capability='integrations.connect' and s.access_level='operator')));
$$;
alter table public.support_sessions enable row level security;
revoke all on public.support_sessions from anon,authenticated;
grant select on public.support_sessions to authenticated;
create policy support_read on public.support_sessions for select to authenticated using(private.has_brand_access(brand_id,'workspace.manage') or (operator_id=auth.uid() and private.has_brand_access(brand_id)));
create function public.grant_support_session(target_brand uuid,email_address text,purpose_text text,requested_access text,duration_hours integer) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();recipient uuid;result uuid;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 if duration_hours is null or duration_hours not between 1 and 24 then raise exception 'Invalid duration' using errcode='22023';end if;
 select id into recipient from auth.users where lower(email)=lower(btrim(email_address)) and email_confirmed_at is not null;
 if recipient is null then raise exception 'Verified recipient unavailable' using errcode='22023';end if;
 insert into public.support_sessions(brand_id,owner_id,operator_id,purpose,access_level,expires_at) values(target_brand,actor,recipient,purpose_text,requested_access,now()+duration_hours*interval '1 hour') returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'support.granted',jsonb_build_object('session_id',result,'operator_id',recipient,'purpose',purpose_text,'access_level',requested_access,'duration_hours',duration_hours));return result;
end;
$$;
create function public.revoke_support_session(target_brand uuid,support_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 update public.support_sessions set revoked_at=now() where id=support_session and brand_id=target_brand and revoked_at is null;
 if found then insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'support.revoked',jsonb_build_object('session_id',support_session));end if;
end;
$$;
revoke all on function public.grant_support_session(uuid,text,text,text,integer),public.revoke_support_session(uuid,uuid) from public,anon;
grant execute on function public.grant_support_session(uuid,text,text,text,integer),public.revoke_support_session(uuid,uuid) to authenticated;
commit;
