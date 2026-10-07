import { useState } from 'react';
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
function AddTagButton({ onPress }: { onPress: () => void }) {
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
function TagPickerPanel({ allTags, attachedTagIds, onSelect, onClose }: TagPickerPanelProps) {
  const available = allTags.filter((t) => attachedTagIds.has(t.id) === false);

  return (
    <View className="flex-row flex-wrap items-center gap-1.5 rounded-md border border-foreground/10 p-2">
      {available.length === 0 ? (
        <Text className="text-xs text-foreground/60">All tags attached.</Text>
      ) : (
        available.map((t) => <LabelChip key={t.id} label={t.label} color={t.color} onPress={() => onSelect(t.id)} />)
      )}
      <Button variant="ghost" size="xs" className="ml-auto" content="Cancel" onPress={onClose} />
    </View>
  );
}

export interface RowTagsProps {
  /** The tags attached to the row. */
  tags: TagOption[];
  /** Every tag the user has. */
  allTags: TagOption[];
  /** Attaches one tag to the row. */
  onAttach: (labelId: string) => Promise<unknown>;
  /** Detaches one tag from the row. */
  onDetach: (labelId: string) => Promise<unknown>;
  /** Called after either, so the owner can refetch. */
  onChanged: () => void;
}

/** The tags on a note, an interaction or an important date: each removable, and a picker to attach one more. */
export function RowTags({ tags, allTags, onAttach, onDetach, onChanged }: RowTagsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const attachedTagIds = new Set(tags.map((t) => t.id));

  const handleAttach = async (labelId: string) => {
    await onAttach(labelId);
    onChanged();
    setPickerOpen(false);
  };

  const handleDetach = async (labelId: string) => {
    await onDetach(labelId);
    onChanged();
  };

  return (
    <View className="gap-1">
      {tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {tags.map((t) => (
            <LabelChip key={t.id} label={t.label} color={t.color} onRemove={() => handleDetach(t.id)} />
          ))}
        </View>
      )}
      {pickerOpen ? (
        <TagPickerPanel
          allTags={allTags}
          attachedTagIds={attachedTagIds}
          onSelect={handleAttach}
          onClose={() => setPickerOpen(false)}
        />
      ) : (
        <AddTagButton onPress={() => setPickerOpen(true)} />
      )}
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
