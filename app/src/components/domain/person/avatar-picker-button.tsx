import { launchImageLibraryAsync } from 'expo-image-picker';
import { useState } from 'react';
import { Camera } from '@/components/app-icons';
import type { AvatarPickerButtonProps } from '@/components/domain/person/avatar-picker-button-base';
import { Button } from '@/components/ui/button';

/** What a picked photo is called and taken to be when the device does not say. */
const UNNAMED_PHOTO = { name: 'photo.jpg', type: 'image/jpeg' } as const;

/** The round camera button on a person's photo. On a device it opens the system's photo picker. */
export function AvatarPickerButton({ label, onPick }: AvatarPickerButtonProps) {
  const [isPicking, setIsPicking] = useState(false);

  /** Opens the photo picker and hands on the photo chosen there. */
  async function pick() {
    setIsPicking(true);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      if (result.canceled || asset === undefined) {
        return;
      }
      const name = asset.fileName ?? UNNAMED_PHOTO.name;
      const file = { uri: asset.uri, name, type: asset.mimeType ?? UNNAMED_PHOTO.type };
      // React Native uploads a file named by its uri, where a browser uploads a Blob. Its FormData
      // takes this shape in a Blob's place, and has no type that says so.
      onPick({ name, part: file as unknown as Blob });
    } catch (error) {
      console.error('The photo picker could not be opened', error);
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="icon-xs"
      className="rounded-full"
      aria-label={label}
      disabled={isPicking}
      iconSlot={<Camera />}
      content={null}
      onPress={() => void pick()}
    />
  );
}
