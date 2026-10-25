begin;
create table private.observation_attempts(run_id uuid not null references public.research_runs(id),ordinal integer not null,started_at timestamptz not null default now(),primary key(run_id,ordinal));
revoke all on private.observation_attempts from public,anon,authenticated;
create function public.cancel_research(target_brand uuid,run uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 update public.research_runs set state='cancelled',completed_at=now(),error_code='CANCELLED_BY_OWNER' where id=run and brand_id=target_brand and state in ('scheduled','collecting');
 if found then insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'research.cancelled',jsonb_build_object('run_id',run));end if;
end;
$$;
create function public.schedule_observation_cohort(target_brand uuid,cohort uuid,enabled boolean,frequency_days integer) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 update public.observation_cohorts set scheduled=enabled,interval_days=frequency_days,next_run_at=case when enabled then now()+frequency_days*interval '1 day' else null end where id=cohort and brand_id=target_brand;
 if not found then raise exception 'Cohort unavailable' using errcode='42501';end if;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'observation.schedule_changed',jsonb_build_object('cohort_id',cohort,'enabled',enabled,'interval_days',frequency_days));
end;
$$;
create function private.schedule_observations() returns integer language plpgsql security definer set search_path='' as $$
declare cohort public.observation_cohorts; total integer:=0; previous_claims text:=current_setting('request.jwt.claims',true);
begin
 for cohort in select * from public.observation_cohorts where scheduled and next_run_at<=now() order by next_run_at limit 10 for update skip locked loop
  if not private.user_has_brand_access(cohort.created_by,cohort.brand_id,'workspace.manage') then continue;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',cohort.created_by,'role','authenticated')::text,true);
  begin
   perform public.request_research(cohort.brand_id,'observation',cohort.id::text,gen_random_uuid());
   update public.observation_cohorts set next_run_at=now()+interval_days*interval '1 day' where id=cohort.id;total:=total+1;
  exception when sqlstate '54000' then
   update public.observation_cohorts set next_run_at=date_trunc('month',now())+interval '1 month' where id=cohort.id;
  when sqlstate '22023' then
   update public.observation_cohorts set next_run_at=now()+interval '1 hour' where id=cohort.id;
  end;
 end loop;
 perform set_config('request.jwt.claims',coalesce(previous_claims,'{}'),true);return total;
end;
$$;
revoke all on function private.schedule_observations() from public,anon,authenticated;
revoke all on function public.cancel_research(uuid,uuid),public.schedule_observation_cohort(uuid,uuid,boolean,integer) from public,anon;
grant execute on function public.cancel_research(uuid,uuid),public.schedule_observation_cohort(uuid,uuid,boolean,integer) to authenticated;
commit;
