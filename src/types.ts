export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'transfer' | 'credit'
export type CollectedPaymentMethod = Exclude<PaymentMethod, 'credit'>
export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'voided'

export type UserRole = 'owner' | 'worker'

export type Profile = {
  id: string
  displayName: string
  role: UserRole
  createdAt: string
}

export type Product = {
  id: string
  name: string
  price: number
  costPrice: number
  taxable: boolean
  taxRate: number
  isLabor: boolean
  barcode: string
  category: string
  brand: string
  unit: string
  shelfLocation: string
  stock: number
  lowStockAt: number
  sku: string
  createdAt: string
  updatedAt: string
}

export type SaleLine = {
  productId: string
  name: string
  sku: string
  price: number
  qty: number
  taxable: boolean
  taxRate: number
  taxAmount: number
  lineSubtotal: number
  lineTotal: number
  lineCost: number
  grossProfit: number
}

export type VoidReceipt = {
  receipt_number: string
  created_at: string
  recorded_by: string
  recorded_by_name: string
  reason: string
  refund_amount: number
  payment_method: CollectedPaymentMethod
  original_sale: {
    items: SaleLine[]; total: number; amount_paid: number; balance_due: number
  }
}

export type Sale = {
  voidReceipt?: VoidReceipt | null
  resetId?: string | null
  adjustmentVersion?: number
  id: string
  receiptNumber: string
  items: SaleLine[]
  subtotal: number
  taxTotal: number
  total: number
  paymentMethod: PaymentMethod
  amountPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
  createdAt: string
  workerId: string | null
  workerName: string
  customerId: string | null
  customerName: string
  customerPhone: string
  vehicleInfo: string
  dueDate: string | null
  notes: string
  costTotal: number
  grossProfit: number
  voidedAt: string | null
  voidedBy: string | null
}

export type CheckoutDetails = {
  customerId: string | null
  customerName: string
  customerPhone: string
  vehicleInfo: string
  dueDate: string | null
  notes: string
  amountPaid: number
  initialPaymentMethod: CollectedPaymentMethod
}

export type CartLine = {
  productId: string
  qty: number
  applyTax: boolean
  unitPrice: number
  overrideReason: string
}

export type Customer = {
  id: string
  name: string
  phone: string
  email: string
  vehicleInfo: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type Payment = {
  id: string
  saleId: string
  customerId: string | null
  amount: number
  paymentMethod: CollectedPaymentMethod
  notes: string
  recordedBy: string
  createdAt: string
  reversedAt: string | null
}

export type SaleAdjustment = {
  id: string
  sale_id: string
  created_at: string
  recorded_by: string
  reason: string
  restocked: number
  refund_amount: number
  payment_method: CollectedPaymentMethod
  before_sale: { total: number }
  after_sale: { total: number }
}
export type AdjustmentInput = {
  id: string
  saleId: string
  version: number
  lineNumber: number
  quantity: number
  unitPrice: number
  restock: boolean
  reason: string
  method: CollectedPaymentMethod
}

export type SalesReset = { id: string; created_at: string; reason: string; sale_count: number; sales_total: number; restored_at: string | null }
