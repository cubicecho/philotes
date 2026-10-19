import * as Clipboard from "expo-clipboard";
import type { CopyButtonProps } from "@/components/ui/copy-button-base";
import { CopyButtonView } from "@/components/ui/copy-button-view";

export type { CopyButtonProps };

async function write(text: string) {
  const copied = await Clipboard.setStringAsync(text);
  if (copied === false) {
    throw new Error("The clipboard refused the text");
  }
}

/** An icon button that copies `value` to the clipboard and shows a tick for a moment. */
export function CopyButton(props: CopyButtonProps) {
  return <CopyButtonView write={write} {...props} />;
}
