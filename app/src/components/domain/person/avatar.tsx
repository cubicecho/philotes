import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useAvatarImage } from '@/hooks/use-avatar-image';
import { nameToColor } from '@/lib/name-color';
import { fullName } from '@/lib/person-name';
import { cn } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, { box: string; text: string }> = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

/**
 * A person's photo if there is one, otherwise a deterministic initials circle, which is also
 * what shows while a photo loads and when it fails to.
 */
export function Avatar({ firstName, lastName, avatarPath, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const { box, text } = SIZE_CLASSES[size];
  const name = fullName({ firstName, lastName });
  const imageUri = useAvatarImage(avatarPath ?? null);

  if (imageUri !== null && failed === false) {
    return (
      <Image
        source={{ uri: imageUri }}
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
