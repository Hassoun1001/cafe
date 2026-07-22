import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import {
  Coffee,
  LayoutGrid,
  Lock,
  Package,
  Receipt,
  ClipboardCheck,
  Users,
  LineChart,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/pos', label: 'Cashier', icon: Receipt },
  { to: '/tables', label: 'Tables', icon: LayoutGrid },
  { to: '/warehouse', label: 'Warehouse', icon: Package },
  { to: '/tracker', label: 'Tracker', icon: ClipboardCheck },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/reports', label: 'Reports', icon: LineChart },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
];

function NavItems({ onNavigate, canSeeSettings }: { onNavigate?: () => void; canSeeSettings: boolean }) {
  return (
    <>
      {NAV.filter((item) => !item.adminOnly || canSeeSettings).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-accent-light text-accent-dark' : 'text-muted hover:bg-bg hover:text-ink',
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { logout, isAdmin, permissions } = useAuth();
  const canSeeSettings = isAdmin || permissions.length > 0;

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-white">
            <Coffee className="size-[18px]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Studio Cafe</div>
            <div className="text-[11px] font-medium text-muted-2">Management System</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          <NavItems canSeeSettings={canSeeSettings} />
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <Lock className="size-[18px]" strokeWidth={2} />
            Lock session
          </button>
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-surface lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-ink text-white">
              <Coffee className="size-4" strokeWidth={2} />
            </div>
            <span className="text-sm font-bold text-ink">Studio Cafe</span>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-bg">
            <Lock className="size-4" strokeWidth={2} />
            Lock
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5">
          {NAV.filter((item) => !item.adminOnly || canSeeSettings).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-accent-light text-accent-dark' : 'text-muted hover:bg-bg',
                )
              }
            >
              <item.icon className="size-4" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
