import { Button } from '@/components/ui/button';
import type { SlotNode } from '@/lib/utils';

export interface SectionAddProps {
  /** The icon that says what the section adds. */
  iconSlot: SlotNode;
  /** Opens the section's create dialog. */
  onPress: () => void;
  /** The button's word, when "Add" is the wrong verb. */
  content?: string;
}

/** The quiet add trigger every section header on a person's page carries. */
export function SectionAdd({ iconSlot, onPress, content = 'Add' }: SectionAddProps) {
  return <Button size="xs" variant="ghost" iconSlot={iconSlot} content={content} onPress={onPress} />;
}
