begin;
alter table public.brand_claim_requests add column decision_reason text;
create or replace function public.close_brand_claim_request(claim_request uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();claim public.brand_claim_requests;
begin
 select * into claim from public.brand_claim_requests where id=claim_request for update;
 if claim.id is null or not(private.is_agency_admin(claim.agency_id) or claim.owner_email=private.current_verified_email()) then raise exception 'Claim unavailable' using errcode='42501';end if;
 if decision is null or decision not in ('cancelled','disputed') or reason is null or length(btrim(reason)) not between 1 and 2000 then raise exception 'Decision and reason required' using errcode='22023';end if;
 if claim.state<>'unclaimed' then raise exception 'Claim is already closed' using errcode='22023';end if;
 update public.brand_claim_requests set state=decision,decision_reason=reason where id=claim.id;
 insert into audit.agency_events(agency_id,actor_id,event_type,details) values(claim.agency_id,actor,'brand.claim_'||decision,jsonb_build_object('request_id',claim.id,'reason',reason));
end;
$$;
commit;
