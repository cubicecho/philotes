import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken } from '@/lib/auth';
import { useDarkMode } from '@/hooks/use-dark-mode';

export function Header() {
  const navigate = useNavigate();
  const { dark, toggle } = useDarkMode();

  const handleSignOut = () => {
    clearToken();
    navigate({ to: '/login' });
  };

  return (
    <header className="border-b border-border px-6 py-3 flex items-center gap-4">
      <Link to="/" className="font-semibold text-lg">
        Philotes
      </Link>
      <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
        <Link
          to="/"
          className="hover:text-foreground transition-colors"
          activeProps={{ className: 'text-foreground font-medium' }}
          activeOptions={{ exact: true }}
        >
          Dashboard
        </Link>
        <Link
          to="/persons"
          className="hover:text-foreground transition-colors"
          activeProps={{ className: 'text-foreground font-medium' }}
        >
          People
        </Link>
        <Link
          to="/tags"
          className="hover:text-foreground transition-colors"
          activeProps={{ className: 'text-foreground font-medium' }}
        >
          Labels
        </Link>
      </nav>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={toggle}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
