begin;
alter table public.brand_sources drop constraint brand_sources_state_check;
alter table public.brand_sources add constraint brand_sources_state_check check(state in ('awaiting_authorization','authorized','degraded','disabled'));
alter table public.brand_sources add column verified_account text,add column granted_scopes text[] not null default '{}',add column last_success_at timestamptz,add column error_code text;
create table private.connector_credentials (
 source_id uuid primary key references public.brand_sources(id),
 brand_id uuid not null,
 encrypted_value text not null,
 key_version text not null,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now(),
 foreign key(brand_id,source_id) references public.brand_sources(brand_id,id)
);
create table private.oauth_states (
 state_hash text primary key,
 browser_hash text not null,
 brand_id uuid not null,
 source_id uuid not null,
 source_version integer not null,
 actor_id uuid not null references auth.users(id),
 shop text not null,
 expires_at timestamptz not null default now()+interval '10 minutes',
 foreign key(brand_id,source_id) references public.brand_sources(brand_id,id)
);
create table public.collection_runs (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 source_id uuid not null,
 source_version integer not null,
 actor_id uuid not null references auth.users(id),
 request_id uuid not null,
 kind text not null check(kind in ('shopify_catalogue')),
 state text not null default 'queued' check(state in ('queued','running','complete','partial','failed','cancelled')),
 phase text not null default 'products' check(phase in ('products','variants','collections','complete')),
 cursor text,
 pages integer not null default 0,
 records integer not null default 0,
 error_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(brand_id,id),unique(brand_id,actor_id,request_id),
 foreign key(brand_id,source_id) references public.brand_sources(brand_id,id)
);
create unique index one_active_source_run on public.collection_runs(source_id) where state in ('queued','running');
create index collection_runs_list on public.collection_runs(brand_id,created_at desc,id desc);
create table private.job_outbox (
 run_id uuid primary key references public.collection_runs(id),
 created_at timestamptz not null default now(),
 dispatched_at timestamptz
);
create table public.catalogue_records (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 source_id uuid not null,
 external_id text not null,
 kind text not null check(kind in ('product','variant','collection')),
 title text not null,
 payload jsonb not null,
 seen_run_id uuid not null,
 observed_at timestamptz not null default now(),
 removed_at timestamptz,
 unique(source_id,kind,external_id),unique(brand_id,id),
 foreign key(brand_id,source_id) references public.brand_sources(brand_id,id),
 foreign key(brand_id,seen_run_id) references public.collection_runs(brand_id,id)
);
create index catalogue_list on public.catalogue_records(brand_id,kind,title,id);
create table private.webhook_receipts (
 delivery_id text primary key,
 shop text not null,
 topic text not null,
 payload_hash text not null,
 received_at timestamptz not null default now()
);
create table public.collection_allowances (
 brand_id uuid primary key references public.brand_workspaces(id),
 monthly_run_limit integer not null default 20 check(monthly_run_limit between 0 and 1000),
 updated_at timestamptz not null default now()
);
alter table public.collection_runs enable row level security;
alter table public.catalogue_records enable row level security;
alter table public.collection_allowances enable row level security;
revoke all on public.collection_runs,public.catalogue_records,public.collection_allowances from anon,authenticated;
grant select on public.collection_runs,public.catalogue_records,public.collection_allowances to authenticated;
create policy collection_runs_read on public.collection_runs for select to authenticated using(private.has_brand_access(brand_id));
create policy catalogue_read on public.catalogue_records for select to authenticated using(private.has_brand_access(brand_id));
create policy collection_allowances_read on public.collection_allowances for select to authenticated using(private.has_brand_access(brand_id));
revoke all on private.connector_credentials,private.oauth_states,private.job_outbox,private.webhook_receipts from public,anon,authenticated;
create function public.request_source_sync(target_brand uuid,source uuid,sync_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); account public.brand_sources; result uuid; allowance integer;
begin
 if not private.has_brand_access(target_brand,'integrations.connect') then raise exception 'Connection permission required' using errcode='42501'; end if;
 if sync_request_id is null then raise exception 'Request required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text,6));
 select id into result from public.collection_runs where brand_id=target_brand and actor_id=actor and request_id=sync_request_id;
 if result is not null then return result; end if;
 select * into account from public.brand_sources where id=source and brand_id=target_brand for update;
 if account.id is null then raise exception 'Source unavailable' using errcode='42501'; end if;
 if account.provider<>'shopify' or account.state<>'authorized' or not exists(select 1 from private.connector_credentials where source_id=source) then raise exception 'Authorized Shopify source required' using errcode='22023'; end if;
 select id into result from public.collection_runs where source_id=source and state in ('queued','running');
 if result is not null then return result; end if;
 insert into public.collection_allowances(brand_id) values(target_brand) on conflict do nothing;
 select monthly_run_limit into allowance from public.collection_allowances where brand_id=target_brand;
 if (select count(*) from public.collection_runs where brand_id=target_brand and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=allowance then raise exception 'Monthly collection allowance exhausted' using errcode='54000'; end if;
 insert into public.collection_runs(brand_id,source_id,source_version,actor_id,request_id,kind) values(target_brand,source,account.version,actor,sync_request_id,'shopify_catalogue') returning id into result;
 insert into private.job_outbox(run_id) values(result);
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'collection.queued',jsonb_build_object('source_id',source,'run_id',result));
 return result;
end;
$$;
create function public.set_collection_allowance(target_brand uuid,run_limit integer) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 insert into public.collection_allowances(brand_id,monthly_run_limit) values(target_brand,run_limit) on conflict(brand_id) do update set monthly_run_limit=excluded.monthly_run_limit,updated_at=now();
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'collection.allowance_changed',jsonb_build_object('monthly_run_limit',run_limit));
end;
$$;
create function private.disconnect_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state in ('disabled','awaiting_authorization') and old.state is distinct from new.state then
   delete from private.connector_credentials where source_id=new.id;
   delete from private.oauth_states where source_id=new.id;
   update public.collection_runs set state='cancelled',error_code='SOURCE_DISCONNECTED',completed_at=now() where source_id=new.id and state in ('queued','running');
   new.granted_scopes:='{}';
   new.error_code:=null;
 end if;
 return new;
end;
$$;
create trigger source_disconnect before update on public.brand_sources for each row execute function private.disconnect_source();
create function private.run_authorized(run uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.collection_runs r join public.brand_sources s on s.id=r.source_id and s.brand_id=r.brand_id where r.id=run and r.state in ('queued','running') and s.state='authorized' and s.version=r.source_version and private.user_has_brand_access(r.actor_id,r.brand_id,'integrations.connect'));
$$;
revoke all on function private.disconnect_source(),private.run_authorized(uuid) from public,anon,authenticated;
revoke all on function public.request_source_sync(uuid,uuid,uuid),public.set_collection_allowance(uuid,integer) from public,anon;
grant execute on function public.request_source_sync(uuid,uuid,uuid),public.set_collection_allowance(uuid,integer) to authenticated;
commit;
