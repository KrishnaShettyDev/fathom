begin;
alter table public.brand_sources add column provider_timezone text,add column provider_metadata jsonb not null default '{}';
alter table private.oauth_states add column provider text not null default 'shopify',add column encrypted_verifier text,add column key_version text;
alter table public.collection_runs drop constraint collection_runs_kind_check;
alter table public.collection_runs add constraint collection_runs_kind_check check(kind in ('shopify_catalogue','gsc_daily','ga4_daily'));
alter table public.collection_runs drop constraint collection_runs_phase_check;
alter table public.collection_runs add constraint collection_runs_phase_check check(phase in ('products','variants','collections','metrics','complete'));
alter table public.collection_runs add column range_start date,add column range_end date;
create table public.analytics_days (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 source_id uuid not null,
 observed_date date not null,
 provider text not null check(provider in ('gsc','ga4')),
 provider_timezone text not null,
 state text not null check(state in ('available','unavailable')),
 metrics jsonb,
 metadata jsonb not null default '{}',
 run_id uuid not null,
 captured_at timestamptz not null default now(),
 unique(source_id,observed_date),
 foreign key(brand_id,source_id) references public.brand_sources(brand_id,id),
 foreign key(brand_id,run_id) references public.collection_runs(brand_id,id),
 check((state='available')=(metrics is not null))
);
create index analytics_days_list on public.analytics_days(brand_id,observed_date desc,id desc);
alter table public.analytics_days enable row level security;
revoke all on public.analytics_days from anon,authenticated;
grant select on public.analytics_days to authenticated;
create policy analytics_days_read on public.analytics_days for select to authenticated using(private.has_brand_access(brand_id));
create or replace function public.request_source_sync(target_brand uuid,source uuid,sync_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); account public.brand_sources; result uuid; allowance integer; end_day date;
begin
 if not private.has_brand_access(target_brand,'integrations.connect') then raise exception 'Connection permission required' using errcode='42501'; end if;
 if sync_request_id is null then raise exception 'Request required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text,6));
 select id into result from public.collection_runs where brand_id=target_brand and actor_id=actor and request_id=sync_request_id;
 if result is not null then return result; end if;
 select * into account from public.brand_sources where id=source and brand_id=target_brand for update;
 if account.id is null then raise exception 'Source unavailable' using errcode='42501'; end if;
 if account.state<>'authorized' or not exists(select 1 from private.connector_credentials where source_id=source) then raise exception 'Authorized source required' using errcode='22023'; end if;
 if account.provider in ('gsc','ga4') and (account.provider_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=account.provider_timezone)) then raise exception 'Provider timezone required' using errcode='22023'; end if;
 select id into result from public.collection_runs where source_id=source and state in ('queued','running');
 if result is not null then return result; end if;
 insert into public.collection_allowances(brand_id) values(target_brand) on conflict do nothing;
 select monthly_run_limit into allowance from public.collection_allowances where brand_id=target_brand;
 if (select count(*) from public.collection_runs where brand_id=target_brand and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=allowance then raise exception 'Monthly collection allowance exhausted' using errcode='54000'; end if;
 if account.provider in ('gsc','ga4') then end_day:=(now() at time zone account.provider_timezone)::date-3; end if;
 insert into public.collection_runs(brand_id,source_id,source_version,actor_id,request_id,kind,phase,range_start,range_end)
 values(target_brand,source,account.version,actor,sync_request_id,case when account.provider='shopify' then 'shopify_catalogue' else account.provider||'_daily' end,case when account.provider='shopify' then 'products' else 'metrics' end,end_day-27,end_day) returning id into result;
 insert into private.job_outbox(run_id) values(result);
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'collection.queued',jsonb_build_object('source_id',source,'run_id',result));
 return result;
end;
$$;
commit;
