import type { PickedPhoto } from '@/lib/avatar-photo';

export interface AvatarPickerButtonProps {
  /** The button's accessible name; it draws only an icon. */
  label: string;
  /** Called with the photo the user picked. Not called when they back out. */
  onPick: (photo: PickedPhoto) => void;
}
