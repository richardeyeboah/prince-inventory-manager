import { loadSales } from './lib/load-sales'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { uid } from './lib/format'
import { calculateLine, calculateSaleTotals } from './lib/finance'
import { drainOfflineQueue, enqueueOfflineSale, isOnline, pendingOfflineCount } from './lib/offline'
import { friendlyShopError, isJwtClockSkewError } from './lib/shop-errors'
import { supabase } from './lib/supabase'
import type {
  AdjustmentInput,
  SaleAdjustment,
  SalesReset,
  CartLine,
  CheckoutDetails,
  CollectedPaymentMethod,
  Customer,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  Sale,
} from './types'


type ProductRow = {
  id: string
  name: string
  price: number | string
  taxable?: boolean
  tax_rate?: number | string
  is_labor?: boolean
  barcode?: string | null
  category?: string | null
  brand?: string | null
  unit?: string | null
  shelf_location?: string | null
  stock: number
  low_stock_at: number
  sku: string
  created_at: string
  updated_at: string
}

type SaleRow = {
  void_receipts?: Sale['voidReceipt']
  reset_id?: string | null
  adjustment_version?: number
  id: string
  receipt_number?: string
  items: Sale['items']
  subtotal?: number | string
  tax_total?: number | string
  total: number | string
  payment_method: PaymentMethod
  amount_paid?: number | string
  balance_due?: number | string
  payment_status?: PaymentStatus
  created_at: string
  worker_id: string | null
  worker_name: string
  customer_id?: string | null
  customer_name: string
  customer_phone?: string
  vehicle_info: string
  due_date?: string | null
  notes?: string
  voided_at: string | null
  voided_by: string | null
}

type ProductCostRow = { product_id: string; cost_price: number | string }
type SaleFinancialRow = { sale_id: string; cost_total: number | string; gross_profit: number | string }
type SaleItemFinancialRow = {
  sale_id: string
  product_id: string | null
  line_cost: number | string
  gross_profit: number | string
}
type CustomerRow = {
  id: string
  name: string
  phone: string
  email: string
  vehicle_info: string
  notes: string
  created_at: string
  updated_at: string
}
type PaymentRow = {
  id: string
  sale_id: string
  customer_id: string | null
  amount: number | string
  payment_method: CollectedPaymentMethod
  notes: string
  recorded_by: string
  created_at: string
  reversed_at: string | null
}

function productFromRow(row: ProductRow, costPrice = 0): Product {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    costPrice,
    taxable: row.taxable ?? false,
    taxRate: Number(row.tax_rate ?? 0.2),
    isLabor: row.is_labor ?? row.sku.startsWith('SVC-'),
    barcode: row.barcode ?? '',
    category: row.category ?? '',
    brand: row.brand ?? '',
    unit: row.unit ?? 'Each',
    shelfLocation: row.shelf_location ?? '',
    stock: row.stock,
    lowStockAt: row.low_stock_at,
    sku: row.sku,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function productToRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    taxable: product.taxable,
    tax_rate: product.taxRate,
    is_labor: product.isLabor,
    barcode: product.barcode || null,
    category: product.category || null,
    brand: product.brand || null,
    unit: product.unit || 'Each',
    shelf_location: product.shelfLocation || null,
    stock: product.stock,
    low_stock_at: product.lowStockAt,
    sku: product.sku,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  }
}

function saleFromRow(
  row: SaleRow,
  financial?: SaleFinancialRow,
  lineFinancials?: Map<string, SaleItemFinancialRow>,
): Sale {
  const total = Number(row.total)
  const subtotal = Number(row.subtotal ?? total)
  const amountPaid = Number(row.amount_paid ?? total)
  const voided = Boolean(row.voided_at)
  return {
    id: row.id,
    voidReceipt: row.void_receipts ?? null,
    resetId: row.reset_id ?? null,
    adjustmentVersion: row.adjustment_version ?? 0,
    receiptNumber: row.receipt_number ?? row.id,
    items: row.items.map((item) => {
      const lineFinancial = lineFinancials?.get(`${row.id}:${item.productId}`)
      return {
        ...item,
        sku: item.sku ?? '',
        taxable: item.taxable ?? false,
        taxRate: Number(item.taxRate ?? 0),
        taxAmount: Number(item.taxAmount ?? 0),
        lineSubtotal: Number(item.lineSubtotal ?? item.price * item.qty),
        lineTotal: Number(item.lineTotal ?? item.price * item.qty),
        lineCost: Number(lineFinancial?.line_cost ?? 0),
        grossProfit: Number(lineFinancial?.gross_profit ?? 0),
      }
    }),
    subtotal,
    taxTotal: Number(row.tax_total ?? 0),
    total,
    paymentMethod: row.payment_method,
    amountPaid,
    balanceDue: Number(row.balance_due ?? Math.max(0, total - amountPaid)),
    paymentStatus: voided ? 'voided' : (row.payment_status ?? 'paid'),
    createdAt: row.created_at,
    workerId: row.worker_id,
    workerName: row.worker_name ?? '',
    customerId: row.customer_id ?? null,
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    vehicleInfo: row.vehicle_info ?? '',
    dueDate: row.due_date ?? null,
    notes: row.notes ?? '',
    costTotal: Number(financial?.cost_total ?? 0),
    grossProfit: Number(financial?.gross_profit ?? 0),
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
  }
}

function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    vehicleInfo: row.vehicle_info,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    saleId: row.sale_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    notes: row.notes,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    reversedAt: row.reversed_at,
  }
}

function buildSale(
  products: Product[],
  items: CartLine[],
  paymentMethod: PaymentMethod,
  workerId: string,
  workerName: string,
  details: CheckoutDetails,
): Sale | null {
  const now = new Date().toISOString()
  const lines = items
    .map((line) => {
      const product = products.find((p) => p.id === line.productId)
      if (!product || line.qty <= 0) return null
      const qty = product.isLabor ? line.qty : Math.min(line.qty, product.stock)
      if (qty <= 0) return null
      const price = Math.max(0, line.unitPrice)
      const taxRate = line.applyTax ? product.taxRate : 0
      const financial = calculateLine({
        unitPrice: price,
        unitCost: product.costPrice,
        quantity: qty,
        applyTax: line.applyTax,
        taxRate,
      })
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price,
        qty,
        taxable: line.applyTax,
        taxRate,
        taxAmount: financial.tax,
        lineSubtotal: financial.subtotal,
        lineTotal: financial.total,
        lineCost: financial.cost,
        grossProfit: financial.grossProfit,
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  if (lines.length === 0) return null

  const totals = calculateSaleTotals(
    lines.map((line) => ({
      subtotal: line.lineSubtotal,
      tax: line.taxAmount,
      total: line.lineTotal,
      cost: line.lineCost,
      grossProfit: line.grossProfit,
    })),
  )
  const { subtotal, tax: taxTotal, total } = totals
  const amountPaid = paymentMethod === 'credit' ? Math.min(details.amountPaid, total) : total

  return {
    id: uid('sale'),
    receiptNumber: '',
    items: lines,
    subtotal,
    taxTotal,
    total,
    paymentMethod,
    amountPaid,
    balanceDue: total - amountPaid,
    paymentStatus: total - amountPaid === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
    createdAt: now,
    workerId,
    workerName,
    customerId: details.customerId,
    customerName: details.customerName.trim(),
    customerPhone: details.customerPhone.trim(),
    vehicleInfo: details.vehicleInfo.trim(),
    dueDate: details.dueDate,
    notes: details.notes.trim(),
    costTotal: totals.cost,
    grossProfit: totals.grossProfit,
    voidedAt: null,
    voidedBy: null,
  }
}

type ShopContextValue = {
  allSales: Sale[]
  allPayments: Payment[]
  resets: SalesReset[]
  resetSales: (id: string, start: string | null, end: string | null, reason: string, expectedIds: string[]) => Promise<boolean>
  restoreReset: (id: string) => Promise<boolean>
  adjustments: SaleAdjustment[]
  adjustSale: (input: AdjustmentInput) => Promise<boolean>
  products: Product[]
  sales: Sale[]
  customers: Customer[]
  payments: Payment[]
  loading: boolean
  error: string | null
  offlinePending: number
  isOwner: boolean
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => void
  adjustStock: (id: string, delta: number, reason?: string) => void
  setStock: (id: string, stock: number, expectedStock: number) => Promise<boolean>
  deleteProduct: (id: string) => void
  checkout: (items: CartLine[], paymentMethod: PaymentMethod, details: CheckoutDetails) => Promise<Sale | null>
  recordPayment: (saleId: string, amount: number, method: CollectedPaymentMethod, notes?: string) => Promise<boolean>
  voidSale: (saleId: string, reason: string, method: CollectedPaymentMethod, expectedPaid: number) => Promise<boolean>
  clearError: () => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const { session, profile, isOwner } = useAuth()
  const [resets, setResets] = useState<SalesReset[]>([])
  const [adjustments, setAdjustments] = useState<SaleAdjustment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offlinePending, setOfflinePending] = useState(0)

  const refresh = useCallback(async () => {
    if (!supabase || !session) return

    const [
      resetRes,
      refundRes,
      adjustmentRes,
      productRes,
      saleRes,
      customerRes,
      paymentRes,
      costRes,
      financialRes,
      lineFinancialRes,
    ] = await Promise.all([
      isOwner ? supabase.from('sales_resets').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from('refunds').select('*'),
      supabase.from('sale_adjustment_history').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
      loadSales(),
      supabase.from('customers').select('*').order('name'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      isOwner ? supabase.from('product_costs').select('*') : Promise.resolve({ data: [], error: null }),
      isOwner ? supabase.from('sale_financials').select('*') : Promise.resolve({ data: [], error: null }),
      isOwner
        ? supabase.from('sale_items').select('sale_id,product_id,line_cost,gross_profit')
        : Promise.resolve({ data: [], error: null }),
    ])

    if (productRes.error) {
      setError(friendlyShopError(productRes.error))
      setLoading(false)
      return
    }
    if (saleRes.error) {
      setError(friendlyShopError(saleRes.error))
      setLoading(false)
      return
    }
    if (
      resetRes.error || refundRes.error || adjustmentRes.error ||
      customerRes.error ||
      paymentRes.error ||
      costRes.error ||
      financialRes.error ||
      lineFinancialRes.error
    ) {
      setError(
        friendlyShopError(
          resetRes.error ?? refundRes.error ?? adjustmentRes.error ??
          customerRes.error ??
            paymentRes.error ??
            costRes.error ??
            financialRes.error ??
            lineFinancialRes.error ??
            'Unable to load financial data.',
        ),
      )
      setLoading(false)
      return
    }

    const costs = new Map(
      ((costRes.data ?? []) as ProductCostRow[]).map((row) => [row.product_id, Number(row.cost_price)]),
    )
    const nextProducts = (productRes.data as ProductRow[]).map((row) =>
      productFromRow(row, costs.get(row.id) ?? 0),
    )

    const financials = new Map(
      ((financialRes.data ?? []) as SaleFinancialRow[]).map((row) => [row.sale_id, row]),
    )
    const lineFinancials = new Map(
      ((lineFinancialRes.data ?? []) as SaleItemFinancialRow[]).map((row) => [
        `${row.sale_id}:${row.product_id}`,
        row,
      ]),
    )
    setProducts(nextProducts)
    setSales(
      (saleRes.data as SaleRow[]).map((row) =>
        saleFromRow(row, financials.get(row.id), lineFinancials),
      ),
    )
    setCustomers((customerRes.data as CustomerRow[]).map(customerFromRow))
    setResets((resetRes.data ?? []) as SalesReset[])
    setAdjustments((adjustmentRes.data ?? []) as SaleAdjustment[])
    setPayments([
      ...(paymentRes.data as PaymentRow[]).map(paymentFromRow),
      ...((refundRes.data ?? []) as PaymentRow[]).map((row) => paymentFromRow({ ...row, amount: -Number(row.amount), reversed_at: null })),
    ])
    setError(null)
    setLoading(false)
  }, [session, isOwner])

  const submitSale = useCallback(
    async (sale: Sale, originalItems: CartLine[], details: CheckoutDetails) => {
      if (!supabase || !session?.user) return false

      const payload = {
        p_id: sale.id,
        p_items: sale.items.map((item) => {
          const cartLine = originalItems.find((candidate) => candidate.productId === item.productId)
          return {
            productId: item.productId,
            qty: item.qty,
            applyTax: item.taxable,
            unitPrice: isOwner ? item.price : null,
            overrideReason: cartLine?.overrideReason ?? '',
          }
        }),
        p_payment_method: sale.paymentMethod,
        p_amount_paid: sale.amountPaid,
        p_initial_payment_method: details.initialPaymentMethod,
        p_customer_id: sale.customerId,
        p_worker_name: sale.workerName,
        p_customer_name: sale.customerName,
        p_customer_phone: sale.customerPhone,
        p_vehicle_info: sale.vehicleInfo,
        p_due_date: sale.dueDate,
        p_notes: sale.notes,
        p_device_created_at: sale.createdAt,
      }

      if (!isOnline()) {
        enqueueOfflineSale(payload)
        setOfflinePending((n) => n + 1)
        return true
      }

      const { data, error: err } = await supabase.rpc('record_sale_v2', payload)
      if (err) {
        setError(err.message)
        return false
      }
      const result = data as { receiptNumber?: string } | null
      if (result?.receiptNumber) sale.receiptNumber = result.receiptNumber
      return true
    },
    [session, isOwner],
  )

  const syncOffline = useCallback(async () => {
    const client = supabase
    if (!client || !session || !isOnline()) return
    const { synced, remaining } = await drainOfflineQueue(async (payload) => {
      const { error: err } = await client.rpc('record_sale_v2', payload)
      return !err
    })
    setOfflinePending(remaining)
    if (synced > 0) await refresh()
  }, [session, refresh])

  useEffect(() => {
    if (!session) {
      setProducts([])
      setSales([])
      setCustomers([])
      setPayments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setOfflinePending(pendingOfflineCount())
    void refresh()
    void syncOffline()

    const client = supabase!
    const channel = client
      .channel('shop-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void refresh()
      })
      .subscribe()

    const onOnline = () => void syncOffline()
    window.addEventListener('online', onOnline)

    return () => {
      void client.removeChannel(channel)
      window.removeEventListener('online', onOnline)
    }
  }, [session, refresh, syncOffline])

  const value = useMemo<ShopContextValue>(
    () => ({
      allSales: sales,
      allPayments: payments,
      resets,
      resetSales: async (id, start, end, reason, expectedIds) => {
        if (!isOwner || !supabase || !isOnline()) { setError('Only the owner can reset sales while online.'); return false }
        const { error: err } = await supabase.rpc('reset_sales_period', { p_id: id, p_start: start, p_end: end, p_reason: reason, p_expected_ids: expectedIds })
        if (err) { setError(err.message); return false }
        await refresh(); return true
      },
      restoreReset: async (id) => {
        if (!isOwner || !supabase || !isOnline()) { setError('Only the owner can restore sales while online.'); return false }
        const { error: err } = await supabase.rpc('restore_sales_reset', { p_id: id })
        if (err) { setError(err.message); return false }
        await refresh(); return true
      },
      adjustments,
      adjustSale: async (input) => {
        if (!session?.user || !profile || !supabase || !isOnline()) { setError('Sign in and connect to the internet to adjust a sale.'); return false }
        const { error: err } = await supabase.rpc('adjust_sale_item', {
          p_id: input.id, p_sale_id: input.saleId, p_version: input.version,
          p_line_number: input.lineNumber, p_quantity: input.quantity,
          p_unit_price: input.unitPrice, p_restock: input.restock,
          p_reason: input.reason, p_payment_method: input.method,
        })
        if (err) { setError(err.message); return false }
        await refresh()
        return true
      },
      products,
      sales: sales.filter((sale) => !sale.resetId),
      customers,
      payments: payments.filter((payment) => !sales.some((sale) => sale.id === payment.saleId && sale.resetId)),
      loading,
      error,
      offlinePending,
      isOwner,
      clearError: () => setError(null),
      setStock: async (id, stock, expectedStock) => {
        if (!isOwner) { setError('Only the owner can perform this action.'); return false }
        if (!supabase) return false
        const { error: err } = await supabase.rpc('set_product_stock', {
          p_id: id, p_stock: stock, p_expected_stock: expectedStock,
        })
        if (err) { setError(err.message); return false }
        await refresh()
        return true
      },
      addProduct: async (input) => {
        if (!isOwner) {
          setError('Only the owner can add parts.')
          return 'Only the owner can add parts.'
        }
        if (!supabase) return 'The database is not connected.'
        const now = new Date().toISOString()
        const product: Product = { ...input, id: uid('p'), createdAt: now, updatedAt: now }
        setProducts((prev) => [product, ...prev])
        let { error: insertError } = await supabase.from('products').insert(productToRow(product))

        // A newly refreshed Supabase token can briefly arrive ahead of another
        // service's clock. Refresh once and retry so the user does not lose the form.
        if (insertError && isJwtClockSkewError(insertError)) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500))
          await supabase.auth.refreshSession()
          ;({ error: insertError } = await supabase.from('products').insert(productToRow(product)))
        }

        if (insertError) {
          const message = friendlyShopError(insertError)
          setError(message)
          await refresh()
          return message
        }

        const { error: costError } = await supabase
          .from('product_costs')
          .upsert({ product_id: product.id, cost_price: product.costPrice })
        if (costError) {
          const message = friendlyShopError(costError)
          setError(message)
          await refresh()
          return message
        }
        setError(null)
        return null
      },
      updateProduct: (id, patch) => {
        if (!isOwner) {
          setError('Only the owner can edit parts.')
          return
        }
        const now = new Date().toISOString()
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)))
        const row: Record<string, unknown> = { updated_at: now }
        if (patch.name !== undefined) row.name = patch.name
        if (patch.price !== undefined) row.price = patch.price
        if (patch.lowStockAt !== undefined) row.low_stock_at = patch.lowStockAt
        if (patch.sku !== undefined) row.sku = patch.sku
        if (patch.taxable !== undefined) row.taxable = patch.taxable
        if (patch.taxRate !== undefined) row.tax_rate = patch.taxRate
        if (patch.isLabor !== undefined) row.is_labor = patch.isLabor
        if (patch.barcode !== undefined) row.barcode = patch.barcode || null
        if (patch.category !== undefined) row.category = patch.category || null
        if (patch.brand !== undefined) row.brand = patch.brand || null
        if (patch.unit !== undefined) row.unit = patch.unit || 'Each'
        if (patch.shelfLocation !== undefined) row.shelf_location = patch.shelfLocation || null
        void supabase?.from('products').update(row).eq('id', id).then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void refresh()
          }
        })
        if (patch.costPrice !== undefined) {
          void supabase?.from('product_costs')
            .upsert({ product_id: id, cost_price: patch.costPrice })
            .then(({ error: err }) => {
              if (err) {
                setError(err.message)
                void refresh()
              }
            })
        }
      },
      adjustStock: (id, delta, reason = 'Manual adjustment') => {
        if (!isOwner) { setError('Only the owner can adjust stock.'); return }
        void supabase?.rpc('adjust_product_stock', {
          p_id: id,
          p_delta: delta,
          p_reason: reason,
        }).then(({ error: err }) => {
          if (err) {
            setError(err.message)
          } else {
            void refresh()
          }
        })
      },
      deleteProduct: (id) => {
        if (!isOwner) {
          setError('Only the owner can remove parts.')
          return
        }
        setProducts((prev) => prev.filter((p) => p.id !== id))
        void supabase?.from('products').delete().eq('id', id).then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void refresh()
          }
        })
      },
      checkout: async (items, paymentMethod, details) => {
        if (!session?.user || !profile || profile.id !== session.user.id) return null
        if (paymentMethod !== 'cash' && paymentMethod !== 'mobile_money' && paymentMethod !== 'credit') {
          setError('Choose Cash, Mobile Money or Pay later.'); return null
        }
        if (!isOwner) items = items.map((line) => {
          const product = products.find((p) => p.id === line.productId)
          return { ...line, unitPrice: product?.price ?? 0, applyTax: product?.taxable ?? false, overrideReason: '' }
        })
        if (paymentMethod === 'credit') {
          if (!isOnline()) { setError('Connect to the internet before saving a pay-later sale.'); return null }
          if (!details.customerName.trim() || !details.customerPhone.trim()) { setError('Pay later requires a customer name and phone number.'); return null }
          if (!Number.isFinite(details.amountPaid) || details.amountPaid < 0) { setError('Enter a valid amount paid.'); return null }
          if (details.initialPaymentMethod !== 'cash' && details.initialPaymentMethod !== 'mobile_money') { setError('Choose Cash or Mobile Money for the amount paid now.'); return null }
        }
        const sale = buildSale(products, items, paymentMethod, session.user.id, profile.displayName, details)
        if (!sale) return null
        if (paymentMethod === 'credit' && details.amountPaid > sale.total) { setError('Amount paid cannot exceed the total.'); return null }

        const ok = await submitSale(sale, items, details)
        if (!ok) {
          return null
        }

        if (isOnline()) await refresh()
        return sale
      },
      recordPayment: async (saleId, amount, method, notes = '') => {
        if (!supabase) return false
        const { error: err } = await supabase.rpc('record_customer_payment', {
          p_sale_id: saleId,
          p_amount: amount,
          p_payment_method: method,
          p_notes: notes,
        })
        if (err) {
          setError(err.message)
          return false
        }
        await refresh()
        return true
      },
      voidSale: async (saleId, reason, method, expectedPaid) => {
        if (!isOwner) { setError('Only the owner can perform this action.'); return false }
        if (!supabase) return false
        const { error: err } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: reason, p_payment_method: method, p_expected_paid: expectedPaid })
        if (err) {
          setError(err.message)
          return false
        }
        await refresh()
        return true
      },
    }),
    [
      resets,
      adjustments,
      products,
      sales,
      customers,
      payments,
      loading,
      error,
      offlinePending,
      isOwner,
      session,
      profile,
      refresh,
      submitSale,
    ],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside ShopProvider')
  return ctx
}
