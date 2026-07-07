import { Link, usePathname, useRouter } from 'expo-router';
import { Home, LogOut, Settings, Share2, UserRoundPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home, isActive: (path: string) => path === '/' },
  { href: '/persons', label: 'People', icon: Users, isActive: (path: string) => path.startsWith('/persons') },
  { href: '/network', label: 'Network', icon: Share2, isActive: (path: string) => path === '/network' },
] as const;

const LABELS_ITEM = { href: '/labels', label: 'Labels', isActive: (path: string) => path.startsWith('/labels') };

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <header className="border-b border-border px-4 md:px-6 py-3 flex items-center gap-4">
      <Link href="/" className="font-semibold text-lg tracking-tight text-foreground">
        Philotes
      </Link>
      {/* Desktop nav */}
      <nav className="ml-auto hidden md:flex gap-1 text-sm">
        {[...NAV_ITEMS, LABELS_ITEM].map((item) => {
          const active = item.isActive(pathname ?? '');
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 ml-auto md:ml-0">
        <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={pathname?.startsWith('/settings') ? 'page' : undefined}
          >
            <Settings className={cn('h-5 w-5', pathname?.startsWith('/settings') && 'text-primary')} />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

/**
 * Mobile-only bottom tab bar + floating "add person" action.
 * Hidden at md and up, where the header nav takes over.
 */
export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    ...NAV_ITEMS,
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      isActive: (path: string) => path.startsWith('/settings'),
    },
  ];

  return (
    <>
      {/* FAB */}
      <Link
        href="/persons?new=1"
        aria-label="Add person"
        className="md:hidden fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
      >
        <UserRoundPlus className="h-6 w-6" />
      </Link>

      {/* Tab bar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const active = tab.isActive(pathname ?? '');
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
                  active ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
