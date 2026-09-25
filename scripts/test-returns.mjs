import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const root=fileURLToPath(new URL('../', import.meta.url))
const finance=readFileSync(root+'supabase/migrations/20260903000000_finance_credit.sql','utf8')
const db=new PGlite()
await db.exec(`create role authenticated; create role anon; create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('00000000-0000-0000-0000-000000000001');
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function public.is_owner() returns boolean language sql as $$select coalesce(current_setting('test.owner',true),'true')='true'$$;
create function public.is_authenticated_member() returns boolean language sql as $$select coalesce(current_setting('test.member',true),'true')='true'$$;
create table products(id text primary key,stock integer,updated_at timestamptz);
create table customers(id uuid primary key);
create table sales(created_at timestamptz not null default now(),id text primary key,items jsonb,total numeric,subtotal numeric,tax_total numeric,amount_paid numeric,balance_due numeric,payment_status text,customer_id uuid,voided_at timestamptz,worker_id uuid,voided_by uuid);
`)
await db.exec(finance.slice(finance.indexOf('create table if not exists public.sale_financials'),finance.indexOf('-- RLS:')))
await db.exec(finance.slice(finance.indexOf('create or replace function public.void_sale'),finance.indexOf('revoke all on function public.record_sale_v2')))
await db.exec(readFileSync(root+'supabase/migrations/20260912000000_sale_adjustments.sql','utf8'))
await db.exec(`alter table sales enable row level security; create policy "sales read" on sales for select to authenticated using(public.is_owner());`)
await db.exec(readFileSync(root+'supabase/migrations/20260912010000_worker_sale_adjustments.sql','utf8'))
async function seed(id,paid=36){await db.exec(`insert into products values('${id}',7,now()); insert into sales(id,items,total,subtotal,tax_total,amount_paid,balance_due,payment_status) values('${id}','[{"productId":"${id}"}]',36,30,6,${paid},${36-paid},'paid'); insert into sale_items(sale_id,product_id,line_number,product_name,quantity,unit_price,unit_cost,tax_rate,line_subtotal,tax_amount,line_total,line_cost,gross_profit) values('${id}','${id}',1,'Part',3,10,4,.2,30,6,36,12,24);`)}
let n=0
async function adjust(id,version,qty,price=10,restock=true,request=++n){return db.query(`select adjust_sale_item('00000000-0000-0000-0001-${String(request).padStart(12,'0')}','${id}',${version},1,${qty},${price},${restock},'Test return','cash')`)}
async function row(table,id){return (await db.query(`select * from ${table} where ${table==='sales'||table==='products'?'id':'sale_id'}='${id}'`)).rows[0]}
await seed('paid');await adjust('paid',0,2)
assert.equal(Number((await row('sales','paid')).total),24)
assert.equal((await row('products','paid')).stock,8)
assert.equal(Number((await row('refunds','paid')).amount),12)
await adjust('paid',0,2,10,true,1)
assert.equal((await row('products','paid')).stock,8)
await assert.rejects(adjust('paid',0,1),/Sale changed/)
await assert.rejects(db.query("select void_sale('paid')"),/Use returns/)
await adjust('paid',1,0)
assert.equal(Number((await row('sales','paid')).total),0)
assert.equal((await row('products','paid')).stock,10)
await seed('credit',10);await adjust('credit',0,2)
assert.equal(Number((await row('sales','credit')).balance_due),14)
assert.equal(await row('refunds','credit'),undefined)
await seed('partial',30);await adjust('partial',0,2)
assert.equal(Number((await row('refunds','partial')).amount),6)
await seed('damaged');await adjust('damaged',0,0,10,false)
assert.equal((await row('products','damaged')).stock,7)
assert.equal(Number((await row('sale_financials','damaged')).gross_profit),-12)
await seed('price');await adjust('price',0,3,5,false)
assert.equal(Number((await row('refunds','price')).amount),18)
await db.exec("set test.owner='false'")
await adjust('price',1,0)
assert.equal(Number((await row('sales','price')).total),0)
await seed('worker'); await adjust('worker',0,2)
assert.equal((await row('products','worker')).stock,8)
await db.exec('set role authenticated')
assert.equal((await db.query('select * from sale_adjustments')).rows.length,0)
const history=(await db.query('select * from sale_adjustment_history')).rows
assert.ok(history.length > 0)
assert.deepEqual(Object.keys(history[0].before_sale),['total'])
assert.equal('before_lines' in history[0],false)
await db.exec("reset role; set test.member='false'")
await assert.rejects(adjust('worker',1,0),/Sign in as a shop member/)
await db.exec('set role authenticated')
assert.equal((await db.query('select * from sale_adjustment_history')).rows.length,0)
await db.exec('reset role')
console.log('PASS: PostgreSQL migration, partial/full returns, idempotency, stale version, void guard, credit, partial payment, damaged cost, price correction, worker authorization, restricted audit snapshots, non-member rejection')
await db.exec("set test.member='true'; set test.owner='true'")
await db.exec(readFileSync(root+'supabase/migrations/20260912020000_sales_period_reset.sql','utf8'))
await seed('reset-me',10)
await db.exec("update sales set created_at='2025-02-15T12:00:00Z' where id='reset-me'")
const resetId='00000000-0000-0000-0002-000000000001'
const resetSQL=`select reset_sales_period('${resetId}','2025-02-01','2025-03-01','Month closed',array['reset-me'])`
await db.exec("set test.owner='false'")
await assert.rejects(db.query(resetSQL),/Only the owner/)
await db.exec("set test.owner='true'")
await assert.rejects(db.query(resetSQL.replace("array['reset-me']","array['wrong']")),/Sales changed/)
await db.query(resetSQL)
assert.equal((await row('sales','reset-me')).reset_id,resetId)
assert.equal(Number((await row('sales','reset-me')).balance_due),26)
assert.equal((await row('products','reset-me')).stock,7)
assert.equal((await row('sales','paid')).reset_id,null)
await db.query(resetSQL)
assert.equal((await db.query('select * from sales_resets')).rows.length,1)
await db.exec("set test.owner='false'")
await assert.rejects(db.query(`select restore_sales_reset('${resetId}')`),/Only the owner/)
await db.exec("set test.owner='true'")
await db.query(`select restore_sales_reset('${resetId}')`)
assert.equal((await row('sales','reset-me')).reset_id,null)
assert.ok((await db.query('select restored_at from sales_resets')).rows[0].restored_at)
console.log('PASS: owner-only period reset/restore, stale preview rejection, idempotency, date selection, preserved stock and debt')
await db.exec(`
create table profiles(id uuid primary key,display_name text);
insert into profiles values(auth.uid(),'Test owner');
alter table sales add column receipt_number text;
update sales set receipt_number='TEST-' || id;

`)
await db.exec(readFileSync(root+'supabase/migrations/20260924000000_void_receipts.sql','utf8'))
for (const [id,paid] of [['void-paid',36],['void-credit',10],['void-unpaid',0]]) {
  await seed(id,paid)
  await db.query('update sales set receipt_number=$1 where id=$2',['TEST-'+id,id])
  if (paid > 0) await db.query("insert into payments(sale_id,amount,payment_method,recorded_by) values($1,$2,'cash',auth.uid())",[id,paid])
  const call = () => db.query('select void_sale($1,$2,$3,$4)',[id,'Customer cancelled','cash',paid])
  await db.exec("set test.owner='false'")
  await assert.rejects(call(),/Only the owner/)
  await db.exec("set test.owner='true'")
  await assert.rejects(db.query('select void_sale($1,$2,$3,$4)',[id,'','cash',paid]),/reason/)
  await assert.rejects(db.query('select void_sale($1,$2,$3,$4)',[id,'Cancelled','cash',paid+1]),/Payment changed/)
  await call()
  if (paid > 0) assert.ok((await row('payments',id)).reversed_at)
  const receipt=await row('void_receipts',id)
  assert.equal(Number(receipt.refund_amount),paid)
  assert.equal(Number(receipt.original_sale.amount_paid),paid)
  assert.equal(Number(receipt.original_sale.balance_due),36-paid)
  assert.equal(receipt.recorded_by_name,'Test owner')
  assert.equal(receipt.original_sale.voided_at,null)
  assert.equal(Number((await row('sales',id)).amount_paid),0)
  assert.equal((await row('products',id)).stock,10)
  await call()
  assert.equal((await row('products',id)).stock,10)
}
await assert.rejects(db.query("select void_sale('paid','Cancelled','cash',0)"),/Use returns/)
assert.equal(await row('void_receipts','paid'),undefined)
await db.exec('set role authenticated')
await assert.rejects(db.query("select void_sale_internal('void-paid')"),/permission denied/)
await assert.rejects(db.query("update void_receipts set reason='Changed'"),/permission denied/)
await assert.rejects(db.query('delete from void_receipts'),/permission denied/)
assert.equal((await db.query('select * from void_receipts')).rows.length,3)
await db.exec("reset role; set test.member='false'; set role authenticated")
assert.equal((await db.query('select * from void_receipts')).rows.length,0)
await db.exec('reset role')
console.log('PASS: void snapshots, paid/partial/unpaid refunds, owner authorization, stale payments, atomic rollback, retry safety, protected audit records')
await db.close()
