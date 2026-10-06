import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Deterministic background color from a name string. */
export function nameToColor(name: string): string {
  const colors = [
    '#e2a87a',
    '#7ab8e2',
    '#7ae2a8',
    '#e27ab8',
    '#a8e27a',
    '#b87ae2',
    '#e2c87a',
    '#7ae2c8',
    '#c87ae2',
    '#e27a7a',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, { box: string; text: string }> = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

/**
 * A person's photo if there is one, otherwise a deterministic initials circle —
 * which is also what a photo that fails to load falls back to.
 */
export function Avatar({ firstName, lastName, avatarPath, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const { box, text } = SIZE_CLASSES[size];
  const name = `${firstName} ${lastName}`;

  if (avatarPath && !failed) {
    return (
      <Image
        source={{ uri: `/avatars/${avatarPath}` }}
        accessibilityLabel={name}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full', box, className)}
      />
    );
  }

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <View
      aria-hidden
      className={cn('shrink-0 items-center justify-center rounded-full', box, className)}
      style={{ backgroundColor: nameToColor(name) }}
    >
      {/* The palette above is all mid-lightness, so white holds on every swatch in both themes. */}
      <Text className={cn('font-semibold text-white', text)}>{initials}</Text>
    </View>
  );
}
