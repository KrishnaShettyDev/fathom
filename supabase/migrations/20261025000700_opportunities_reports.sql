begin;
create table public.opportunities (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brand_workspaces(id),
 title text not null check(length(btrim(title)) between 1 and 180),
 problem text not null check(length(btrim(problem)) between 1 and 4000),
 proposed_action text not null check(length(btrim(proposed_action)) between 1 and 4000),
 confidence_reason text not null check(length(btrim(confidence_reason)) between 1 and 2000),
 business_relevance text not null check(length(btrim(business_relevance)) between 1 and 2000),
 affected_reference text not null check(length(btrim(affected_reference)) between 1 and 2048),
 effort text not null check(effort in ('small','medium','large')),
 priority integer not null default 2 check(priority between 1 and 3),
 state text not null default 'open' check(state in ('open','in_progress','snoozed','dismissed','completed')),
 assignee_id uuid references auth.users(id),
 snooze_until timestamptz,
 decision_reason text,
 fact_id uuid not null,
 fact_version integer not null,
 evidence_needs_review boolean not null default false,
 version integer not null default 1,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 request_id uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(brand_id,id),unique(brand_id,created_by,request_id),
 foreign key(brand_id,fact_id) references public.brand_facts(brand_id,id),
 foreign key(fact_id,fact_version) references public.brand_fact_revisions(fact_id,version),
 check((state='snoozed')=(snooze_until is not null)),
 check(state<>'dismissed' or length(btrim(decision_reason)) between 1 and 2000)
);
create index opportunities_list on public.opportunities(brand_id,created_at desc,id desc);
create table public.opportunity_events (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 opportunity_id uuid not null,
 actor_id uuid not null references auth.users(id),
 event_type text not null,
 details jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(brand_id,opportunity_id) references public.opportunities(brand_id,id)
);
create index opportunity_events_list on public.opportunity_events(brand_id,opportunity_id,created_at desc,id desc);
create trigger opportunity_events_immutable before update or delete on public.opportunity_events for each row execute function audit.reject_mutation();
create table public.client_reports (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brand_workspaces(id),
 title text not null check(length(btrim(title)) between 1 and 180),
 range_start date not null,
 range_end date not null,
 annotation text not null check(length(annotation)<=4000),
 snapshot jsonb not null,
 created_by uuid not null references auth.users(id),
 request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(brand_id,created_by,request_id),
 check(range_end>=range_start and range_end-range_start<=366)
);
create index reports_list on public.client_reports(brand_id,created_at desc,id desc);
create trigger reports_immutable before update or delete on public.client_reports for each row execute function audit.reject_mutation();
alter table public.opportunities enable row level security;
alter table public.opportunity_events enable row level security;
alter table public.client_reports enable row level security;
revoke all on public.opportunities,public.opportunity_events,public.client_reports from anon,authenticated;
grant select on public.opportunities,public.opportunity_events,public.client_reports to authenticated;
create policy opportunities_read on public.opportunities for select to authenticated using(private.has_brand_access(brand_id));
create policy opportunity_events_read on public.opportunity_events for select to authenticated using(private.has_brand_access(brand_id));
create policy reports_read on public.client_reports for select to authenticated using(private.has_brand_access(brand_id));

create function public.create_opportunity(target_brand uuid,creation_request_id uuid,opportunity_title text,problem_description text,
 action_description text,confidence_description text,relevance_description text,affected text,effort_size text,evidence_fact uuid,evidence_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid; fact public.brand_facts;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 if creation_request_id is null then raise exception 'Request required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text||actor::text||creation_request_id::text,4));
 select id into result from public.opportunities where brand_id=target_brand and created_by=actor and request_id=creation_request_id;
 if result is not null then return result; end if;
 select * into fact from public.brand_facts where brand_id=target_brand and id=evidence_fact for share;
 if fact.id is null then raise exception 'Evidence unavailable' using errcode='42501'; end if;
 if fact.version is distinct from evidence_version or fact.state<>'approved' or fact.review_on<current_date then raise exception 'Current approved evidence required' using errcode='22023'; end if;
 insert into public.opportunities(brand_id,title,problem,proposed_action,confidence_reason,business_relevance,affected_reference,effort,fact_id,fact_version,created_by,updated_by,request_id)
 values(target_brand,btrim(opportunity_title),btrim(problem_description),btrim(action_description),btrim(confidence_description),btrim(relevance_description),btrim(affected),effort_size,evidence_fact,evidence_version,actor,actor,creation_request_id) returning id into result;
 insert into public.opportunity_events(brand_id,opportunity_id,actor_id,event_type,details) values(target_brand,result,actor,'created',jsonb_build_object('fact_id',evidence_fact,'fact_version',evidence_version));
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'opportunity.created',jsonb_build_object('opportunity_id',result));
 return result;
end;
$$;
create function public.update_opportunity(target_brand uuid,opportunity uuid,expected_version integer,next_state text,next_priority integer,assignee text,snooze_to text,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); current_row public.opportunities; assigned uuid:=nullif(assignee,'')::uuid; until_time timestamptz:=nullif(snooze_to,'')::timestamptz;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 select * into current_row from public.opportunities where brand_id=target_brand and id=opportunity for update;
 if current_row.id is null then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 if expected_version is distinct from current_row.version then raise exception 'Opportunity changed' using errcode='40001'; end if;
 if assigned is not null and not private.user_has_brand_access(assigned,target_brand,'workspace.read') then raise exception 'Assignee must have current brand access' using errcode='22023'; end if;
 if next_state='snoozed' and (until_time is null or until_time<=now() or until_time>now()+interval '366 days') then raise exception 'Invalid snooze date' using errcode='22023'; end if;
 if next_state<>'snoozed' then until_time:=null; end if;
 if reason is null or length(reason)>2000 or (next_state='dismissed' and length(btrim(reason))=0) then raise exception 'Decision reason required' using errcode='22023'; end if;
 if next_state='completed' and (current_row.evidence_needs_review or not exists(select 1 from public.brand_facts where id=current_row.fact_id and version=current_row.fact_version and state='approved' and review_on>=current_date)) then raise exception 'Review current evidence before completing' using errcode='22023'; end if;
 update public.opportunities set state=next_state,priority=next_priority,assignee_id=assigned,snooze_until=until_time,decision_reason=nullif(btrim(reason),''),version=version+1,updated_by=actor,updated_at=now() where id=opportunity;
 insert into public.opportunity_events(brand_id,opportunity_id,actor_id,event_type,details) values(target_brand,opportunity,actor,'updated',jsonb_build_object('previous_state',current_row.state,'state',next_state,'priority',next_priority,'assignee_id',assigned,'snooze_until',until_time,'reason',reason,'version',current_row.version+1));
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'opportunity.updated',jsonb_build_object('opportunity_id',opportunity,'version',current_row.version+1));
end;
$$;
create function public.comment_opportunity(target_brand uuid,opportunity uuid,comment_body text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 if not exists(select 1 from public.opportunities where brand_id=target_brand and id=opportunity) then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 if comment_body is null or length(btrim(comment_body)) not between 1 and 4000 then raise exception 'Comment required' using errcode='22023'; end if;
 insert into public.opportunity_events(brand_id,opportunity_id,actor_id,event_type,details) values(target_brand,opportunity,actor,'comment',jsonb_build_object('body',btrim(comment_body)));
end;
$$;
create function private.invalidate_fact_opportunities() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.opportunities set evidence_needs_review=true,version=version+1,updated_at=now(),updated_by=new.updated_by where fact_id=new.id and fact_version<>new.version and not evidence_needs_review;
 return new;
end;
$$;
revoke all on function private.invalidate_fact_opportunities() from public,anon,authenticated;
create trigger fact_opportunity_invalidation after update on public.brand_facts for each row execute function private.invalidate_fact_opportunities();
create function public.refresh_opportunity_evidence(target_brand uuid,opportunity uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); current_row public.opportunities; fact public.brand_facts;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 -- Lock fact before opportunity, matching the fact-change trigger's lock order.
 select f.* into fact from public.brand_facts f join public.opportunities o on o.fact_id=f.id where o.id=opportunity and o.brand_id=target_brand for share of f;
 select * into current_row from public.opportunities where id=opportunity and brand_id=target_brand for update;
 if current_row.id is null then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 if current_row.version is distinct from expected_version then raise exception 'Opportunity changed' using errcode='40001'; end if;
 if fact.state<>'approved' or fact.review_on<current_date then raise exception 'Current approved evidence required' using errcode='22023'; end if;
 update public.opportunities set fact_version=fact.version,evidence_needs_review=false,version=version+1,updated_by=actor,updated_at=now() where id=opportunity;
 insert into public.opportunity_events(brand_id,opportunity_id,actor_id,event_type,details) values(target_brand,opportunity,actor,'evidence_reviewed',jsonb_build_object('fact_id',fact.id,'fact_version',fact.version));
end;
$$;
create function public.create_client_report(target_brand uuid,creation_request_id uuid,report_title text,start_date date,end_date date,report_annotation text)
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
 select jsonb_build_object('schema_version',1,'captured_at',now(),'brand',(select jsonb_build_object('id',id,'name',name,'reporting_timezone',reporting_timezone) from public.brand_workspaces where id=target_brand),
 'methodology','Manually reviewed opportunity workflow. UTC creation-date filter, inclusive dates. No causal or revenue claims. Metrics and observations are unavailable until source collection is implemented.',
 'filters',jsonb_build_object('range_start',start_date,'range_end',end_date,'date_field','opportunity.created_at','filter_timezone','UTC','states','all'),
 'coverage',jsonb_build_object('opportunities',(select count(*) from selected),'analytics',null,'observations',null),
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'account',account_label,'reference',account_reference,'state',state)),'[]'::jsonb) from public.brand_sources where brand_id=target_brand),
 'opportunities',(select coalesce(jsonb_agg(item),'[]'::jsonb) from items)) into payload;
 if (payload->'coverage'->>'opportunities')::integer>500 or octet_length(payload::text)>2000000 then raise exception 'Report too large; select a smaller date range' using errcode='22023'; end if;
 insert into public.client_reports(brand_id,title,range_start,range_end,annotation,snapshot,created_by,request_id) values(target_brand,btrim(report_title),start_date,end_date,report_annotation,payload,actor,creation_request_id) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'report.created',jsonb_build_object('report_id',result,'range_start',start_date,'range_end',end_date));
 return result;
end;
$$;
revoke all on function public.create_opportunity(uuid,uuid,text,text,text,text,text,text,text,uuid,integer),public.update_opportunity(uuid,uuid,integer,text,integer,text,text,text),public.comment_opportunity(uuid,uuid,text),public.refresh_opportunity_evidence(uuid,uuid,integer),public.create_client_report(uuid,uuid,text,date,date,text) from public,anon;
grant execute on function public.create_opportunity(uuid,uuid,text,text,text,text,text,text,text,uuid,integer),public.update_opportunity(uuid,uuid,integer,text,integer,text,text,text),public.comment_opportunity(uuid,uuid,text),public.refresh_opportunity_evidence(uuid,uuid,integer),public.create_client_report(uuid,uuid,text,date,date,text) to authenticated;
commit;
