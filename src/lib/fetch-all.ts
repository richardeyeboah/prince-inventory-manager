import type { PostgrestError } from '@supabase/supabase-js'

type PageResult<Row> = { data: Row[] | null; error: PostgrestError | null }
type PageQuery<Row> = { range: (from: number, to: number) => PromiseLike<PageResult<Row>> }

export const PAGE_SIZE = 500

// Supabase caps a plain select at 1000 rows and returns no error when it truncates.
// Every table that grows with trading (sales, items, payments, financials) must be read in pages,
// otherwise older receipts silently drop out of totals once the shop is busy enough.
// The query builder must apply a stable ORDER BY so pages don't overlap.
export async function fetchAll<Row>(build: () => PageQuery<Row>): Promise<PageResult<Row>> {
  const rows: Row[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await build().range(offset, offset + PAGE_SIZE - 1)
    if (result.error) return { data: null, error: result.error }
    const page = result.data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { data: rows, error: null }
  }
}

export const empty = <Row,>(): Promise<PageResult<Row>> => Promise.resolve({ data: [] as Row[], error: null })
