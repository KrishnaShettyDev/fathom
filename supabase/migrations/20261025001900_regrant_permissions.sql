begin;
-- A new invitation grants its stated access, never resurrects old delegated powers.
create or replace function public.accept_brand_invitation(invitation uuid,agency uuid) returns uuid language plpgsql security definer set search_path='' as $$
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
    on conflict(brand_id,agency_organization_id) do update set active=true,access_level=excluded.access_level,invitation_id=excluded.invitation_id,accepted_by=excluded.accepted_by,created_at=now(),revoked_at=null,capabilities='{}',permission_version=public.brand_access_grants.permission_version+1
    returning id into grant_id;
  insert into audit.events(brand_id,actor_id,event_type,details) values(pending.brand_id,actor,'agency.accepted',jsonb_build_object('invitation_id',invitation,'agency_organization_id',agency,'grant_id',grant_id));
  return pending.brand_id;
end;
$$;
commit;
