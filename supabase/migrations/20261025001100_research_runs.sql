begin;
alter table public.collection_allowances add column monthly_observation_limit integer not null default 0 check(monthly_observation_limit between 0 and 1000);
create table public.observation_cohorts (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brand_workspaces(id),
 name text not null check(length(btrim(name)) between 1 and 120),
 questions text[] not null check(cardinality(questions) between 1 and 5),
 subjects text[] not null check(cardinality(subjects) between 1 and 5),
 market text not null check(length(btrim(market)) between 1 and 120),language text not null check(length(btrim(language)) between 1 and 80),
 model text not null check(length(btrim(model)) between 1 and 120),samples integer not null check(samples between 1 and 3),
 interval_days integer not null default 7 check(interval_days between 1 and 30),
 scheduled boolean not null default false,next_run_at timestamptz,
 permission_attested boolean not null check(permission_attested),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(brand_id,id)
);
create table public.research_runs (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brand_workspaces(id),
 actor_id uuid not null references auth.users(id),request_id uuid not null,
 kind text not null check(kind in ('audit','observation')),cohort_id uuid,
 state text not null default 'scheduled' check(state in ('scheduled','collecting','complete','partial','failed','cancelled')),
 target_url text,expected_samples integer not null default 0,completed_samples integer not null default 0,
 snapshot jsonb not null default '{}',error_code text,
 created_at timestamptz not null default now(),completed_at timestamptz,fresh_until timestamptz,
 unique(brand_id,id),unique(brand_id,actor_id,request_id),
 foreign key(brand_id,cohort_id) references public.observation_cohorts(brand_id,id),
 check((kind='observation')=(cohort_id is not null))
);
create unique index one_active_research on public.research_runs(brand_id,kind) where state in ('scheduled','collecting');
create index research_runs_list on public.research_runs(brand_id,created_at desc,id desc);
create table private.research_outbox(run_id uuid primary key references public.research_runs(id),dispatched_at timestamptz,created_at timestamptz not null default now());
create table public.observation_samples (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null,run_id uuid not null,ordinal integer not null,
 question text not null,state text not null check(state in ('complete','failed','unknown')),
 answer text,mentions jsonb not null default '{}',provider_response_id text,actual_model text,
 error_code text,usage jsonb,observed_at timestamptz not null default now(),
 unique(run_id,ordinal),foreign key(brand_id,run_id) references public.research_runs(brand_id,id),
 check((state='complete')=(answer is not null))
);
create table public.audit_checks (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null,run_id uuid not null,
 url text not null,status integer,error_code text,evidence jsonb not null default '{}',checked_at timestamptz not null default now(),
 unique(run_id,url),foreign key(brand_id,run_id) references public.research_runs(brand_id,id)
);
create table public.audit_findings (
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brand_workspaces(id),
 url text not null,code text not null,severity text not null check(severity in ('error','notice')),
 explanation text not null,evidence text not null,state text not null default 'open' check(state in ('open','resolved')),
 first_seen_at timestamptz not null default now(),last_checked_at timestamptz not null default now(),last_run_id uuid not null,
 unique(brand_id,url,code),foreign key(brand_id,last_run_id) references public.research_runs(brand_id,id)
);
create trigger observation_samples_immutable before update or delete on public.observation_samples for each row execute function audit.reject_mutation();
create trigger audit_checks_immutable before update or delete on public.audit_checks for each row execute function audit.reject_mutation();
alter table public.observation_cohorts enable row level security;
alter table public.research_runs enable row level security;
alter table public.observation_samples enable row level security;
alter table public.audit_checks enable row level security;
alter table public.audit_findings enable row level security;
revoke all on public.observation_cohorts,public.research_runs,public.observation_samples,public.audit_checks,public.audit_findings from anon,authenticated;
grant select on public.observation_cohorts,public.research_runs,public.observation_samples,public.audit_checks,public.audit_findings to authenticated;
revoke all on private.research_outbox from public,anon,authenticated;
create policy cohorts_read on public.observation_cohorts for select to authenticated using(private.has_brand_access(brand_id));
create policy research_runs_read on public.research_runs for select to authenticated using(private.has_brand_access(brand_id));
create policy samples_read on public.observation_samples for select to authenticated using(private.has_brand_access(brand_id));
create policy audit_checks_read on public.audit_checks for select to authenticated using(private.has_brand_access(brand_id));
create policy findings_read on public.audit_findings for select to authenticated using(private.has_brand_access(brand_id));
create function public.create_observation_cohort(target_brand uuid,cohort_name text,question_list text[],competitors text[],requested_market text,requested_language text,model_id text,sample_count integer,permission_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); result uuid; brand_name text;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 if question_list is null or exists(select 1 from unnest(question_list) q where q is null or length(btrim(q)) not between 1 and 1000) or competitors is null or cardinality(competitors)>4 or exists(select 1 from unnest(competitors) c where c is null or length(btrim(c)) not between 1 and 120) then raise exception 'Invalid cohort questions or subjects' using errcode='22023'; end if;
 select name into brand_name from public.brand_workspaces where id=target_brand;
 insert into public.observation_cohorts(brand_id,name,questions,subjects,market,language,model,samples,permission_attested,created_by) values(target_brand,btrim(cohort_name),question_list,array[brand_name]||competitors,requested_market,requested_language,model_id,sample_count,permission_confirmed,actor) returning id into result;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'observation.cohort_created',jsonb_build_object('cohort_id',result));return result;
end;
$$;
create function public.set_observation_allowance(target_brand uuid,request_limit integer) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 insert into public.collection_allowances(brand_id,monthly_observation_limit) values(target_brand,request_limit) on conflict(brand_id) do update set monthly_observation_limit=excluded.monthly_observation_limit,updated_at=now();
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'observation.allowance_changed',jsonb_build_object('request_limit',request_limit));
end;
$$;
create function public.request_research(target_brand uuid,research_kind text,cohort text,creation_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); selected public.observation_cohorts; result uuid; allowance integer; expected integer:=0; target text;
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
 if creation_request_id is null or research_kind is null or research_kind not in ('audit','observation') then raise exception 'Invalid research request' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_brand::text,8));
 select id into result from public.research_runs where brand_id=target_brand and actor_id=actor and request_id=creation_request_id;if result is not null then return result;end if;
 if exists(select 1 from public.research_runs where brand_id=target_brand and kind=research_kind and state in ('scheduled','collecting')) then raise exception 'A run is already active' using errcode='22023';end if;
 if research_kind='observation' then
  select * into selected from public.observation_cohorts where id=nullif(cohort,'')::uuid and brand_id=target_brand;
  if selected.id is null then raise exception 'Cohort unavailable' using errcode='42501';end if;
  expected:=cardinality(selected.questions)*selected.samples;
  select monthly_observation_limit into allowance from public.collection_allowances where brand_id=target_brand;
  if coalesce((select sum(expected_samples) from public.research_runs where brand_id=target_brand and kind='observation' and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0)+expected>coalesce(allowance,0) then raise exception 'Observation allowance exhausted' using errcode='54000';end if;
 else
  select website into target from public.brand_workspaces where id=target_brand;if target is null then raise exception 'Brand website required' using errcode='22023';end if;
  if (select count(*) from public.research_runs where brand_id=target_brand and kind='audit' and created_at>now()-interval '1 day')>=5 then raise exception 'Daily audit allowance exhausted' using errcode='54000';end if;
 end if;
 insert into public.research_runs(brand_id,actor_id,request_id,kind,cohort_id,target_url,expected_samples,snapshot,fresh_until)
 values(target_brand,actor,creation_request_id,research_kind,selected.id,target,expected,case when research_kind='observation' then to_jsonb(selected)||jsonb_build_object('method','openai_responses_api','verified_geography',null,'parser_version','exact-normalized-text-v1','max_output_tokens',1000) else jsonb_build_object('method','static_html_audit_v1','page_limit',20) end,now()+interval '7 days') returning id into result;
 insert into private.research_outbox(run_id) values(result);
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'research.queued',jsonb_build_object('run_id',result,'kind',research_kind,'reserved_samples',expected));return result;
end;
$$;
create function private.research_authorized(run uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.research_runs r where r.id=run and r.state in ('scheduled','collecting') and private.user_has_brand_access(r.actor_id,r.brand_id,'workspace.manage'));
$$;
revoke all on function private.research_authorized(uuid) from public,anon,authenticated;
revoke all on function public.create_observation_cohort(uuid,text,text[],text[],text,text,text,integer,boolean),public.set_observation_allowance(uuid,integer),public.request_research(uuid,text,text,uuid) from public,anon;
grant execute on function public.create_observation_cohort(uuid,text,text[],text[],text,text,text,integer,boolean),public.set_observation_allowance(uuid,integer),public.request_research(uuid,text,text,uuid) to authenticated;
commit;
