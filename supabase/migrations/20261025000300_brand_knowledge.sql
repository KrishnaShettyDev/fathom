begin;
create table public.brand_facts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_workspaces(id),
  category text not null check(category in ('product','positioning','audience','tone','prohibited_claim','market','goal','commercial')),
  statement text not null check(length(btrim(statement)) between 1 and 4000),
  source_description text not null check(length(btrim(source_description)) between 1 and 2000),
  source_url text check(source_url is null or (length(source_url)<=2048 and source_url ~ '^https?://[^[:space:]]+$')),
  responsible_owner text not null check(length(btrim(responsible_owner)) between 1 and 120),
  review_on date not null,
  version integer not null default 1 check(version>0),
  state text not null default 'pending' check(state in ('pending','approved','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id,id),
  unique(brand_id,created_by,request_id),
  check((state='approved')=(approved_by is not null and approved_at is not null))
);
create index brand_facts_list on public.brand_facts(brand_id,created_at desc,id desc);
create table public.brand_fact_revisions (
  brand_id uuid not null,
  fact_id uuid not null,
  version integer not null,
  snapshot jsonb not null,
  actor_id uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  primary key(fact_id,version),
  foreign key(brand_id,fact_id) references public.brand_facts(brand_id,id)
);
create trigger fact_revisions_immutable before update or delete on public.brand_fact_revisions
for each row execute function audit.reject_mutation();
alter table public.brand_facts enable row level security;
alter table public.brand_fact_revisions enable row level security;
revoke all on public.brand_facts,public.brand_fact_revisions from anon,authenticated;
grant select on public.brand_facts,public.brand_fact_revisions to authenticated;
create policy facts_read on public.brand_facts for select to authenticated using(private.has_brand_access(brand_id));
create policy fact_revisions_read on public.brand_fact_revisions for select to authenticated using(private.has_brand_access(brand_id));

create function private.record_fact_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.brand_fact_revisions(brand_id,fact_id,version,snapshot,actor_id)
  values(new.brand_id,new.id,new.version,to_jsonb(new)-'request_id',new.updated_by);
  insert into audit.events(brand_id,actor_id,event_type,details)
  values(new.brand_id,new.updated_by,'knowledge.'||new.state,jsonb_build_object('fact_id',new.id,'version',new.version));
  return new;
end;
$$;
revoke all on function private.record_fact_revision() from public,anon,authenticated;
create trigger fact_revision_record after insert or update on public.brand_facts
for each row execute function private.record_fact_revision();

create function public.save_brand_fact(target_brand uuid,fact_id uuid,expected_version integer,creation_request_id uuid,
  fact_category text,fact_statement text,source_note text,source_link text,fact_owner text,review_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_facts; result uuid;
begin
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
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
create function public.review_brand_fact(target_brand uuid,fact_id uuid,expected_version integer,decision text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.verified_actor(); existing public.brand_facts;
begin
  if not private.has_brand_access(target_brand,'workspace.manage') then raise exception 'Brand management required' using errcode='42501'; end if;
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
revoke all on function public.save_brand_fact(uuid,uuid,integer,uuid,text,text,text,text,text,date),public.review_brand_fact(uuid,uuid,integer,text) from public,anon;
grant execute on function public.save_brand_fact(uuid,uuid,integer,uuid,text,text,text,text,text,date),public.review_brand_fact(uuid,uuid,integer,text) to authenticated;
commit;
