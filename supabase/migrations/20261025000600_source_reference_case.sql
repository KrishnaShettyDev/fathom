begin;
-- References may contain case-sensitive property paths; preserve supplied case.
alter table public.brand_sources drop constraint brand_sources_account_reference_check;
alter table public.brand_sources add constraint brand_sources_account_reference_check
check(length(account_reference) between 1 and 254 and account_reference=btrim(account_reference) and account_reference !~ '[[:space:]]');
create or replace function public.register_brand_source(target_brand uuid,source_provider text,source_label text,source_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid;
begin
 if not private.has_brand_access(target_brand,'integrations.connect') then raise exception 'Connection permission required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text||coalesce(source_provider,'')||btrim(coalesce(source_reference,'')),3));
 select id into result from public.brand_sources where brand_id=target_brand and provider=source_provider and account_reference=btrim(source_reference);
 if result is not null then return result; end if;
 insert into public.brand_sources(brand_id,provider,account_label,account_reference,created_by,updated_by)
 values(target_brand,source_provider,btrim(source_label),btrim(source_reference),actor,actor) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'source.registered',jsonb_build_object('source_id',result,'provider',source_provider));
 return result;
end;
$$;
commit;
