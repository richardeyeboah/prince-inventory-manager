import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from './types'

const auth = vi.hoisted(() => ({
  session: { user: { id: 'worker' } } as { user: { id: string } } | null,
  profile: { id: 'worker', displayName: 'Worker', role: 'worker', createdAt: '' } as Profile | null,
  isOwner: false, loading: false, error: null, signOut: vi.fn(),
  updateDisplayName: vi.fn(),
}))
const rpc = vi.hoisted(() => vi.fn())
vi.mock('./auth', () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('./lib/supabase', () => ({ supabase: { rpc }, supabaseConfigured: true }))
vi.mock('./components/PwaUpdatePrompt', () => ({ PwaUpdatePrompt: () => null }))
import App from './App'
import { ShopProvider, useShop } from './store'
import { SellView } from './components/SellView'
import { SalesView } from './components/SalesView'
import { TestJob } from './components/TestJob'
import { TeamView } from './components/TeamView'

const captureShop = vi.fn<(value: ReturnType<typeof useShop>) => void>()
function Capture() { captureShop(useShop()); return null }
function getShop() {
  renderToStaticMarkup(<ShopProvider><Capture /></ShopProvider>)
  return captureShop.mock.lastCall![0]
}

beforeEach(() => {
  auth.session = { user: { id: 'worker' } }
  auth.isOwner = false
  auth.profile = { id: 'worker', displayName: 'Worker', role: 'worker', createdAt: '' }
  rpc.mockReset()
})

describe('worker access', () => {
  it('provides sign-in without public account creation', () => {
    auth.session = null
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Sign in to the shop')
    expect(html).not.toContain('Join shop')
    expect(html).not.toContain('Create account')
  })
  it('only offers receipt testing to the owner', () => {
    expect(renderToStaticMarkup(<ShopProvider><SalesView /></ShopProvider>)).not.toContain('Test job')
    expect(renderToStaticMarkup(<ShopProvider><TestJob onClose={() => {}} /></ShopProvider>)).toBe('')
    auth.isOwner = true; auth.profile!.role = 'owner'
    expect(renderToStaticMarkup(<ShopProvider><SalesView /></ShopProvider>)).toContain('Test job')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('blocks the staff management view for workers', () => {
    expect(renderToStaticMarkup(<TeamView />)).toBe('')
  })

  it('shows the worker dashboard, checkout, balances and sales navigation', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Checkout')
    expect(html).toContain('Dashboard')
    expect(html).toContain('Balances')
    expect(html).toContain('>Sales<')
    for (const label of ['>Products<', '>Reports<', '>More<', '>Staff access<']) {
      expect(html).not.toContain(label)
    }
  })
  it('keeps full navigation for owners', () => {
    auth.isOwner = true
    auth.profile!.role = 'owner'
    const html = renderToStaticMarkup(<App />)
    for (const label of ['Dashboard', 'Products', 'Sales', 'Balances', 'Reports', 'Staff access']) expect(html).toContain(label)
  })
  it('does not mount the shop for a missing or mismatched profile', () => {
    auth.profile = null
    expect(renderToStaticMarkup(<App />)).not.toContain('Checkout')
    auth.profile = { id: 'other', displayName: 'Other', role: 'owner', createdAt: '' }
    auth.isOwner = true
    expect(renderToStaticMarkup(<App />)).not.toContain('Dashboard')
  })
  it('rejects owner-only actions before making any database call', async () => {
    const value = getShop()
    expect(await value.setStock('p', 5, 4)).toBe(false)
    value.adjustStock('p', 1)
    value.deleteProduct('p')
    value.updateProduct('p', { price: 1 })
    expect(await value.voidSale('s', 'Test void', 'cash', 0)).toBe(false)
    expect(await value.resetSales('r',null,null,'test',[])).toBe(false)
    expect(await value.restoreReset('r')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects removed payment methods before submitting a sale', async () => {
    const value = getShop()
    for (const method of ['card', 'transfer'] as const) {
      expect(await value.checkout([], method, {
        customerId: null, customerName: '', customerPhone: '', vehicleInfo: '',
        dueDate: null, notes: '', amountPaid: 0, initialPaymentMethod: 'cash',
      })).toBeNull()
    }
    expect(rpc).not.toHaveBeenCalled()
  })
  it('keeps checkout tax breakdown visible only to the owner', () => {
    const workerHtml = renderToStaticMarkup(<ShopProvider><SellView /></ShopProvider>)
    expect(workerHtml).not.toContain('Tax included')
    expect(workerHtml).not.toContain('Base amount')
    auth.isOwner = true
    auth.profile!.role = 'owner'
    const ownerHtml = renderToStaticMarkup(<ShopProvider><SellView /></ShopProvider>)
    expect(ownerHtml).toContain('Tax included · owner only')
    expect(ownerHtml).toContain('Base amount')
  })
  it('offers Cash, Mobile Money and Pay later at checkout', () => {
    const html = renderToStaticMarkup(<ShopProvider><SellView /></ShopProvider>)
    const methods = html.match(/aria-label="Payment method">(.*?)<\/div>/)?.[1] ?? ''
    expect(methods).toContain('Cash')
    expect(methods).toContain('Mobile Money')
    expect(methods).toContain('Pay later')
    expect(methods.match(/<button/g)).toHaveLength(3)
    expect(methods).not.toContain('Card')
  })
})
