import { createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { Header } from '@/components/layouts/header';
import { isAuthenticated } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/auth/verify'];

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));
    if (!isPublic && !isAuthenticated()) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => {
    const isPublic = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
    if (isPublic) {
      return <Outlet />;
    }
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header />
        <main className="container mx-auto px-4 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  },
});
