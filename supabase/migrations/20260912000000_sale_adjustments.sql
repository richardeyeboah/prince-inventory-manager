begin;

alter table public.sales add column adjustment_version integer not null default 0;
create table public.sale_adjustments (
  id uuid primary key,
  sale_id text not null references public.sales(id) on delete restrict,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) > 0),
  before_sale jsonb not null,
  after_sale jsonb not null,
  before_lines jsonb not null,
  after_lines jsonb not null,
  restocked integer not null,
  refund_amount numeric(12,2) not null check (refund_amount >= 0),
  payment_method text not null check (payment_method in ('cash','mobile_money','card','transfer'))
);
alter table public.sale_adjustments enable row level security;
create policy "owner adjustment history" on public.sale_adjustments for select to authenticated using (public.is_owner());
create table public.refunds (
  id uuid primary key references public.sale_adjustments(id),
  sale_id text not null references public.sales(id),
  customer_id uuid references public.customers(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  notes text not null,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.refunds enable row level security;
create policy "member refund history" on public.refunds for select to authenticated using (public.is_authenticated_member());
grant select on public.sale_adjustments, public.refunds to authenticated;
-- All writes go through the transactional functions.
revoke insert, update, delete on public.sale_adjustments, public.refunds from authenticated, anon;
drop policy if exists "sales owner update" on public.sales;

create function public.adjust_sale_item(
  p_id uuid, p_sale_id text, p_version integer, p_line_number integer,
  p_quantity integer, p_unit_price numeric, p_restock boolean,
  p_reason text, p_payment_method text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.sales%rowtype;
  i public.sale_items%rowtype;
  before_lines jsonb;
  removed integer;
  stock_before integer;
  new_subtotal numeric;
  new_tax numeric;
  new_total numeric;
  new_cost numeric;
  refund numeric;
  paid numeric;
  snapshot jsonb;
begin
  if not public.is_owner() then raise exception 'Only the owner can adjust sales'; end if;
  select * into s from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if exists (select 1 from public.sale_adjustments where id = p_id and sale_id = p_sale_id) then
    return jsonb_build_object('ok',true);
  end if;
  if s.voided_at is not null then raise exception 'Cannot adjust a voided sale'; end if;
  if p_version is distinct from s.adjustment_version then raise exception 'Sale changed. Reopen it and try again.'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'A reason is required'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','mobile_money','card','transfer') then raise exception 'Invalid refund method'; end if;
  select * into i from public.sale_items where sale_id = p_sale_id and line_number = p_line_number;
  if not found then raise exception 'This sale has no editable line snapshot'; end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > i.quantity then raise exception 'Quantity must be between zero and the remaining sold quantity'; end if;
  if p_unit_price is null or p_unit_price::text in ('NaN','Infinity','-Infinity') or p_unit_price < 0 or p_unit_price > 99999999 then raise exception 'Invalid price'; end if;
  if p_quantity = i.quantity and round(p_unit_price,2) = i.unit_price then raise exception 'No changes to save'; end if;
  select jsonb_agg(to_jsonb(x) order by line_number) into before_lines from public.sale_items x where sale_id=p_sale_id;
  removed := i.quantity - p_quantity;
  if coalesce(p_restock,false) and removed > 0 then
    if i.is_labor then raise exception 'Services cannot be restocked'; end if;
    select stock into stock_before from public.products where id=i.product_id for update;
    if not found then raise exception 'Product no longer exists; choose no restocking'; end if;
    update public.products set stock=stock+removed, updated_at=now() where id=i.product_id;
    insert into public.inventory_transactions(product_id,transaction_type,quantity_change,quantity_before,quantity_after,sale_id,reason,performed_by)
    values(i.product_id,'adjustment',removed,stock_before,stock_before+removed,p_sale_id,trim(p_reason),auth.uid());
  end if;
  -- Removed damaged stock remains a cost; only resalable stock reverses cost of goods.
  new_cost := i.line_cost - case when coalesce(p_restock,false) or i.is_labor then round(i.unit_cost*removed,2) else 0 end;
  new_subtotal := round(p_quantity*round(p_unit_price,2),2);
  new_tax := round(new_subtotal*i.tax_rate,2);
  new_total := new_subtotal+new_tax;
  update public.sale_items set quantity=p_quantity, unit_price=round(p_unit_price,2),
    line_subtotal=new_subtotal,tax_amount=new_tax,line_total=new_total,line_cost=new_cost,
    gross_profit=new_total-new_cost where id=i.id;
  select coalesce(sum(line_subtotal),0),coalesce(sum(tax_amount),0),coalesce(sum(line_total),0),coalesce(sum(line_cost),0)
    into new_subtotal,new_tax,new_total,new_cost from public.sale_items where sale_id=p_sale_id;
  refund := greatest(0,s.amount_paid-new_total);
  paid := s.amount_paid-refund;
  select jsonb_agg(jsonb_build_object('productId',coalesce(product_id,s.items->(line_number-1)->>'productId'),
    'name',product_name,'sku',sku,'qty',quantity,'price',unit_price,'taxable',taxable,'taxRate',tax_rate,
    'taxAmount',tax_amount,'lineSubtotal',line_subtotal,'lineTotal',line_total) order by line_number)
    into snapshot from public.sale_items where sale_id=p_sale_id;
  update public.sales set items=snapshot,subtotal=new_subtotal,tax_total=new_tax,total=new_total,
    amount_paid=paid,balance_due=new_total-paid,
    payment_status=case when new_total=paid then 'paid' when paid>0 then 'partial' else 'unpaid' end,
    adjustment_version=adjustment_version+1 where id=p_sale_id;
  insert into public.sale_financials(sale_id,cost_total,gross_profit) values(p_sale_id,new_cost,new_total-new_cost)
    on conflict(sale_id) do update set cost_total=excluded.cost_total,gross_profit=excluded.gross_profit;
  insert into public.sale_adjustments values(p_id,p_sale_id,auth.uid(),now(),trim(p_reason),to_jsonb(s),
    (select to_jsonb(x) from public.sales x where id=p_sale_id),before_lines,
    (select jsonb_agg(to_jsonb(x) order by line_number) from public.sale_items x where sale_id=p_sale_id),
    case when coalesce(p_restock,false) then removed else 0 end,refund,p_payment_method);
  if refund>0 then
    insert into public.refunds values(p_id,p_sale_id,s.customer_id,refund,p_payment_method,trim(p_reason),auth.uid(),now());
  end if;
  return jsonb_build_object('ok',true,'refund',refund);
end;
$$;
alter table public.sale_items drop constraint sale_items_quantity_check;
alter table public.sale_items add constraint sale_items_quantity_check check(quantity >= 0);
revoke all on function public.adjust_sale_item(uuid,text,integer,integer,integer,numeric,boolean,text,text) from public,anon;
grant execute on function public.adjust_sale_item(uuid,text,integer,integer,integer,numeric,boolean,text,text) to authenticated;
-- A void after partial returns would reverse the wrong payment/stock history.
-- Require remaining items to be returned through the same audited workflow.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.void_sale(text)'::regprocedure) into definition;
  definition := replace(definition, 'if sale_row.voided_at is not null then',
    'if sale_row.adjustment_version > 0 then raise exception ''Use returns to close an adjusted sale''; end if;
  if sale_row.voided_at is not null then');
  execute definition;
end $$;
commit;
