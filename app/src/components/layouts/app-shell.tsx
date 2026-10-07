import { Link, usePathname, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { House, LogOut, Share2, UserRoundPlus, Users } from '@/components/app-icons';
import { BarNavItem, Sidebar, SidebarNavItem, SidebarSection } from '@/components/sidebar';
import { SidebarLayout } from '@/components/split-layout';
import { Button } from '@/components/ui/button';
import { Settings, Tag } from '@/components/ui/icons';
import { clearToken } from '@/lib/auth';
import type { SlotNode } from '@/lib/utils';

/** The app's places, mapped once into the rail and once into the phone's bar. */
const PLACES = [
  { href: '/', label: 'Dashboard', Icon: House, isActive: (path: string) => path === '/' },
  { href: '/persons', label: 'People', Icon: Users, isActive: (path: string) => path.startsWith('/persons') },
  { href: '/network', label: 'Network', Icon: Share2, isActive: (path: string) => path === '/network' },
  { href: '/labels', label: 'Labels', Icon: Tag, isActive: (path: string) => path.startsWith('/labels') },
  { href: '/settings', label: 'Settings', Icon: Settings, isActive: (path: string) => path.startsWith('/settings') },
] as const;

/**
 * The persistent shell: a rail of the app's places from `md` up, and a bar of
 * the same places over the page on a phone.
 */
export function AppShell({ contentSlot }: { contentSlot: SlotNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  function signOut() {
    clearToken();
    router.replace('/login');
  }

  return (
    <SidebarLayout
      className="h-full flex-1 bg-background"
      sidebarPosition="start"
      sidebarWidth="auto"
      divider="none"
      sidebarHideBelow="md"
      sidebarSlot={
        <Sidebar
          label="Philotes"
          headerSlot={
            <>
              <Link href="/" className="px-1 font-semibold text-foreground text-lg tracking-tight no-underline">
                Philotes
              </Link>
              {/* The one filled thing in the rail, so the colour is the hierarchy. */}
              <Link href="/persons?new=1" asChild>
                <Button
                  size="sm"
                  className="w-full gap-2 rounded-lg"
                  iconSlot={<UserRoundPlus className="h-4 w-4" />}
                  content="Add person"
                />
              </Link>
            </>
          }
          contentSlot={
            <SidebarSection
              as="nav"
              label="Main"
              contentSlot={PLACES.filter((place) => place.href !== '/settings').map(
                ({ href, label, Icon, isActive }) => (
                  <Link key={href} href={href} asChild>
                    <SidebarNavItem href={href} label={label} iconSlot={<Icon />} active={isActive(pathname)} />
                  </Link>
                ),
              )}
            />
          }
          footerSlot={
            <>
              <Link href="/settings" asChild>
                <SidebarNavItem
                  href="/settings"
                  label="Settings"
                  iconSlot={<Settings />}
                  active={pathname.startsWith('/settings')}
                />
              </Link>
              {/* A button, not a link: it does something rather than going somewhere. */}
              <SidebarNavItem label="Sign out" iconSlot={<LogOut />} onPress={signOut} />
            </>
          }
        />
      }
      brandSlot={<Text className="font-semibold text-foreground text-lg tracking-tight">Philotes</Text>}
      navLabel="Main"
      navSlot={PLACES.map(({ href, label, Icon, isActive }) => (
        <Link key={href} href={href} asChild>
          <BarNavItem label={label} iconSlot={<Icon />} active={isActive(pathname)} />
        </Link>
      ))}
      actionSlot={
        <>
          <Link href="/persons?new=1" asChild>
            <ActionButton label="Add person" iconSlot={<UserRoundPlus />} />
          </Link>
          <ActionButton label="Sign out" iconSlot={<LogOut />} onPress={signOut} />
        </>
      }
      // `role="main"` is what react-native-web turns into a <main>. It does not
      // scroll: each screen is a `PageLayout`, whose body scrolls under its
      // pinned header, and that needs a height to divide.
      contentSlot={
        <View role="main" className="min-h-0 min-w-0 flex-1">
          {contentSlot}
        </View>
      }
    />
  );
}
