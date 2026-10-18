import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import {
  FILE_PICKER_HINT_CLASS,
  FILE_PICKER_ICON_CLASS,
  FILE_PICKER_TITLE_CLASS,
  FILE_PICKER_ZONE_CLASS,
  type FilePickerButtonProps,
  type FilePickerProps,
} from "@/components/ui/file-picker-base";
import { Upload } from "@/components/ui/icons";

const UNAVAILABLE = "Picking a file is only available on the web app.";

/** The device's stand-in for the drop zone: it says picking a file is only available on the web. */
export function FilePicker({ label }: FilePickerProps) {
  return (
    <View className={FILE_PICKER_ZONE_CLASS}>
      <Upload className={FILE_PICKER_ICON_CLASS} />
      <Text className={FILE_PICKER_TITLE_CLASS}>{label}</Text>
      <Text className={FILE_PICKER_HINT_CLASS}>{UNAVAILABLE}</Text>
    </View>
  );
}

/** The device's stand-in for the picker button: drawn and named, and disabled. */
export function FilePickerButton({
  label,
  iconSlot = <Upload />,
  variant,
  size,
  className,
}: FilePickerButtonProps) {
  const iconOnly = typeof size === "string" && size.startsWith("icon");
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled
      aria-label={label}
      hint={UNAVAILABLE}
      iconSlot={iconSlot}
      content={iconOnly ? null : label}
    />
  );
}
