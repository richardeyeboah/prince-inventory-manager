begin;
create table public.sales_resets (
 id uuid primary key,
 created_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id),
 start_at timestamptz,
 end_at timestamptz,
 reason text not null check(length(trim(reason))>0),
 sale_count integer not null,
 sales_total numeric not null,
 restored_at timestamptz,
 restored_by uuid references auth.users(id)
);
alter table public.sales_resets enable row level security;
create policy "owner reset history" on public.sales_resets for select to authenticated using(public.is_owner());
grant select on public.sales_resets to authenticated;
revoke insert,update,delete on public.sales_resets from authenticated,anon;
alter table public.sales add column reset_id uuid references public.sales_resets(id);
create index sales_reset_id_idx on public.sales(reset_id);
create function public.reset_sales_period(p_id uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_expected_ids text[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare ids text[]; total_value numeric;
begin
 if not public.is_owner() then raise exception 'Only the owner can reset sales'; end if;
 if exists(select 1 from public.sales_resets where id=p_id) then return jsonb_build_object('ok',true); end if;
 if p_reason is null or length(trim(p_reason))=0 then raise exception 'Enter a reset reason'; end if;
 if (p_start is null) <> (p_end is null) or p_start >= p_end then raise exception 'Invalid date range'; end if;
 -- Serialize resets against checkout, returns, payments and other resets.
 lock table public.sales in share row exclusive mode;
 select coalesce(array_agg(id order by id),'{}'::text[]),coalesce(sum(case when voided_at is null then total else 0 end),0)
 into ids,total_value from public.sales where reset_id is null and (p_start is null or created_at>=p_start) and (p_end is null or created_at<p_end);
 if cardinality(ids)=0 then raise exception 'No sales in this period'; end if;
 if p_expected_ids is null or ids is distinct from (select array_agg(x order by x) from unnest(p_expected_ids) x) then
  raise exception 'Sales changed. Review the period again before resetting.';
 end if;
 insert into public.sales_resets(id,recorded_by,start_at,end_at,reason,sale_count,sales_total)
 values(p_id,auth.uid(),p_start,p_end,trim(p_reason),cardinality(ids),total_value);
 update public.sales set reset_id=p_id where id=any(ids);
 return jsonb_build_object('ok',true,'count',cardinality(ids));
end $$;
create function public.restore_sales_reset(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'Only the owner can restore sales'; end if;
 lock table public.sales in share row exclusive mode;
 perform 1 from public.sales_resets where id=p_id for update;
 if not found then raise exception 'Reset not found'; end if;
 update public.sales set reset_id=null where reset_id=p_id;
 update public.sales_resets set restored_at=now(),restored_by=auth.uid() where id=p_id and restored_at is null;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.reset_sales_period(uuid,timestamptz,timestamptz,text,text[]) from public,anon;
revoke all on function public.restore_sales_reset(uuid) from public,anon;
grant execute on function public.reset_sales_period(uuid,timestamptz,timestamptz,text,text[]),public.restore_sales_reset(uuid) to authenticated;
commit;
