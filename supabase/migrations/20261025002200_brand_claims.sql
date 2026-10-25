begin;
create table public.brand_claim_requests (
 id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agency_organizations(organization_id),
 created_by uuid not null references auth.users(id),request_id uuid not null,
 brand_name text not null check(length(btrim(brand_name)) between 1 and 120),
 owner_email text not null check(owner_email=lower(btrim(owner_email)) and length(owner_email)<=254 and owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 website text check(website is null or (length(website)<=2048 and website ~ '^https?://[^[:space:]]+$')),
 reporting_timezone text not null,state text not null default 'unclaimed' check(state in ('unclaimed','claimed','cancelled','disputed')),
 accepted_brand_id uuid references public.brand_workspaces(id),claimed_by uuid references auth.users(id),claimed_at timestamptz,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 unique(agency_id,created_by,request_id),check((state='claimed')=(accepted_brand_id is not null and claimed_by is not null and claimed_at is not null))
);
alter table public.brand_claim_requests enable row level security;
revoke all on public.brand_claim_requests from anon,authenticated;
grant select on public.brand_claim_requests to authenticated;
create policy claim_requests_read on public.brand_claim_requests for select to authenticated using(private.is_agency_admin(agency_id) or owner_email=private.current_verified_email());
create function public.create_brand_claim_request(agency uuid,proposed_name text,recipient_email text,website_url text,timezone_name text,creation_request_id uuid,authorized boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();result uuid;
begin
 if not private.is_agency_admin(agency) then raise exception 'Agency admin required' using errcode='42501';end if;
 if authorized is distinct from true or creation_request_id is null then raise exception 'Authorization attestation required' using errcode='22023';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(agency::text,11));
 select id into result from public.brand_claim_requests where agency_id=agency and created_by=actor and request_id=creation_request_id;if result is not null then return result;end if;
 if (select count(*) from public.brand_claim_requests where agency_id=agency and state='unclaimed' and expires_at>now())>=20 then raise exception 'Too many pending claims' using errcode='54000';end if;
 insert into public.brand_claim_requests(agency_id,created_by,request_id,brand_name,owner_email,website,reporting_timezone) values(agency,actor,creation_request_id,btrim(proposed_name),lower(btrim(recipient_email)),nullif(btrim(website_url),''),timezone_name) returning id into result;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(agency,actor,'brand.claim_requested',jsonb_build_object('request_id',result,'authorization_attested',true));return result;
end;
$$;
create function public.accept_brand_claim_request(claim_request uuid,owner_organization_name text,owner_attested boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();claim public.brand_claim_requests;brand uuid;
begin
 select * into claim from public.brand_claim_requests where id=claim_request for update;
 if claim.id is null or claim.owner_email is distinct from private.current_verified_email() then raise exception 'Claim unavailable' using errcode='42501';end if;
 if owner_attested is distinct from true then raise exception 'Ownership attestation required' using errcode='22023';end if;
 if claim.state<>'unclaimed' or claim.expires_at<=now() then raise exception 'Claim unavailable' using errcode='22023';end if;
 if not exists(select 1 from public.agency_organizations a join public.organization_memberships m on m.organization_id=a.organization_id and m.user_id=a.created_by and m.active where a.organization_id=claim.agency_id and a.created_by=claim.created_by) then raise exception 'Request creator authority revoked' using errcode='42501';end if;
 brand:=public.create_owner_workspace(owner_organization_name,claim.brand_name,claim.reporting_timezone,coalesce(claim.website,''),claim.id,true);
 update public.brand_claim_requests set state='claimed',accepted_brand_id=brand,claimed_by=actor,claimed_at=now() where id=claim.id;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(claim.agency_id,actor,'brand.claimed',jsonb_build_object('request_id',claim.id,'brand_id',brand));
 insert into audit.events(brand_id,actor_id,event_type,details) values(brand,actor,'workspace.claimed',jsonb_build_object('claim_request_id',claim.id,'owner_attested',true,'agency_access_granted',false));return brand;
end;
$$;
create function public.close_brand_claim_request(claim_request uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();claim public.brand_claim_requests;
begin
 select * into claim from public.brand_claim_requests where id=claim_request for update;
 if claim.id is null or not(private.is_agency_admin(claim.agency_id) or claim.owner_email=private.current_verified_email()) then raise exception 'Claim unavailable' using errcode='42501';end if;
 if decision is null or decision not in ('cancelled','disputed') or reason is null or length(btrim(reason)) not between 1 and 2000 then raise exception 'Decision and reason required' using errcode='22023';end if;
 if claim.state<>'unclaimed' then raise exception 'Claim is already closed' using errcode='22023';end if;
 update public.brand_claim_requests set state=decision where id=claim.id;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(claim.agency_id,actor,'brand.claim_'||decision,jsonb_build_object('request_id',claim.id,'reason',reason));
end;
$$;
revoke all on function public.create_brand_claim_request(uuid,text,text,text,text,uuid,boolean),public.accept_brand_claim_request(uuid,text,boolean),public.close_brand_claim_request(uuid,text,text) from public,anon;
grant execute on function public.create_brand_claim_request(uuid,text,text,text,text,uuid,boolean),public.accept_brand_claim_request(uuid,text,boolean),public.close_brand_claim_request(uuid,text,text) to authenticated;
commit;
