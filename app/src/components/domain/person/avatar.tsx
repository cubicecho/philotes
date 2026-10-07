import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useAvatarImage } from '@/hooks/use-avatar-image';
import { nameToColor } from '@/lib/name-color';
import { initialsOf } from '@/lib/person-name';
import { cn } from '@/lib/utils';

interface AvatarProps {
  /** The person's name as shown, which gives the initials, their colour and the photo's label. */
  name: string;
  /** The stored photo's path; `null` or left out draws the initials. */
  avatarPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** The box and the initials text classes of each size. */
const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, { box: string; text: string }> = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

/**
 * A person's photo if there is one, otherwise a deterministic initials circle, which is also
 * what shows while a photo loads and when it fails to.
 */
export function Avatar({ name, avatarPath, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const { box, text } = SIZE_CLASSES[size];
  const imageUri = useAvatarImage(avatarPath ?? null);

  const showsPhoto = imageUri !== null && failed === false;
  if (showsPhoto) {
    return (
      <Image
        source={{ uri: imageUri }}
        accessibilityLabel={name}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full', box, className)}
      />
    );
  }

  return (
    <View
      aria-hidden
      className={cn('shrink-0 items-center justify-center rounded-full', box, className)}
      style={{ backgroundColor: nameToColor(name) }}
    >
      {/* The palette above is all mid-lightness, so white holds on every swatch in both themes. */}
      <Text className={cn('font-semibold text-white', text)}>{initialsOf(name)}</Text>
    </View>
  );
}
