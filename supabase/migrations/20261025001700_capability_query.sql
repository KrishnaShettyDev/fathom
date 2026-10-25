begin;
create function public.current_brand_capability(target_brand uuid,capability text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 return private.user_has_brand_access(private.verified_actor(),target_brand,capability);
end;
$$;
revoke all on function public.current_brand_capability(uuid,text) from public,anon;
grant execute on function public.current_brand_capability(uuid,text) to authenticated;
commit;
