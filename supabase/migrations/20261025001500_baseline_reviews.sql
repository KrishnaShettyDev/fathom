begin;
create table public.baseline_reviews (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brand_workspaces(id),
 actor_id uuid not null references auth.users(id),request_id uuid not null,
 monitoring_scope text not null check(length(btrim(monitoring_scope)) between 1 and 4000),
 data_gaps text not null check(length(btrim(data_gaps)) between 1 and 4000),
 responsibilities text not null check(length(btrim(responsibilities)) between 1 and 4000),
 snapshot jsonb not null,acknowledged_at timestamptz not null default now(),
 unique(brand_id,actor_id,request_id)
);
alter table public.baseline_reviews enable row level security;
revoke all on public.baseline_reviews from anon,authenticated;
grant select on public.baseline_reviews to authenticated;
create policy baseline_read on public.baseline_reviews for select to authenticated using(private.has_brand_access(brand_id));
create trigger baseline_immutable before update or delete on public.baseline_reviews for each row execute function audit.reject_mutation();
create function public.acknowledge_baseline(target_brand uuid,scope_text text,gaps_text text,responsibility_text text,creation_request_id uuid,confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();result uuid; captured jsonb;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 if confirmed is distinct from true or creation_request_id is null then raise exception 'Explicit acknowledgement required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text,9));
 select id into result from public.baseline_reviews where brand_id=target_brand and actor_id=actor and request_id=creation_request_id;
 if result is not null then return result;end if;
 select jsonb_build_object('brand',to_jsonb(b),'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'provider',s.provider,'account_reference',s.account_reference,'state',s.state,'last_success_at',s.last_success_at)) from public.brand_sources s where s.brand_id=b.id),'[]'::jsonb),
 'catalogue_records',(select count(*) from public.catalogue_records where brand_id=b.id and removed_at is null),
 'analytics_available_days',(select count(*) from public.analytics_days where brand_id=b.id and state='available'),
 'completed_observations',(select count(*) from public.observation_samples where brand_id=b.id and state='complete'),
 'audit_checks',(select count(*) from public.audit_checks where brand_id=b.id),
 'opportunities',(select count(*) from public.opportunities where brand_id=b.id)) into captured from public.brand_workspaces b where b.id=target_brand;
 insert into public.baseline_reviews(brand_id,actor_id,request_id,monitoring_scope,data_gaps,responsibilities,snapshot) values(target_brand,actor,creation_request_id,scope_text,gaps_text,responsibility_text,captured) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'baseline.acknowledged',jsonb_build_object('review_id',result));return result;
end;
$$;
revoke all on function public.acknowledge_baseline(uuid,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.acknowledge_baseline(uuid,text,text,text,uuid,boolean) to authenticated;
commit;
