begin;

-- Any signed-in shop member can find a receipt and handle a return.
alter policy "sales read" on public.sales using (public.is_authenticated_member());

do $$
declare definition text;
begin
  select pg_get_functiondef('public.adjust_sale_item(uuid,text,integer,integer,integer,numeric,boolean,text,text)'::regprocedure) into definition;
  if strpos(definition, 'Only the owner can adjust sales') = 0 then
    raise exception 'Expected adjustment authorization was not found';
  end if;
  definition := replace(definition,
    'if not public.is_owner() then raise exception ''Only the owner can adjust sales''; end if;',
    'if not public.is_authenticated_member() then raise exception ''Sign in as a shop member to adjust sales''; end if;');
  execute definition;
end $$;

-- Expose operational history without the cost/profit snapshots in the audit table.
-- This owner-executed view deliberately projects safe fields and checks membership.
create view public.sale_adjustment_history as
select id, sale_id, recorded_by, created_at, reason, restocked, refund_amount, payment_method,
  jsonb_build_object('total', before_sale->'total') as before_sale,
  jsonb_build_object('total', after_sale->'total') as after_sale
from public.sale_adjustments
where public.is_authenticated_member();
revoke all on public.sale_adjustment_history from public, anon;
grant select on public.sale_adjustment_history to authenticated;
commit;
