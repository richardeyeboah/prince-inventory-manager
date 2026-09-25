import { useState } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { shouldShowInstallPrompt } from './lib/pwa'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  WalletCards,
  WifiOff,
  Wrench,
  Users,
} from 'lucide-react'
import { AuthProvider, useAuth } from './auth'
import { DashboardView } from './components/DashboardView'
import { CreditView } from './components/CreditView'
import { LoginView } from './components/LoginView'
import { MoreView } from './components/MoreView'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { ReportsView } from './components/ReportsView'
import { SalesView } from './components/SalesView'
import { SellView } from './components/SellView'
import { Brand } from './components/Brand'
import { TeamView } from './components/TeamView'
import { StockView } from './components/StockView'
import { ShopProvider, useShop } from './store'

type Tab = 'dashboard' | 'sell' | 'stock' | 'sales' | 'credit' | 'reports' | 'more' | 'team'

const desktopNavItems: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sell', label: 'Checkout', icon: Wrench },
  { id: 'stock', label: 'Products', icon: Package },
  { id: 'sales', label: 'Sales', icon: ClipboardList },
  { id: 'credit', label: 'Balances', icon: WalletCards },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'team', label: 'Staff access', icon: Users },
]

const mobileNavItems: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'sell', label: 'Checkout', icon: Wrench },
  { id: 'credit', label: 'Balances', icon: WalletCards },
  { id: 'stock', label: 'Products', icon: Package },
  { id: 'sales', label: 'Sales', icon: ClipboardList },
  { id: 'more', label: 'More', icon: Menu },
]

function Shell() {
  const [requestedTab, setTab] = useState<Tab>('dashboard')
  const { profile, signOut, isOwner } = useAuth()
  const workerTabs: Tab[] = ['dashboard', 'sell', 'credit', 'sales']
  const tab = isOwner || workerTabs.includes(requestedTab) ? requestedTab : 'dashboard'
  const mobileTab = tab === 'reports' || tab === 'team' ? 'more' : tab
  const [showInstall, setShowInstall] = useState(shouldShowInstallPrompt)
  const { loading, error, offlinePending, clearError } = useShop()

  return (
    <div className="app-frame">
      {showInstall && <InstallPrompt onClose={() => setShowInstall(false)} />}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <Brand compact />
        </div>

        <p className="sidebar-section-label">WORKSPACE</p>
        <nav className="side-nav">
          {desktopNavItems.filter(({ id }) => isOwner || workerTabs.includes(id)).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`side-link ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={19} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {profile && (
            <div className="side-user">
              <span className="side-user-name">{profile.displayName}</span>
              <span className={`role-pill ${profile.role}`}>{profile.role}</span>
            </div>
          )}
          <button type="button" className="side-signout" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-brand">
            <Brand compact />
          </div>
          <div className="topbar-title">
            {[...desktopNavItems, ...mobileNavItems].find((item) => item.id === tab)?.label}
          </div>
          <div className="topbar-right">
            {offlinePending > 0 && (
              <span className="sync-chip" title="Sales waiting to sync">
                <WifiOff size={14} aria-hidden />
                {offlinePending}
              </span>
            )}
            {profile && (
              <div className="user-chip">
                <span className="user-avatar" aria-hidden>
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="user-name">{profile.displayName}</span>
                <span className={`role-pill ${profile.role}`}>{profile.role}</span>
              </div>
            )}
            <button
              type="button"
              className="ghost-btn sign-out"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </header>

        {error && (
          <p className="sync-banner" role="alert">
            {error}
            <button type="button" className="banner-dismiss" onClick={clearError}>
              Dismiss
            </button>
          </p>
        )}

        <main className="main-stage" key={tab}>
          {loading ? (
            <div className="loading-state">
              <div className="spinner" aria-hidden />
              <p>Loading shop data…</p>
            </div>
          ) : (
            <>
              {tab === 'dashboard' && <DashboardView onNavigate={setTab} />}
              {tab === 'sell' && <SellView />}
              {tab === 'stock' && <StockView />}
              {tab === 'sales' && <SalesView />}
              {tab === 'credit' && <CreditView />}
              {tab === 'reports' && <ReportsView />}
              {tab === 'team' && isOwner && <TeamView />}
              {tab === 'more' && <MoreView onNavigate={setTab} />}
            </>
          )}
        </main>

        <nav className="tab-bar" aria-label="Main">
          {mobileNavItems.filter(({ id }) => isOwner || workerTabs.includes(id)).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`tab ${mobileTab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={mobileTab === id ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

function AppGate() {
  const { session, profile, loading, error, signOut } = useAuth()

  if (loading) {
    return (
      <div className="login-screen">
        <div className="loading-state">
          <div className="spinner" aria-hidden />
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginView />
  }

  if (!profile || profile.id !== session.user.id) {
    return <div className="loading-state"><p>{error || 'Loading your access…'}</p><button onClick={() => void signOut()}>Sign out</button></div>
  }

  return (
    <ShopProvider key={`${profile.id}:${profile.role}`}>
      <Shell />
    </ShopProvider>
  )
}

export default function App() {
  return (
    <>
      <PwaUpdatePrompt />
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </>
  )
}
