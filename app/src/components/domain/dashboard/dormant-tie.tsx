import { Link } from 'expo-router';
import { Heart } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatMonthsAgo(days: number): string {
  if (days === Number.POSITIVE_INFINITY) return 'never';
  const months = Math.floor(days / 30);
  if (months < 2) return 'over a year';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'over a year' : `over ${years} years`;
}

function AllCaughtUp({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground italic py-1">{message} ✓</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DormantTie({ person }: { person: (ReviewPerson & { daysSinceContact: number }) | null }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Someone to Reconnect With</h2>
        </div>
        {!person ? (
          <AllCaughtUp message="No dormant connections right now" />
        ) : (
          <>
            <ul className="space-y-2">
              <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Avatar
                  firstName={person.firstName}
                  lastName={person.lastName}
                  avatarPath={person.avatarPath}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/persons/`} className="font-medium hover:underline">
                    {person.firstName} {person.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Last contact:{' '}
                    {person.daysSinceContact === Number.POSITIVE_INFINITY
                      ? 'never recorded'
                      : `${formatMonthsAgo(person.daysSinceContact)} ago`}
                  </p>
                </div>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground italic px-1">
              You haven&apos;t spoken to {person.firstName} in{' '}
              {person.daysSinceContact === Number.POSITIVE_INFINITY
                ? 'a long time'
                : formatMonthsAgo(person.daysSinceContact)}{' '}
              — they might appreciate hearing from you.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
