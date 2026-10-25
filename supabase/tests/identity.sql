begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);
-- Isolated test principals. The transaction rolls back; there are no app seeds.
insert into auth.users(id,email,email_confirmed_at) values
('11111111-1111-4111-8111-111111111111','owner-one@example.invalid',now()),
('22222222-2222-4222-8222-222222222222','owner-two@example.invalid',now()),
('33333333-3333-4333-8333-333333333333','unconfirmed@example.invalid',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select lives_ok($$select public.create_owner_workspace('Organization One','Brand One','UTC','https://one.example.invalid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true)$$,'Authenticated owner can create a workspace');
select is((select count(*)::int from public.brand_workspaces),1,'Owner sees their workspace');
select is(public.create_owner_workspace('Organization One','Brand One','UTC','','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),(select id from public.brand_workspaces limit 1),'Same request returns the existing brand');
select is((select count(*)::int from public.organizations),1,'Retry does not duplicate the organization');
select throws_ok($$select public.create_owner_workspace('X','X','UTC','','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',false)$$,'22023',null,'Attestation is mandatory');
select throws_ok($$select public.create_owner_workspace('X','X','Invalid/Timezone','','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',true)$$,'22023',null,'Invalid timezones fail at the database boundary');
select throws_ok($$insert into public.brand_workspaces(name,owner_organization_id,reporting_timezone,created_by,request_id) values('Injected','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UTC',auth.uid(),gen_random_uuid())$$,'42501',null,'Direct workspace insertion is denied');
select throws_ok($$update public.brand_memberships set capabilities=array['workspace.manage']$$,'42501',null,'Members cannot escalate their own capabilities');
select throws_ok($$select * from audit.events$$,'42501',null,'Audit schema is not exposed to clients');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is((select count(*)::int from public.brand_workspaces),0,'Unrelated user cannot list the first brand');
select lives_ok($$select public.create_owner_workspace('Organization Two','Brand Two','Asia/Kolkata','','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true)$$,'Second user can create a separate brand');
select results_eq($$select name from public.brand_workspaces$$,array['Brand Two']::text[],'List returns only the second user brand');
select is((select count(*)::int from public.brand_memberships where user_id='11111111-1111-4111-8111-111111111111'),0,'Membership records do not leak across users');
reset role;
update public.brand_memberships set active=false where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select is((select count(*)::int from public.brand_workspaces),0,'Revoked brand membership takes effect immediately');
select throws_ok($$select public.create_owner_workspace('Organization One','Brand One','UTC','','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true)$$,'42501',null,'An idempotent retry does not restore revoked access');
reset role;
update public.organization_memberships set active=false where user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select is((select count(*)::int from public.brand_workspaces),0,'Revoking organization membership also blocks the brand');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_workspace('X','X','UTC','','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true)$$,'42501',null,'Unconfirmed email cannot create a workspace');
reset role;
set local role anon;
select throws_ok($$select * from public.brand_workspaces$$,'42501',null,'Anonymous clients cannot read brands');
select throws_ok($$select public.create_owner_workspace('X','X','UTC','','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true)$$,'42501',null,'Anonymous clients cannot call onboarding');
reset role;
select throws_ok($$update audit.events set event_type='tampered'$$,'42501',null,'Audit events are append-only even for privileged callers');
select * from finish();
rollback;
