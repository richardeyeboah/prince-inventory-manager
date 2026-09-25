import { supabase } from './supabase'

export async function loadSales() {
  const client = supabase!
  let includeVoids = true
  const rows: Record<string, unknown>[] = []
  // Avoid silently losing older receipts at the server's default row limit.
  for (let offset = 0; ; offset += 500) {
    let result = await client.from('sales').select(includeVoids ? '*, void_receipts(*)' : '*')
      .order('created_at', { ascending: false }).order('id').range(offset, offset + 499).returns<Record<string, unknown>[]>()
    if (includeVoids && result.error?.code === 'PGRST200' && result.error.message.includes('void_receipts')) {
      includeVoids = false
      result = await client.from('sales').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 499).returns<Record<string, unknown>[]>()
    }
    if (result.error) return { data: null, error: result.error }
    rows.push(...(result.data ?? []))
    if ((result.data?.length ?? 0) < 500) return { data: rows, error: null }
  }
}
