import { Camera } from '@/components/app-icons';
import type { AvatarPickerButtonProps } from '@/components/domain/person/avatar-picker-button-base';
import { FilePickerButton } from '@/components/ui/file-picker';
import type { PickedFile } from '@/components/ui/file-picker-base';
import { AVATAR_ACCEPT } from '@/lib/avatar-photo';

/** The round camera button on a person's photo. In a browser it opens the file dialog. */
export function AvatarPickerButton({ label, onPick }: AvatarPickerButtonProps) {
  /** Hands on the first picked file, as the part a browser uploads. */
  function pick(files: PickedFile[]) {
    const file = files[0];
    if (!file?.bytes) {
      return;
    }
    // Copied into a fresh buffer: the picker's view may sit on a shared one, which a Blob part cannot be.
    onPick({ name: file.name, part: new Blob([new Uint8Array(file.bytes)], { type: file.type }) });
  }

  return (
    <FilePickerButton
      label={label}
      accept={AVATAR_ACCEPT}
      read="bytes"
      variant="secondary"
      size="icon-xs"
      className="rounded-full"
      iconSlot={<Camera />}
      onPickMany={pick}
    />
  );
}
