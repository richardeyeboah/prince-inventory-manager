begin;
-- Keep the existing stock/payment reversal implementation private.
alter function public.void_sale(text) rename to void_sale_internal;
revoke all on function public.void_sale_internal(text) from public, anon, authenticated;

create table public.void_receipts (
  sale_id text primary key references public.sales(id),
  receipt_number text not null unique,
  created_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  recorded_by_name text not null,
  reason text not null check (length(trim(reason)) > 0),
  refund_amount numeric not null check (refund_amount >= 0),
  payment_method text not null check (payment_method in ('cash','mobile_money','card','transfer')),
  original_sale jsonb not null
);
alter table public.void_receipts enable row level security;
create policy "Members read void receipts" on public.void_receipts for select to authenticated
  using (public.is_authenticated_member());
grant select on public.void_receipts to authenticated;
revoke insert, update, delete on public.void_receipts from public, anon, authenticated;

create function public.void_sale(p_sale_id text, p_reason text, p_payment_method text, p_expected_paid numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.sales%rowtype; actor_name text;
begin
  if not public.is_owner() then raise exception 'Only the owner can void sales'; end if;
  select * into s from public.sales where id=p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  -- A retry cannot restore stock or reverse money twice.
  if exists(select 1 from public.void_receipts where sale_id=p_sale_id) then
    return jsonb_build_object('ok',true);
  end if;
  if s.voided_at is not null then raise exception 'Sale already voided; historical refund details are unavailable'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Enter a void reason'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','mobile_money','card','transfer') then raise exception 'Choose a refund method'; end if;
  if p_expected_paid is distinct from s.amount_paid then raise exception 'Payment changed. Review the refund amount again.'; end if;
  select display_name into actor_name from public.profiles where id=auth.uid();
  insert into public.void_receipts(sale_id,receipt_number,recorded_by,recorded_by_name,reason,refund_amount,payment_method,original_sale)
  values(s.id,'VOID-' || s.receipt_number,auth.uid(),coalesce(actor_name,'Shop owner'),trim(p_reason),s.amount_paid,p_payment_method,to_jsonb(s));
  -- Atomic with snapshot insertion: any reversal failure rolls back both.
  perform public.void_sale_internal(p_sale_id);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.void_sale(text,text,text,numeric) from public, anon;
grant execute on function public.void_sale(text,text,text,numeric) to authenticated;
commit;
