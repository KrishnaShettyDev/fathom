begin;
create table public.brand_sources (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brand_workspaces(id),
 provider text not null check(provider in ('shopify','gsc','ga4')),
 account_label text not null check(length(btrim(account_label)) between 1 and 120),
 account_reference text not null check(length(account_reference) between 1 and 254 and account_reference=lower(btrim(account_reference)) and account_reference !~ '[[:space:]]'),
 state text not null default 'awaiting_authorization' check(state in ('awaiting_authorization','disabled')),
 version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(brand_id,id),
 unique(brand_id,provider,account_reference)
);
create index brand_sources_list on public.brand_sources(brand_id,created_at desc,id desc);
alter table public.brand_sources enable row level security;
revoke all on public.brand_sources from anon,authenticated;
grant select on public.brand_sources to authenticated;
create policy sources_read on public.brand_sources for select to authenticated using(private.has_brand_access(brand_id));
create function public.register_brand_source(target_brand uuid,source_provider text,source_label text,source_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid;
begin
 if not private.has_brand_access(target_brand,'integrations.connect') then raise exception 'Connection permission required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text||coalesce(source_provider,'')||lower(btrim(coalesce(source_reference,''))),3));
 select id into result from public.brand_sources where brand_id=target_brand and provider=source_provider and account_reference=lower(btrim(source_reference));
 if result is not null then return result; end if;
 insert into public.brand_sources(brand_id,provider,account_label,account_reference,created_by,updated_by)
 values(target_brand,source_provider,btrim(source_label),lower(btrim(source_reference)),actor,actor) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'source.registered',jsonb_build_object('source_id',result,'provider',source_provider));
 return result;
end;
$$;
create function public.set_brand_source_state(target_brand uuid,source_id uuid,expected_version integer,next_state text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_sources;
begin
 if not private.has_brand_access(target_brand,'integrations.connect') then raise exception 'Connection permission required' using errcode='42501'; end if;
 if next_state is null or next_state not in ('awaiting_authorization','disabled') then raise exception 'Invalid source state' using errcode='22023'; end if;
 select * into existing from public.brand_sources where id=source_id and brand_id=target_brand for update;
 if existing.id is null then raise exception 'Source unavailable' using errcode='42501'; end if;
 if existing.version is distinct from expected_version then raise exception 'Source changed; reload' using errcode='40001'; end if;
 if existing.state=next_state then return; end if;
 update public.brand_sources set state=next_state,version=version+1,updated_at=now(),updated_by=actor where id=source_id;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'source.'||next_state,jsonb_build_object('source_id',source_id,'version',existing.version+1));
end;
$$;
revoke all on function public.register_brand_source(uuid,text,text,text),public.set_brand_source_state(uuid,uuid,integer,text) from public,anon;
grant execute on function public.register_brand_source(uuid,text,text,text),public.set_brand_source_state(uuid,uuid,integer,text) to authenticated;
commit;
