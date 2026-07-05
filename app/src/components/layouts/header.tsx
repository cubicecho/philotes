import { Link, useRouter } from 'expo-router';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken } from '@/lib/auth';

export function Header() {
  const router = useRouter();

  const handleSignOut = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <header className="border-b border-border px-6 py-3 flex items-center gap-4">
      <Link href="/" className="font-semibold text-lg">
        Philotes
      </Link>
      <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
        <Link
          href="/"
          className="hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/persons"
          className="hover:text-foreground transition-colors"
        >
          People
        </Link>
        <Link
          href="/tags"
          className="hover:text-foreground transition-colors"
        >
          Labels
        </Link>
      </nav>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label="Settings">
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
