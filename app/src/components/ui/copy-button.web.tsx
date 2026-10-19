import type { CopyButtonProps } from "@/components/ui/copy-button-base";
import { CopyButtonView } from "@/components/ui/copy-button-view";

export type { CopyButtonProps };

async function write(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (ok === false) {
    throw new Error("The clipboard refused the text");
  }
}

/** An icon button that copies `value` to the clipboard and shows a tick for a moment. */
export function CopyButton(props: CopyButtonProps) {
  return <CopyButtonView write={write} {...props} />;
}
