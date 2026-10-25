begin;
alter table public.brand_sources add column reconciliation_requested_at timestamptz;
-- Expiring offline tokens are one-per-app/shop. Do not silently let a second
-- source's OAuth exchange replace an active source's credentials.
create unique index one_active_shop_source on public.brand_sources(verified_account) where provider='shopify' and state in ('authorized','degraded') and verified_account is not null;
create function private.schedule_reconciliation() returns integer language plpgsql security definer set search_path='' as $$
declare source public.brand_sources; result uuid; total integer:=0; allowance integer;
begin
 for source in select * from public.brand_sources s where s.provider='shopify' and s.state='authorized'
   and (s.reconciliation_requested_at is not null or s.last_success_at is null or s.last_success_at<now()-interval '1 day')
   and not exists(select 1 from public.collection_runs r where r.source_id=s.id and (r.state in ('queued','running') or r.created_at>now()-interval '15 minutes'))
   order by s.last_success_at nulls first limit 20 for update skip locked
 loop
  if not private.user_has_brand_access(source.updated_by,source.brand_id,'integrations.connect') then continue; end if;
  if not exists(select 1 from private.connector_credentials where source_id=source.id) then continue; end if;
  -- Share the same brand lock as user enqueue so automated and manual work cannot
  -- oversubscribe the allowance. Try-lock avoids lock inversion with source rows.
  if not pg_try_advisory_xact_lock(hashtextextended(source.brand_id::text,6)) then continue; end if;
  select monthly_run_limit into allowance from public.collection_allowances where brand_id=source.brand_id;
  allowance:=coalesce(allowance,20);
  if (select count(*) from public.collection_runs where brand_id=source.brand_id and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=allowance then continue; end if;
  insert into public.collection_runs(brand_id,source_id,source_version,actor_id,request_id,kind) values(source.brand_id,source.id,source.version,source.updated_by,gen_random_uuid(),'shopify_catalogue') returning id into result;
  insert into private.job_outbox(run_id) values(result);
  insert into audit.events(brand_id,actor_id,event_type,details) values(source.brand_id,source.updated_by,'collection.reconciliation_queued',jsonb_build_object('source_id',source.id,'run_id',result));
  total:=total+1;
 end loop;
 return total;
end;
$$;
revoke all on function private.schedule_reconciliation() from public,anon,authenticated;
commit;
