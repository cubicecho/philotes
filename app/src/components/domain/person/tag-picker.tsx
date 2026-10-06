import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { MultiSelect } from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { type FieldProps, FieldWrapper, useFieldContext } from '@/components/ui/form';
import { Tag } from '@/components/ui/icons';

export interface TagOption {
  id: string;
  label: string;
  color: string;
}

/** The quiet "Add tag" trigger under a row's attached tags. */
export function AddTagButton({ onPress }: { onPress: () => void }) {
  return (
    <Button variant="ghost" size="xs" className="self-start" iconSlot={<Tag />} content="Add tag" onPress={onPress} />
  );
}

interface TagPickerPanelProps {
  allTags: TagOption[];
  attachedTagIds: Set<string>;
  onSelect: (labelId: string) => void;
  onClose: () => void;
}

/** The inline panel a row opens to attach one more tag: every tag not yet attached, and a way out. */
export function TagPickerPanel({ allTags, attachedTagIds, onSelect, onClose }: TagPickerPanelProps) {
  const available = allTags.filter((t) => !attachedTagIds.has(t.id));

  return (
    <View className="flex-row flex-wrap items-center gap-1.5 rounded-md border border-border p-2">
      {available.length === 0 ? (
        <Text className="text-xs text-muted-foreground">All tags attached.</Text>
      ) : (
        available.map((t) => <LabelChip key={t.id} label={t.label} color={t.color} onPress={() => onSelect(t.id)} />)
      )}
      <Button variant="ghost" size="xs" className="ml-auto" content="Cancel" onPress={onClose} />
    </View>
  );
}

/** A form's tag picker, bound to a `string[]` of label ids. Render inside `form.AppField`. */
export function TagsField({ allTags, ...fieldProps }: Omit<FieldProps, 'label'> & { allTags: TagOption[] }) {
  const field = useFieldContext<string[]>();

  return (
    <FieldWrapper
      label="Tags"
      asGroup
      {...fieldProps}
      controlSlot={
        <MultiSelect
          options={allTags.map((t) => ({ value: t.id, label: t.label, color: t.color }))}
          value={field.state.value}
          onValueChange={(next) => {
            field.handleChange(next);
            field.handleBlur();
          }}
          placeholder="Add tags..."
          searchLabel="Search tags"
          popoverLabel="Tags"
        />
      }
    />
  );
}
