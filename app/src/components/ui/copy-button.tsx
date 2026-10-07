import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/button';
import { type CopyButtonProps, useCopy } from '@/components/ui/copy-button-base';
import { Check, Copy } from '@/components/ui/icons';

export type { CopyButtonProps };

async function write(text: string) {
  if (!(await Clipboard.setStringAsync(text))) throw new Error('The clipboard refused the text');
}

export function CopyButton({
  value,
  label = 'Copy',
  variant = 'outline',
  size = 'icon-sm',
  onCopied,
  onError,
  className,
}: CopyButtonProps) {
  const { copied, copy } = useCopy(write, { value, onCopied, onError });

  return (
    <Button
      data-slot="copy-button"
      variant={variant}
      size={size}
      aria-label={copied ? 'Copied' : label}
      className={className}
      onPress={() => void copy()}
      iconSlot={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    />
  );
}
