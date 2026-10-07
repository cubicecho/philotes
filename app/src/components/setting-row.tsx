import type { ReactNode } from 'react';
import * as React from 'react';
import { View } from 'react-native';
import { FieldDescription, FieldTitle } from '@/components/ui/field';
import { cn, type SlotNode } from '@/lib/utils';

/** What `actionSlot` is handed when it is a function: the ids of the text on the row's left. */
type SettingRowIds = {
  /** The title's id — the control's `aria-labelledby`. `undefined` when there is no title. */
  titleId: string | undefined;
  /** The description's id — the control's `aria-describedby`, where the control takes one. */
  descriptionId: string | undefined;
};

type SettingRowProps = {
  /**
   * What the setting is called: "Dark mode", "Theme", "Auto-sync". Usually given; optional because
   * a row whose control says what it does ("Clear all memory") only needs the line explaining it.
   */
  title?: ReactNode | undefined;
  /** One line under the title on what the setting does, or what pressing the button costs. */
  description?: ReactNode | undefined;
  /**
   * The control, at the row's far end: a switch, a select, a button, an input. A function is
   * handed the ids of the title and description so the control can be named by the title:
   * `actionSlot={({ titleId }) => <Switch aria-labelledby={titleId} … />}`. A plain node for a
   * control that names itself — a button whose text is the action.
   */
  actionSlot?: SlotNode | ((ids: SettingRowIds) => SlotNode) | undefined;
  className?: string | undefined;
  titleClassName?: string | undefined;
  descriptionClassName?: string | undefined;
  actionClassName?: string | undefined;
};

/**
 * One row of a settings page: the title and a line on what it does at the start, the control that
 * changes it at the end. One source for both platforms.
 *
 * It is here because five projects wrote the same row by hand — skills-manager's `ToggleRow`,
 * philotes' dark-mode row, engrafo's theme row, mcp-router's workspace switch and zeromem's three
 * maintenance rows — with a `justify-between` in most and a different answer in each to "what
 * happens when it does not fit".
 *
 * **It wraps rather than breaking at a width.** The text has a floor (`min-w-48`) and the control
 * does not shrink, so the control sits beside the text while both fit and drops under it, at the
 * start, when they do not. That is `DescriptionList`'s rule, and for the same reason: it follows
 * the width the row is actually given — a card, a prose column, one pane of a split — where a
 * viewport breakpoint follows the window and stacks nothing in a narrow pane on a wide screen. It
 * also keeps a switch beside its title on a phone, which is where settings apps put it, while a
 * select or a wide button goes under. Plain flex-wrap, so Yoga does the same on device.
 *
 * **The title names the control when the caller lets it.** The row cannot reach inside a node it
 * was handed, so `actionSlot` may be a function, and it is given the title's id to point
 * `aria-labelledby` at — a stable `useId`, on the title as `id` (a `nativeID` on device). That is
 * the one hookup that works on both halves: a `<label htmlFor>` cannot name a `role="switch"`
 * `Pressable` on device, and it would rename a button whose own text is its name. A caller who
 * wants neither passes a node.
 *
 * Not `SwitchField`: that is a lone boolean with its caption beside it, and stays that. This is
 * the row that frames any control — a select, a button, an input, or a switch with a description.
 *
 * No state, no data, no `children`.
 */
export function SettingRow({
  title,
  description,
  actionSlot,
  className,
  titleClassName,
  descriptionClassName,
  actionClassName,
}: SettingRowProps) {
  const uid = React.useId();
  const titleId = title ? `${uid}-title` : undefined;
  const descriptionId = description ? `${uid}-description` : undefined;
  const control = typeof actionSlot === 'function' ? actionSlot({ titleId, descriptionId }) : actionSlot;

  return (
    <View
      testID="setting-row"
      className={cn('min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}
    >
      {title || description ? (
        <View testID="setting-row-text" className="min-w-48 flex-1 gap-0.5">
          {title ? (
            <FieldTitle testID="setting-row-title" id={titleId} className={titleClassName}>
              {title}
            </FieldTitle>
          ) : null}
          {description ? (
            <FieldDescription testID="setting-row-description" id={descriptionId} className={descriptionClassName}>
              {description}
            </FieldDescription>
          ) : null}
        </View>
      ) : null}
      {control ? (
        <View testID="setting-row-action" className={cn('shrink-0 flex-row items-center gap-2', actionClassName)}>
          {control}
        </View>
      ) : null}
    </View>
  );
}

export type { SettingRowIds, SettingRowProps };
