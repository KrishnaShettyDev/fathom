begin;
alter table public.brand_access_grants add column capabilities text[] not null default '{}' check(capabilities <@ array['knowledge.write','knowledge.approve','opportunities.manage','reports.create']::text[]),add column permission_version integer not null default 1;
create or replace function private.user_has_brand_access(actor uuid,target_brand uuid,capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.brand_memberships bm join public.organization_memberships om on om.organization_id=bm.organization_id and om.user_id=bm.user_id
 where bm.brand_id=target_brand and bm.user_id=actor and bm.active and om.active and (capability=any(bm.capabilities) or ('workspace.manage'=any(bm.capabilities) and capability=any(array['knowledge.write','knowledge.approve','opportunities.manage','reports.create']))))
 or exists(select 1 from public.brand_access_grants g join public.organization_memberships m on m.organization_id=g.agency_organization_id
 where g.brand_id=target_brand and g.active and m.user_id=actor and m.active and (capability='workspace.read' or (capability='integrations.connect' and g.access_level='operator') or capability=any(g.capabilities)))
 or exists(select 1 from public.support_sessions s
 join public.brand_memberships bm on bm.brand_id=s.brand_id and bm.user_id=s.owner_id and bm.active and 'workspace.manage'=any(bm.capabilities)
 join public.organization_memberships om on om.organization_id=bm.organization_id and om.user_id=bm.user_id and om.active
 where s.brand_id=target_brand and s.operator_id=actor and s.revoked_at is null and s.expires_at>statement_timestamp()
 and (capability='workspace.read' or (capability='integrations.connect' and s.access_level='operator')));
$$;
create or replace function public.save_brand_fact(target_brand uuid,fact_id uuid,expected_version integer,creation_request_id uuid,
  fact_category text,fact_statement text,source_note text,source_link text,fact_owner text,review_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_facts; result uuid;
begin
  if not private.has_brand_access(target_brand,'knowledge.write') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
  if fact_id is null then
    if creation_request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text||actor::text||creation_request_id::text,2));
    select * into existing from public.brand_facts f where f.brand_id=target_brand and f.created_by=actor and f.request_id=creation_request_id;
    if existing.id is not null then return existing.id; end if;
    insert into public.brand_facts(brand_id,category,statement,source_description,source_url,responsible_owner,review_on,created_by,updated_by,request_id)
    values(target_brand,fact_category,btrim(fact_statement),btrim(source_note),nullif(btrim(source_link),''),btrim(fact_owner),review_date,actor,actor,creation_request_id)
    returning id into result;
  else
    select * into existing from public.brand_facts f where f.id=fact_id and f.brand_id=target_brand for update;
    if existing.id is null then raise exception 'Fact unavailable' using errcode='42501'; end if;
    if expected_version is distinct from existing.version then raise exception 'Fact changed; reload before editing' using errcode='40001'; end if;
    update public.brand_facts f set category=fact_category,statement=btrim(fact_statement),source_description=btrim(source_note),source_url=nullif(btrim(source_link),''),responsible_owner=btrim(fact_owner),review_on=review_date,
      version=f.version+1,state='pending',approved_by=null,approved_at=null,updated_by=actor,updated_at=now()
      where f.id=fact_id returning id into result;
  end if;
  return result;
end;
$$;
create or replace function public.review_brand_fact(target_brand uuid,fact_id uuid,expected_version integer,decision text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_facts;
begin
  if not private.has_brand_access(target_brand,'knowledge.approve') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
  if decision is null or decision not in ('approved','archived') then raise exception 'Invalid review decision' using errcode='22023'; end if;
  select * into existing from public.brand_facts f where f.id=fact_id and f.brand_id=target_brand for update;
  if existing.id is null then raise exception 'Fact unavailable' using errcode='42501'; end if;
  if expected_version is distinct from existing.version then raise exception 'Fact changed; reload before reviewing' using errcode='40001'; end if;
  if decision='approved' and (existing.state<>'pending' or existing.review_on<current_date) then raise exception 'Only current pending facts can be approved' using errcode='22023'; end if;
  if existing.state=decision then return; end if;
  update public.brand_facts f set state=decision,version=f.version+1,updated_at=now(),updated_by=actor,
    approved_by=case when decision='approved' then actor else null end,
    approved_at=case when decision='approved' then now() else null end where f.id=fact_id;
end;
$$;
create or replace function public.create_opportunity(target_brand uuid,creation_request_id uuid,opportunity_title text,problem_description text,
 action_description text,confidence_description text,relevance_description text,affected text,effort_size text,evidence_fact uuid,evidence_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid; fact public.brand_facts;
begin
 if not private.has_brand_access(target_brand,'opportunities.manage') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
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
create or replace function public.update_opportunity(target_brand uuid,opportunity uuid,expected_version integer,next_state text,next_priority integer,assignee text,snooze_to text,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); current_row public.opportunities; assigned uuid:=nullif(assignee,'')::uuid; until_time timestamptz:=nullif(snooze_to,'')::timestamptz;
begin
 if not private.has_brand_access(target_brand,'opportunities.manage') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
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
create or replace function public.comment_opportunity(target_brand uuid,opportunity uuid,comment_body text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'opportunities.manage') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.opportunities where brand_id=target_brand and id=opportunity) then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 if comment_body is null or length(btrim(comment_body)) not between 1 and 4000 then raise exception 'Comment required' using errcode='22023'; end if;
 insert into public.opportunity_events(brand_id,opportunity_id,actor_id,event_type,details) values(target_brand,opportunity,actor,'comment',jsonb_build_object('body',btrim(comment_body)));
end;
$$;
create or replace function public.refresh_opportunity_evidence(target_brand uuid,opportunity uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); current_row public.opportunities; fact public.brand_facts;
begin
 if not private.has_brand_access(target_brand,'opportunities.manage') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
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
create or replace function public.create_client_report(target_brand uuid,creation_request_id uuid,report_title text,start_date date,end_date date,report_annotation text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid; payload jsonb;
begin
 if not private.has_brand_access(target_brand,'reports.create') then raise exception 'Required workflow permission unavailable' using errcode='42501'; end if;
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

create function public.set_agency_capabilities(target_brand uuid,access_grant uuid,expected_version integer,requested_capabilities text[]) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 if requested_capabilities is null or array_position(requested_capabilities,null) is not null then raise exception 'Invalid capabilities' using errcode='22023';end if;
 update public.brand_access_grants set capabilities=requested_capabilities,permission_version=permission_version+1 where id=access_grant and brand_id=target_brand and active and permission_version=expected_version;
 if not found then raise exception 'Grant unavailable or changed' using errcode='40001';end if;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'agency.capabilities_changed',jsonb_build_object('grant_id',access_grant,'capabilities',requested_capabilities,'version',expected_version+1));
end;
$$;
create function public.list_opportunity_assignees(target_brand uuid) returns table(user_id uuid,email text) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_brand_access(target_brand,'opportunities.manage') then raise exception 'Workflow permission required' using errcode='42501';end if;
 return query select u.id,u.email::text from auth.users u where u.email_confirmed_at is not null and (
 exists(select 1 from public.brand_memberships bm where bm.brand_id=target_brand and bm.user_id=u.id and bm.active)
 or exists(select 1 from public.brand_access_grants g join public.organization_memberships m on m.organization_id=g.agency_organization_id where g.brand_id=target_brand and g.active and m.user_id=u.id and m.active))
 and private.user_has_brand_access(u.id,target_brand,'workspace.read') order by u.email limit 100;
end;
$$;
revoke all on function public.set_agency_capabilities(uuid,uuid,integer,text[]),public.list_opportunity_assignees(uuid) from public,anon;
grant execute on function public.set_agency_capabilities(uuid,uuid,integer,text[]),public.list_opportunity_assignees(uuid) to authenticated;
commit;
