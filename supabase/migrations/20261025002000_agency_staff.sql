begin;
create table public.agency_staff_invitations (
 id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agency_organizations(organization_id),
 recipient_email text not null check(recipient_email=lower(btrim(recipient_email)) and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(recipient_email)<=254),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 state text not null default 'pending' check(state in ('pending','accepted','cancelled')),accepted_by uuid references auth.users(id),accepted_at timestamptz,
 check((state='accepted')=(accepted_by is not null and accepted_at is not null))
);
create unique index agency_staff_pending on public.agency_staff_invitations(agency_id,recipient_email) where state='pending';
create table audit.agency_events(id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agency_organizations(organization_id),actor_id uuid not null references auth.users(id),event_type text not null,details jsonb not null,occurred_at timestamptz not null default now());
create trigger agency_events_immutable before update or delete on audit.agency_events for each row execute function audit.reject_mutation();
revoke all on audit.agency_events from public,anon,authenticated;
alter table public.agency_staff_invitations enable row level security;
revoke all on public.agency_staff_invitations from anon,authenticated;
grant select on public.agency_staff_invitations to authenticated;
create policy staff_invitations_read on public.agency_staff_invitations for select to authenticated using(private.is_agency_admin(agency_id) or recipient_email=private.current_verified_email());
create function public.invite_agency_staff(agency uuid,email_address text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();result uuid;
begin
 if not private.is_agency_admin(agency) then raise exception 'Agency admin required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(agency::text,10));
 update public.agency_staff_invitations set state='cancelled' where agency_id=agency and recipient_email=lower(btrim(email_address)) and state='pending' and expires_at<=now();
 select id into result from public.agency_staff_invitations where agency_id=agency and recipient_email=lower(btrim(email_address)) and state='pending';if result is not null then return result;end if;
 insert into public.agency_staff_invitations(agency_id,recipient_email,created_by) values(agency,lower(btrim(email_address)),actor) returning id into result;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(agency,actor,'staff.invited',jsonb_build_object('invitation_id',result));return result;
end;
$$;
create function public.accept_agency_staff(invitation uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();pending public.agency_staff_invitations;
begin
 select * into pending from public.agency_staff_invitations where id=invitation for update;
 if pending.id is null or pending.recipient_email is distinct from private.current_verified_email() then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if pending.state<>'pending' or pending.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='22023';end if;
 if not exists(select 1 from public.agency_organizations a join public.organization_memberships m on m.organization_id=a.organization_id and m.user_id=a.created_by and m.active where a.organization_id=pending.agency_id and a.created_by=pending.created_by) then raise exception 'Inviter authority revoked' using errcode='42501';end if;
 insert into public.organization_memberships(organization_id,user_id) values(pending.agency_id,actor) on conflict(organization_id,user_id) do update set active=true;
 update public.agency_staff_invitations set state='accepted',accepted_by=actor,accepted_at=now() where id=invitation;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(pending.agency_id,actor,'staff.accepted',jsonb_build_object('invitation_id',invitation));return pending.agency_id;
end;
$$;
create function public.revoke_agency_staff(agency uuid,staff_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.is_agency_admin(agency) then raise exception 'Agency admin required' using errcode='42501';end if;
 if staff_user=actor then raise exception 'Cannot revoke agency creator' using errcode='22023';end if;
 update public.organization_memberships set active=false where organization_id=agency and user_id=staff_user and active;
 -- Pending invitations must not silently reinstate a revoked employee.
 update public.agency_staff_invitations set state='cancelled' where agency_id=agency and state='pending' and recipient_email=(select lower(email) from auth.users where id=staff_user);
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(agency,actor,'staff.revoked',jsonb_build_object('user_id',staff_user));
end;
$$;
create function public.cancel_agency_staff_invitation(agency uuid,invitation uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.is_agency_admin(agency) then raise exception 'Agency admin required' using errcode='42501';end if;
 update public.agency_staff_invitations set state='cancelled' where id=invitation and agency_id=agency and state='pending';
 if found then insert into audit.agency_events(agency_id,actor_id,event_type,details) values(agency,actor,'staff.invitation_cancelled',jsonb_build_object('invitation_id',invitation));end if;
end;
$$;
create function public.list_agency_staff(agency uuid) returns table(user_id uuid,email text,active boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_agency_admin(agency) then raise exception 'Agency admin required' using errcode='42501';end if;
 return query select u.id,u.email::text,m.active from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=agency order by u.email limit 100;
end;
$$;
revoke all on function public.invite_agency_staff(uuid,text),public.accept_agency_staff(uuid),public.revoke_agency_staff(uuid,uuid),public.cancel_agency_staff_invitation(uuid,uuid),public.list_agency_staff(uuid) from public,anon;
grant execute on function public.invite_agency_staff(uuid,text),public.accept_agency_staff(uuid),public.revoke_agency_staff(uuid,uuid),public.cancel_agency_staff_invitation(uuid,uuid),public.list_agency_staff(uuid) to authenticated;
commit;
