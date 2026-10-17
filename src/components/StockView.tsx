import { useMemo, useState, type FormEvent } from 'react'
import { Minus, PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { money, percent } from '../lib/format'
import { finalCustomerPrice, summarizeInventory } from '../lib/store-summary'
import { useShop } from '../store'
import type { Product } from '../types'
import { ModalPortal } from './ModalPortal'

type Draft = {
  name: string
  costPrice: string
  price: string
  taxable: boolean
  taxRate: string
  isLabor: boolean
  barcode: string
  stock: string
  lowStockAt: string
  sku: string
}

const emptyDraft: Draft = {
  name: '',
  costPrice: '',
  price: '',
  taxable: false,
  taxRate: '20',
  isLabor: false,
  barcode: '',
  stock: '',
  lowStockAt: '5',
  sku: '',
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    costPrice: String(product.costPrice),
    price: String(product.price),
    taxable: product.taxable,
    taxRate: String(product.taxRate * 100),
    isLabor: product.isLabor,
    barcode: product.barcode,
    stock: String(product.stock),
    lowStockAt: String(product.lowStockAt),
    sku: product.sku,
  }
}

export function StockView() {
  const { products, addProduct, updateProduct, adjustStock, setStock, deleteProduct, isOwner } = useShop()
  const [originalStock, setOriginalStock] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [open, setOpen] = useState(false)
  const summary = useMemo(() => summarizeInventory(products), [products])
  const missingCost = useMemo(() => products.filter((p) => !p.isLabor && p.costPrice <= 0).length, [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (p: Product) => {
      if (stockFilter === 'low') return !p.isLabor && p.stock > 0 && p.stock <= p.lowStockAt
      if (stockFilter === 'out') return !p.isLabor && p.stock === 0
      if (stockFilter === 'nocost') return !p.isLabor && p.costPrice <= 0
      return true
    }
    const list = products.filter(matches).sort((a, b) => {
      const aLow = a.stock <= a.lowStockAt ? 0 : 1
      const bLow = b.stock <= b.lowStockAt ? 0 : 1
      if (aLow !== bLow) return aLow - bLow
      return a.name.localeCompare(b.name)
    })
    if (!q) return list
    return list.filter(
      (p) => [p.name, p.sku]
        .some((value) => value.toLowerCase().includes(q)),
    )
  }, [products, query, stockFilter])

  function openCreate() {
    if (!isOwner) return
    setEditingId(null)
    setDraft(emptyDraft)
    setFormError('')
    setOpen(true)
  }

  function openEdit(product: Product) {
    if (!isOwner) return
    setEditingId(product.id)
    setDraft(toDraft(product))
    setFormError('')
    setOriginalStock(product.stock)
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditingId(null)
    setDraft(emptyDraft)
    setFormError('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const name = draft.name.trim()
    const costPrice = Number(draft.costPrice)
    const price = Number(draft.price)
    const taxRate = Number(draft.taxRate) / 100
    const stock = Math.max(0, Math.floor(Number(draft.stock) || 0))
    const lowStockAt = Math.max(0, Math.floor(Number(draft.lowStockAt) || 0))
    const sku = draft.sku.trim().toUpperCase()
    const barcode = draft.barcode.trim()

    if (
      !name ||
      (!Number.isFinite(costPrice)) ||
      costPrice < 0 ||
      (!Number.isFinite(price)) ||
      price < 0 ||
      (!Number.isFinite(taxRate)) ||
      taxRate < 0 ||
      taxRate > 1
    ) return

    if (!Number.isSafeInteger(Number(draft.stock)) || Number(draft.stock) < 0) return
    const duplicateSku = sku && products.some((product) => product.id !== editingId && product.sku.trim().toUpperCase() === sku)
    if (duplicateSku) {
      setFormError('That Part # is already used. Enter a different Part # or leave it blank.')
      return
    }
    const duplicateBarcode = barcode && products.some((product) => product.id !== editingId && product.barcode.trim() === barcode)
    if (duplicateBarcode) {
      setFormError('That barcode is already used by another product.')
      return
    }
    setFormError('')
    if (editingId && stock !== originalStock) {
      setSaving(true)
      try {
        if (!await setStock(editingId, stock, originalStock)) return
      } finally { setSaving(false) }
    }
    if (editingId) {
      updateProduct(editingId, {
        name,
        costPrice,
        price,
        taxable: draft.taxable,
        taxRate,
        isLabor: draft.isLabor,
        barcode,
        lowStockAt,
        sku,
      })
    } else {
      setSaving(true)
      try {
        const error = await addProduct({
          name,
          costPrice,
          price,
          taxable: draft.taxable,
          taxRate,
          isLabor: draft.isLabor,
          barcode,
          category: '',
          brand: '',
          unit: 'Each',
          shelfLocation: '',
          stock: draft.isLabor ? 0 : stock,
          lowStockAt,
          sku,
        })
        if (error) {
          setFormError(error)
          return
        }
      } catch {
        setFormError('The product could not be saved. Check your connection and try again.')
        return
      } finally {
        setSaving(false)
      }
    }
    closeForm()
  }

  return (
    <div className="view stock-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>Products</h1>
          <p className="page-description">Your catalog, prices, and stock levels.</p>
        </div>
        {isOwner && (
          <button type="button" className="primary-btn" onClick={openCreate}>
            <PackagePlus size={18} aria-hidden />
            Add product
          </button>
        )}
      </header>

      {!isOwner && (
        <p className="role-note panel">Workers can adjust stock counts. Only the owner can add, edit, or remove parts.</p>
      )}

      {isOwner && (
        <section className="inventory-summary" aria-labelledby="inventory-summary-title">
          <div className="inventory-summary-head">
            <div><p className="eyebrow">AT A GLANCE</p><h2 id="inventory-summary-title">Inventory summary</h2></div>
            <p>Current stock · selling value includes tax</p>
          </div>
          <div className="inventory-summary-grid">
            <button type="button" className={`inventory-stat ${stockFilter === 'all' ? 'is-selected' : ''}`} onClick={() => setStockFilter('all')}>
              <span>Products</span><strong>{summary.products}</strong><small>{summary.stockedProducts} stocked · {summary.services} services</small>
            </button>
            <div className="inventory-stat"><span>Units on hand</span><strong>{summary.units}</strong><small>Physical stock available</small></div>
            <div className="inventory-stat"><span>Stock cost</span><strong>{money(summary.costValue)}</strong><small>Money invested in stock</small></div>
            <div className="inventory-stat"><span>Selling value</span><strong>{money(summary.salesValue)}</strong><small>Value at customer prices</small></div>
            <div className="inventory-stat is-profit"><span>Expected profit</span><strong>{money(summary.expectedProfit)}</strong><small>If current stock is sold</small></div>
            <button type="button" className={`inventory-stat ${summary.lowStock ? 'needs-attention' : ''} ${stockFilter === 'low' ? 'is-selected' : ''}`} onClick={() => setStockFilter('low')}>
              <span>Low stock</span><strong>{summary.lowStock}</strong><small>Tap to review</small>
            </button>
            <button type="button" className={`inventory-stat ${summary.outOfStock ? 'needs-attention' : ''} ${stockFilter === 'out' ? 'is-selected' : ''}`} onClick={() => setStockFilter('out')}>
              <span>Out of stock</span><strong>{summary.outOfStock}</strong><small>Tap to review</small>
            </button>
            <button type="button" className={`inventory-stat ${missingCost ? 'needs-attention' : ''} ${stockFilter === 'nocost' ? 'is-selected' : ''}`} onClick={() => setStockFilter('nocost')}>
              <span>No cost price</span><strong>{missingCost}</strong><small>{missingCost ? 'Profit overstated until set' : 'All parts have a cost'}</small>
            </button>
          </div>
        </section>
      )}

      <div className="inventory-toolbar">
      <div className="search-row panel-search">
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find by name or part number"
          aria-label="Search products"
        />
      </div>
      <div className="inventory-filters" aria-label="Filter inventory">
        {([...(['all', 'low', 'out'] as const), ...(isOwner ? (['nocost'] as const) : [])]).map((filter) => <button key={filter} type="button" aria-pressed={stockFilter === filter} onClick={() => setStockFilter(filter)}>
          {filter === 'all' ? `All products (${products.length})` : filter === 'low' ? 'Low stock' : filter === 'out' ? 'Out of stock' : `No cost price${missingCost ? ` (${missingCost})` : ''}`}
        </button>)}
      </div>
      </div>

      <ul className="stock-list">
        {filtered.map((product) => {
          const isLabor = product.isLabor
          const low = !isLabor && product.stock <= product.lowStockAt
          const out = !isLabor && product.stock <= 0
          return (
            <li key={product.id} className={`stock-row ${low ? 'is-low' : ''}`}>
              <div className="stock-info">
                <strong>{product.name}</strong>
                <div className="product-price-line"><strong>{money(finalCustomerPrice(product))}</strong><span>{product.sku}</span></div>
                <div className="product-tags">
                  {low && <span className="stock-warning">{out ? 'Out of stock' : 'Low stock'}</span>}
                  {isOwner && !isLabor && product.costPrice <= 0 && <span className="stock-warning cost-missing">No cost price</span>}
                </div>
                <span className="meta product-financials">
                  {isOwner && <>Cost {money(product.costPrice)} · Profit {money(finalCustomerPrice(product) - product.costPrice)} · </>}
                  {product.taxable ? `${percent(product.taxRate)} tax` : 'No tax'}
                </span>
              </div>
              <div className="stock-qty" aria-live="polite">
                {isLabor ? (
                  <span className="qty-pill labor">Labor</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove one ${product.name}`}
                      onClick={() => adjustStock(product.id, -1)}
                      disabled={product.stock <= 0}
                    >
                      <Minus size={16} />
                    </button>
                    <span className={`qty-pill ${out ? 'out' : low ? 'low' : ''}`}>
                      {product.stock}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Add one ${product.name}`}
                      onClick={() => adjustStock(product.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </div>
              {isOwner && (
                <div className="stock-actions">
                  <button type="button" className="ghost-btn" onClick={() => openEdit(product)}>
                    <Pencil size={16} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    onClick={() => {
                      if (confirm(`Remove ${product.name} from inventory?`)) {
                        deleteProduct(product.id)
                      }
                    }}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="retail-empty panel"><PackagePlus size={36} aria-hidden /><h2>{products.length ? 'No matching products' : 'Your shelves start here'}</h2><p>{products.length ? 'Try another search or stock filter.' : 'Add your first product with its price and starting quantity.'}</p>{isOwner && !products.length && <button type="button" className="primary-btn" onClick={openCreate}>Add your first product</button>}</li>
        )}
      </ul>

      {open && isOwner && (
        <ModalPortal onClose={closeForm}>
          <form
            className="modal panel product-modal"
            onSubmit={onSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="modal-head">
              <h2 id="product-form-title">{editingId ? 'Edit item' : 'New product'}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <h3 className="form-section-title">Product details</h3>
              <label>
                Name
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Brake Pads (set)"
                />
              </label>
              <h3 className="form-section-title">Pricing &amp; quantity</h3>
              <div className="form-row">
                <label>
                  Cost price (GH₵)
                  <input
                    required
                    inputMode="decimal"
                    value={draft.costPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, costPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Base selling price (GH₵)
                  <input
                    required
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  {editingId ? 'On hand' : 'Initial on hand'}
                  <input
                    required
                    inputMode="numeric"
                    type="number"
                    min="0"
                    step="1"
                    value={draft.stock}
                    onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>
              <section className="owner-tax-settings" aria-label="Owner tax settings">
                <label className="owner-tax-switch">
                  <input type="checkbox" checked={draft.taxable} onChange={(e) => setDraft((d) => ({ ...d, taxable: e.target.checked }))} />
                  Include tax in customer price
                </label>
                <label>
                  Your tax rate (%)
                  <input type="number" min="0" max="100" step="any" inputMode="decimal" value={draft.taxRate} disabled={!draft.taxable} onChange={(e) => setDraft((d) => ({ ...d, taxRate: e.target.value }))} />
                </label>
                <p className="field-help">Set your own rate, or switch it off. Only you see the breakdown. Customers see one final price.</p>
              </section>
              <div className="pricing-preview">
                <span>Profit per unit</span>
                <strong>{money(
                  (Number(draft.price) || 0) *
                    (draft.taxable ? 1 + (Number(draft.taxRate) || 0) / 100 : 1) -
                    Math.max(0, Number(draft.costPrice) || 0),
                )}</strong>
                <span>Final customer price</span>
                <strong>
                  {money(
                    (Number(draft.price) || 0) *
                      (draft.taxable ? 1 + (Number(draft.taxRate) || 0) / 100 : 1),
                  )}
                </strong>
              </div>
              {(Number(draft.price) || 0) * (draft.taxable ? 1 + (Number(draft.taxRate) || 0) / 100 : 1) < Number(draft.costPrice) && (
                <p className="field-warning">Warning: selling price is below cost.</p>
              )}
              {!draft.isLabor && (Number(draft.costPrice) || 0) <= 0 && (Number(draft.price) || 0) > 0 && (
                <p className="field-warning">No cost price entered: the whole selling price will be counted as profit for this part.</p>
              )}
              <h3 className="form-section-title">Stock alerts &amp; codes</h3>
              <div className="form-row">
                <label>
                  Low stock at
                  <input
                    inputMode="numeric"
                    value={draft.lowStockAt}
                    onChange={(e) => setDraft((d) => ({ ...d, lowStockAt: e.target.value }))}
                  />
                </label>
                <label>
                  Part #
                  <input
                    value={draft.sku}
                    onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Barcode
                  <input
                    value={draft.barcode}
                    onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>

              </div>

            </div>

            <div className="modal-actions">
              {formError && <p className="form-save-error" role="alert">{formError}</p>}
              <button type="button" className="ghost-btn" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to shelf'}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}
    </div>
  )
}
