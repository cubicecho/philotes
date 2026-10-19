import { useContext } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlockTitleContext } from "@/components/ui/code";
import { type CopyButtonProps, useCopy } from "@/components/ui/copy-button-base";
import { Check, Copy } from "@/components/ui/icons";

type CopyButtonViewProps = CopyButtonProps & {
  /** Puts the text on the clipboard, and rejects when the platform refuses it. */
  write: (text: string) => Promise<void>;
};

/** The copy button, taking the platform's clipboard as `write`. */
export function CopyButtonView({
  write,
  value,
  label,
  variant = "outline",
  size = "icon-sm",
  onCopied,
  onError,
  disabled,
  hint,
  className,
}: CopyButtonViewProps) {
  const { copied, copy } = useCopy(write, { value, onCopied, onError });
  // Inside a titled `CodeBlock`, the block's title says what is copied.
  const title = useContext(CodeBlockTitleContext);
  const name = label ?? (title === undefined ? "Copy" : `Copy ${title}`);

  return (
    <Button
      data-slot="copy-button"
      variant={variant}
      size={size}
      aria-label={copied ? "Copied" : name}
      className={className}
      disabled={disabled}
      hint={hint}
      onPress={() => {
        // `Button` already refuses the press; this keeps a disabled copy from writing regardless.
        if (disabled === true) {
          return;
        }
        void copy();
      }}
      iconSlot={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    />
  );
}
