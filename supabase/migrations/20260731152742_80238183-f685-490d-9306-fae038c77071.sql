begin;
revoke all on function public.handle_new_user() from public, anon;
grant execute on function public.handle_new_user() to authenticated, service_role;
commit;
notify pgrst, 'reload schema';