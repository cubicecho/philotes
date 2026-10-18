import type { ReactNode } from "react";
import * as React from "react";
import { View } from "react-native";
import {
  DescriptionHint,
  DescriptionHintText,
  type DescriptionPlacement,
} from "@/components/ui/description-hint";
import { FieldDescription, FieldTitle } from "@/components/ui/field";
import { cn, type SlotNode } from "@/lib/utils";

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
   * Where the description is drawn. `inline` (the default) puts it under the title; `popover`
   * puts it behind a small button beside the title, named "About <title>". `descriptionId` is
   * handed to `actionSlot` either way, and on the web still resolves to the text. A row with no
   * title has nothing to put the button beside, so its description stays inline.
   */
  descriptionPlacement?: DescriptionPlacement | undefined;
  /** The `popover` button's glyph. A question mark by default. */
  descriptionIconSlot?: SlotNode | undefined;
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
 * changes it at the end. It frames any control; a lone boolean with its caption is `SwitchField`.
 *
 * The row wraps rather than breaking at a width: the control sits beside the text while both fit
 * and drops under it when they do not, by the width the row is given. `actionSlot` may be a
 * function, which is handed the title's id to point `aria-labelledby` at. A `<label htmlFor>`
 * cannot name a `role="switch"` `Pressable` on device.
 */
export function SettingRow({
  title,
  description,
  descriptionPlacement = "inline",
  descriptionIconSlot,
  actionSlot,
  className,
  titleClassName,
  descriptionClassName,
  actionClassName,
}: SettingRowProps) {
  const uid = React.useId();
  const titleId = title ? `${uid}-title` : undefined;
  const descriptionId = description ? `${uid}-description` : undefined;
  const folded = Boolean(title && description) && descriptionPlacement === "popover";
  const titleNode = title ? (
    <FieldTitle
      testID="setting-row-title"
      id={titleId}
      className={cn(folded && "min-w-0 shrink", titleClassName)}
    >
      {title}
    </FieldTitle>
  ) : null;
  const control =
    typeof actionSlot === "function" ? actionSlot({ titleId, descriptionId }) : actionSlot;

  return (
    <View
      testID="setting-row"
      className={cn(
        "min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      {title || description ? (
        <View testID="setting-row-text" className="min-w-48 flex-1 gap-0.5">
          {folded ? (
            // Beside the title and not inside it: the title is a `Text`.
            <View testID="setting-row-title-row" className="min-w-0 flex-row items-center gap-2">
              {titleNode}
              <DescriptionHint
                testID="setting-row-description-trigger"
                label={title}
                fallbackName="About this setting"
                description={description}
                iconSlot={descriptionIconSlot}
              />
            </View>
          ) : (
            titleNode
          )}
          {folded ? (
            <DescriptionHintText id={descriptionId}>{description}</DescriptionHintText>
          ) : null}
          {description && folded === false ? (
            <FieldDescription
              testID="setting-row-description"
              id={descriptionId}
              className={descriptionClassName}
            >
              {description}
            </FieldDescription>
          ) : null}
        </View>
      ) : null}
      {control ? (
        <View
          testID="setting-row-action"
          className={cn("shrink-0 flex-row items-center gap-2", actionClassName)}
        >
          {control}
        </View>
      ) : null}
    </View>
  );
}

export type { SettingRowIds, SettingRowProps };
