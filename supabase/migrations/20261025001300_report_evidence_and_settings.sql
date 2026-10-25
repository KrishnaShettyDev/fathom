begin;
create function public.update_brand_settings(target_brand uuid,brand_name text,website_url text,timezone_name text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor();
begin
 if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501';end if;
 if timezone_name is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone' using errcode='22023';end if;
 update public.brand_workspaces set name=btrim(brand_name),website=nullif(btrim(website_url),''),reporting_timezone=timezone_name where id=target_brand;
 insert into audit.events(brand_id,actor_id,event_type,details) values(target_brand,actor,'workspace.settings_changed',jsonb_build_object('name',brand_name,'website',website_url,'reporting_timezone',timezone_name));
end;
$$;
revoke all on function public.update_brand_settings(uuid,text,text,text) from public,anon;
grant execute on function public.update_brand_settings(uuid,text,text,text) to authenticated;
-- Cohort subjects must stay distinct so a comparison cannot silently collapse keys.
create function private.check_cohort_subjects() returns trigger language plpgsql set search_path='' as $$
begin
 if cardinality(new.subjects)<>(select count(distinct lower(btrim(subject))) from unnest(new.subjects) subject) then raise exception 'Subject names must be distinct' using errcode='22023';end if;
 return new;
end;
$$;
revoke all on function private.check_cohort_subjects() from public,anon,authenticated;
create trigger cohort_subjects_check before insert on public.observation_cohorts for each row execute function private.check_cohort_subjects();
commit;
