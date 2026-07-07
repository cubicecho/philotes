import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface WidgetProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
}

/** Shared dashboard card shell: quiet header, no per-widget pagination. */
export function Widget({ icon, title, subtitle, viewAllHref, children }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            <h2 className="font-semibold text-sm">{title}</h2>
            {subtitle && <span className="truncate text-xs text-muted-foreground">· {subtitle}</span>}
          </div>
          {viewAllHref && (
            <Link href={viewAllHref} className="shrink-0 text-xs text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function AllCaughtUp({ message }: { message: string }) {
  return (
    <p className="py-1 text-sm text-muted-foreground italic">
      {message} <span className="not-italic">✓</span>
    </p>
  );
}
