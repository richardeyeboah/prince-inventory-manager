import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ pages: [] as { data: Record<string, unknown>[] | null; error: { code: string; message: string } | null }[], selects: [] as string[], ranges: [] as number[] }))
vi.mock('./supabase', () => ({ supabase: { from: () => ({ select: (query: string) => {
  mock.selects.push(query)
  const chain = { order: () => chain, range: (start: number) => { mock.ranges.push(start); return chain }, returns: () => Promise.resolve(mock.pages.shift()) }
  return chain
} }) } }))
import { loadSales } from './load-sales'
beforeEach(() => { mock.pages = []; mock.selects = []; mock.ranges = [] })
it('loads older receipts beyond one page', async () => {
  mock.pages = [{data: Array.from({length:500}, (_,id) => ({id})), error:null}, {data:[{id:'older'}],error:null}]
  expect((await loadSales()).data).toHaveLength(501)
  expect(mock.ranges).toEqual([0,500])
})
it('keeps history available before the void migration is installed', async () => {
  mock.pages = [{data:null,error:{code:'PGRST200',message:'Missing relationship void_receipts'}},{data:[{id:'existing'}],error:null}]
  expect((await loadSales()).data).toEqual([{id:'existing'}])
  expect(mock.selects).toEqual(['*, void_receipts(*)','*'])
})
it('does not conceal permission or network errors', async () => {
  mock.pages = [{data:null,error:{code:'42501',message:'Permission denied'}}]
  expect((await loadSales()).error?.code).toBe('42501')
  expect(mock.selects).toHaveLength(1)
})
