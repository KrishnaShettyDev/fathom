begin;
-- Separate creation from editing so callers never need a nullable fact selector.
create function public.create_brand_fact(target_brand uuid,creation_request_id uuid,fact_category text,
  fact_statement text,source_note text,source_link text,fact_owner text,review_date date)
returns uuid language sql security invoker set search_path='' as $$
 select public.save_brand_fact(target_brand,null,0,creation_request_id,fact_category,fact_statement,source_note,source_link,fact_owner,review_date);
$$;
revoke all on function public.create_brand_fact(uuid,uuid,text,text,text,text,text,date) from public,anon;
grant execute on function public.create_brand_fact(uuid,uuid,text,text,text,text,text,date) to authenticated;
commit;
