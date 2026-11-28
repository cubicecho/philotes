import type { ReactNode } from "react";
import { View } from "react-native";
import { Alert } from "@/components/ui/alert";
import { CodeBlock } from "@/components/ui/code";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export type SecretRevealProps = {
  /** The secret itself, drawn in full and wrapped at any character, since it has no spaces. */
  value: string;
  /**
   * What it is: "API key", "Pairing secret". The code block's title, and so the copy button's
   * name, "Copy API key". Left out, the block has no header and the button is "Copy".
   */
  label?: string | undefined;
  /**
   * The warning's title, in a few words: "Copy it now". The warning is drawn when this or
   * `description` is given; leave both out when the dialog's own title already says it.
   */
  title?: ReactNode | undefined;
  /**
   * The warning's line: why it will not be shown again, and what to do if it is lost — "Only its
   * hash is kept, so it will not be shown again. A lost key is revoked and replaced."
   */
  description?: ReactNode | undefined;
  /** The copy button's name, when "Copy {label}" is not the right one. */
  copyLabel?: string | undefined;
  /** On the root, the column the warning and the block stand in. */
  className?: string | undefined;
};

/** A secret shown once: a warning that it will not be shown again, and the value with a copy button. */
export function SecretReveal({
  value,
  label,
  title,
  description,
  copyLabel,
  className,
}: SecretRevealProps) {
  const warned = Boolean(title) || Boolean(description);
  return (
    <View testID="secret-reveal" className={cn("min-w-0 gap-4", className)}>
      {warned ? <Alert variant="warning" title={title} description={description} /> : null}
      <CodeBlock
        title={label}
        content={value}
        // A key is one long word: wrapped, all of it is on screen to check against what was pasted.
        wrap
        actionSlot={<CopyButton value={value} label={copyLabel} />}
      />
    </View>
  );
}
