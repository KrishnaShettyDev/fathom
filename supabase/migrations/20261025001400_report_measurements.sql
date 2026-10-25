begin;
create or replace function public.create_client_report(target_brand uuid,creation_request_id uuid,report_title text,start_date date,end_date date,report_annotation text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid; payload jsonb;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 if creation_request_id is null or start_date is null or end_date is null or end_date<start_date or end_date-start_date>366 then raise exception 'Choose a range of at most 367 dates' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text||actor::text||creation_request_id::text,5));
 select id into result from public.client_reports where brand_id=target_brand and created_by=actor and request_id=creation_request_id;
 if result is not null then return result; end if;
 -- One statement gives the complete snapshot a consistent MVCC view.
 with selected as (select * from public.opportunities where brand_id=target_brand and created_at>=start_date::timestamp at time zone 'UTC' and created_at<(end_date+1)::timestamp at time zone 'UTC'),
 items as (select to_jsonb(o)-'request_id' || jsonb_build_object('evidence',r.snapshot,'history',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) from public.opportunity_events e where e.opportunity_id=o.id)) item from selected o join public.brand_fact_revisions r on r.fact_id=o.fact_id and r.version=o.fact_version)
 select jsonb_build_object('schema_version',2,'captured_at',now(),'brand',(select jsonb_build_object('id',id,'name',name,'reporting_timezone',reporting_timezone) from public.brand_workspaces where id=target_brand),
 'methodology','Manually reviewed opportunity workflow. UTC creation-date filter, inclusive dates. No causal or revenue claims. Analytics use provider-local observed dates. Observation comparisons use only completed answers within the same fixed cohort run; requested geography is not verified geography. Audit evidence is static HTML only. Missing measurements remain unavailable.',
 'filters',jsonb_build_object('range_start',start_date,'range_end',end_date,'date_field','opportunity.created_at','filter_timezone','UTC','states','all'),
 'coverage',jsonb_build_object('opportunities',(select count(*) from selected),'analytics',(select count(*) from public.analytics_days where brand_id=target_brand and observed_date between start_date and end_date and state='available'),'observations',(select count(*) from public.observation_samples s join public.research_runs r on r.id=s.run_id where r.brand_id=target_brand and r.created_at>=start_date::timestamp at time zone 'UTC' and r.created_at<(end_date+1)::timestamp at time zone 'UTC' and s.state='complete')),
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'account',account_label,'reference',account_reference,'state',state)),'[]'::jsonb) from public.brand_sources where brand_id=target_brand),
 'opportunities',(select coalesce(jsonb_agg(item),'[]'::jsonb) from items),
 'analytics_days',(select coalesce(jsonb_agg(to_jsonb(d) order by d.observed_date,d.source_id),'[]'::jsonb) from public.analytics_days d where d.brand_id=target_brand and d.observed_date between start_date and end_date),
 'research_runs',(select coalesce(jsonb_agg(to_jsonb(r)-'request_id'||jsonb_build_object('samples',(select coalesce(jsonb_agg(to_jsonb(s) order by s.ordinal),'[]'::jsonb) from public.observation_samples s where s.run_id=r.id),'checks',(select coalesce(jsonb_agg(to_jsonb(c) order by c.checked_at),'[]'::jsonb) from public.audit_checks c where c.run_id=r.id)) order by r.created_at),'[]'::jsonb) from public.research_runs r where r.brand_id=target_brand and r.created_at>=start_date::timestamp at time zone 'UTC' and r.created_at<(end_date+1)::timestamp at time zone 'UTC')) into payload;
 if (payload->'coverage'->>'opportunities')::integer>500 or octet_length(payload::text)>2000000 then raise exception 'Report too large; select a smaller date range' using errcode='22023'; end if;
 insert into public.client_reports(brand_id,title,range_start,range_end,annotation,snapshot,created_by,request_id) values(target_brand,btrim(report_title),start_date,end_date,report_annotation,payload,actor,creation_request_id) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'report.created',jsonb_build_object('report_id',result,'range_start',start_date,'range_end',end_date));
 return result;
end;
$$;
commit;
