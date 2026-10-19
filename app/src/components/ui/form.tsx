import { Slot } from "@radix-ui/react-slot";
import type { DeepKeys } from "@tanstack/react-form";
import { createFormHook, createFormHookContexts, useStore } from "@tanstack/react-form";
import type { ComponentType, ReactNode } from "react";
import * as React from "react";
import { Text, View } from "react-native";
import {
  PasswordInput,
  type PasswordInputProps,
  revealLabelsFor,
} from "@/components/password-input";
import { Button, type ButtonPropsWithout } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DescriptionHint,
  DescriptionHintText,
  type DescriptionPlacement,
} from "@/components/ui/description-hint";
import {
  FieldContent,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldLabel as FieldLabelPrimitive,
  Field as FieldPrimitive,
} from "@/components/ui/field";
import { FormElement } from "@/components/ui/form-element";
import type { FormElementProps } from "@/components/ui/form-element-base";
import { Input } from "@/components/ui/input";
import type { InputProps } from "@/components/ui/input-base";
import type { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TextareaProps } from "@/components/ui/textarea-base";
import { messageOf } from "@/lib/error-message";
import {
  type BindableForm,
  type FormBinding,
  fieldOf,
  type NamesOfType,
  type ValuesOf,
} from "@/lib/form-binding";
import { numberText, parseNumber } from "@/lib/number-draft";
import {
  blocksOf,
  isNote,
  isSeparator,
  menuValueOf,
  type SelectOption,
  type SelectSeparatorEntry,
  storedValueOf,
  withEmptyOption,
} from "@/lib/select-options";
import { cn, type SlotNode } from "@/lib/utils";

/** TanStack Form's contexts, which the bound fields read their field and form from. */
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

/**
 * Per-field unique ID, so the `id`s below are derived rather than passed — and whether the label
 * names the control by `htmlFor` or the control points back at it by `aria-labelledby`.
 */
const IdContext = React.createContext<{ id: string; asGroup: boolean } | null>(null);

/**
 * The field's first error, or nothing — and *when* is most of what this does.
 *
 * Nothing is shown as wrong until the user has been in the field or has tried to submit —
 * otherwise an empty required field is red on first paint. The rule and the name are the web
 * `app-form`'s, so a field written by hand on either half turns red when these do.
 */
function useFieldError(): string | undefined {
  const field = useFieldContext();
  const errors = useStore(field.store, (s) => s.meta.errors);
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const submissionAttempts = useStore(field.form.store, (s) => s.submissionAttempts);
  if (isTouched === false && submissionAttempts === 0) {
    return undefined;
  }
  return messageOf(errors[0]);
}

/**
 * The ids of the field's parts, for a control with a second element to name. `ColorField`'s
 * swatch row points back at `labelId`: the label names the hex box by `htmlFor`, and a `<label>`
 * cannot also name a `radiogroup`.
 */
function useFieldIds() {
  const context = React.useContext(IdContext);
  if (!context) {
    throw new Error("Form field components must be used within <Field>");
  }
  const { id, asGroup } = context;
  return {
    labelId: `${id}-label`,
    controlId: `${id}-control`,
    descriptionId: `${id}-description`,
    messageId: `${id}-message`,
    asGroup,
  };
}

function useFieldComponentContext() {
  const ids = useFieldIds();
  const error = useFieldError() ?? null;
  return { ...ids, error, hasError: error !== null };
}

/**
 * The form body. On web this is a real `<form>` so Enter inside a field still
 * submits; on native it is a `View` and `SubmitButton` is the only path to
 * submission. Either way the submit is routed through form context.
 */
function Form({ id, className, children }: Omit<FormElementProps, "onSubmit">) {
  const form = useFormContext();
  return (
    <FormElement
      id={id}
      onSubmit={() => {
        form.handleSubmit();
      }}
      className={className}
    >
      {children}
    </FormElement>
  );
}

type FieldProps = React.ComponentProps<typeof FieldPrimitive> & {
  /**
   * The label names the control by `aria-labelledby` rather than by `htmlFor` — the web
   * `FormField`'s `asGroup`. For a control a `<label>` cannot name, or names wrongly: a group (a
   * `radiogroup`, a swatch row), and a trigger whose name has to carry its value. A
   * `DateTimeInput` named by `htmlFor` is "Due" and loses the date; named by reference it is
   * "Due September 15th, 2026". The label keeps its `id` either way.
   */
  asGroup?: boolean | undefined;
};

/**
 * Provides the ID context the rest of the field reads.
 *
 * The web original also set `data-invalid` here for a `group-data-[…]/field:`
 * variant. Both are DOM-only, and the invalid state that matters is already on
 * the control itself as `aria-invalid` — which is what a screen reader reads.
 */
function Field({ asGroup = false, ...props }: FieldProps) {
  const uid = React.useId();
  const context = React.useMemo(() => ({ id: uid, asGroup }), [uid, asGroup]);
  return (
    <IdContext.Provider value={context}>
      <FieldPrimitive {...props} />
    </IdContext.Provider>
  );
}

/**
 * Carries the label's `id` — the `nativeID` on device, what `aria-labelledby` points at — and
 * wires `htmlFor` to the control, unless the field is `asGroup` and the control points back.
 */
function FieldLabel({ ...props }: React.ComponentProps<typeof Label>) {
  const { controlId, labelId, asGroup } = useFieldIds();
  return <FieldLabelPrimitive id={labelId} htmlFor={asGroup ? undefined : controlId} {...props} />;
}

/**
 * Passes the id and the aria wiring down to whatever control is inside, without
 * rendering an element of its own — so any control can be bound, including one
 * this file knows nothing about.
 *
 * radix's `Slot` is used on both platforms. It only clones its child with merged
 * props; there is no DOM in it, so it works under React Native unchanged.
 */
function FieldControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { controlId, labelId, descriptionId, messageId, hasError, asGroup } =
    useFieldComponentContext();
  const describedBy = [descriptionId, hasError ? messageId : null].filter(Boolean).join(" ");
  return (
    <Slot
      id={controlId}
      aria-labelledby={asGroup ? labelId : undefined}
      aria-describedby={describedBy || undefined}
      aria-invalid={hasError || undefined}
      {...props}
    />
  );
}

/** The field's help text, carrying the id the control's `aria-describedby` points at. */
function FieldDescription({ ...props }: React.ComponentProps<typeof FieldDescriptionPrimitive>) {
  const { descriptionId } = useFieldComponentContext();
  return <FieldDescriptionPrimitive id={descriptionId} {...props} />;
}

/** The description behind a popover, kept where `aria-describedby` can still reach it. */
function FieldDescriptionText({ children }: { children: ReactNode }) {
  const { descriptionId } = useFieldComponentContext();
  return <DescriptionHintText id={descriptionId}>{children}</DescriptionHintText>;
}

/** The field's error message, drawn only while there is one. */
function FieldError({ ...props }: React.ComponentProps<typeof FieldErrorPrimitive>) {
  const { error, messageId } = useFieldComponentContext();
  if (!error) {
    return null;
  }
  return (
    <FieldErrorPrimitive id={messageId} {...props}>
      {error}
    </FieldErrorPrimitive>
  );
}

/** The floor a cell holds: what makes the row wrap instead of squeezing. */
const CELL_FLOOR = {
  2: "min-w-[45%]",
  3: "min-w-[30%]",
} as const;

type FieldRowProps = {
  /**
   * The fields, as the web `FieldRow` takes them. Each gets a cell of its own, and one that
   * renders nothing (`{isEdit && <field.InputField … />}`) leaves no empty cell behind.
   */
  contentSlot?: ReactNode;
  /** How many fit on a line before the row wraps. */
  perRow?: keyof typeof CELL_FLOOR | undefined;
  className?: string | undefined;
  cellClassName?: string | undefined;
};

/**
 * The fields, one entry each, keyed. A fragment is how a slot holding several things arrives,
 * and `Children.toArray` counts it as one child, so a fragment at the top is opened once.
 */
function fieldsOf(content: ReactNode): Array<{ key: string; node: ReactNode }> {
  const flat = React.Children.toArray(content).flatMap((child) =>
    React.isValidElement<{ children?: ReactNode }>(child) && child.type === React.Fragment
      ? React.Children.toArray(child.props.children)
      : [child],
  );
  return flat.map((node, position) => ({
    key: React.isValidElement(node) && node.key ? node.key : `cell-${position}`,
    node,
  }));
}

/**
 * Fields side by side, two to a row — what `grid grid-cols-2 gap-4` did on web.
 * `grid` has no native equivalent, and the `flex-1` has to sit on each cell
 * rather than on the field, which would then only be laid out correctly inside
 * a row. The cell's minimum width is what makes a third field wrap instead of
 * squeezing.
 */
function FieldRow({ contentSlot, perRow = 2, className, cellClassName }: FieldRowProps) {
  return (
    <View className={cn("flex-row flex-wrap gap-4", className)}>
      {fieldsOf(contentSlot).map(({ key, node }) => (
        <View key={key} className={cn("flex-1", CELL_FLOOR[perRow], cellClassName)}>
          {node}
        </View>
      ))}
    </View>
  );
}

/**
 * Everything the shell around a bound field draws, minus the control — the native counterpart
 * of the web `app-form`'s `FieldProps`, in the same words.
 */
type BoundFieldProps = {
  label: ReactNode;
  /** A line under the control — what to put in it, or what changing it costs. */
  description?: ReactNode | undefined;
  /**
   * Where the description is drawn. `inline` (the default) puts it under the control; `popover`
   * puts it behind a small button beside the label, named "About <label>". For a description that
   * is a paragraph off a schema: one press away rather than stacked down the form. On the web the
   * control is described by it either way.
   */
  descriptionPlacement?: DescriptionPlacement | undefined;
  /** The `popover` button's glyph. A question mark by default. */
  descriptionIconSlot?: SlotNode | undefined;
  /** Draws the asterisk and sets `aria-required` on the control. */
  required?: boolean | undefined;
  /** `horizontal` puts the control first and the label beside it: a checkbox, a switch. */
  orientation?: "vertical" | "horizontal" | undefined;
  /** See {@link Field}: the label names the control by `aria-labelledby`. */
  asGroup?: boolean | undefined;
  className?: string | undefined;
  labelClassName?: string | undefined;
  descriptionClassName?: string | undefined;
  errorClassName?: string | undefined;
};

/** The keys above, as values, so one flat prop list can be split into field and control. */
const FIELD_KEYS = new Set<string>([
  "label",
  "description",
  "descriptionPlacement",
  "descriptionIconSlot",
  "required",
  "orientation",
  "asGroup",
  "className",
  "labelClassName",
  "descriptionClassName",
  "errorClassName",
]);

/**
 * Splits one flat prop list into the half the field draws and the half the control takes — the
 * web `app-form`'s, so a field this file does not ship is written the way these are.
 */
function splitProps<T>(props: BoundFieldProps & T): [BoundFieldProps, T] {
  const field: Record<string, unknown> = {};
  const control: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (FIELD_KEYS.has(key)) {
      field[key] = value;
    } else {
      control[key] = value;
    }
  }
  return [field as BoundFieldProps, control as T];
}

type FieldWrapperProps = BoundFieldProps & {
  controlSlot: SlotNode;
};

/**
 * Label, control, description, error — the shape every bound field here is built from, and the
 * one to build a new one from. `horizontal` puts the control first and stacks the rest beside it.
 */
function FieldWrapper({
  label,
  controlSlot,
  description,
  descriptionPlacement = "inline",
  descriptionIconSlot,
  required = false,
  orientation = "vertical",
  asGroup,
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
}: FieldWrapperProps) {
  const folded = Boolean(description) && descriptionPlacement === "popover";
  const labelNode = (
    <FieldLabel className={cn(folded && "min-w-0 shrink", labelClassName)}>
      {label}
      {required ? (
        // Decoration: the name stays "Email", not "Email star". `aria-required` says it instead.
        <Text aria-hidden className="text-negative">
          {" *"}
        </Text>
      ) : null}
    </FieldLabel>
  );
  // Beside the label and not inside it: the label is a `Text`, a button in a `Text` is not
  // something the device lays out, and on the web it would be a button inside a `<label>`.
  const title = folded ? (
    <View testID="field-label-row" className="min-w-0 flex-row items-center gap-2">
      {labelNode}
      <DescriptionHint
        testID="field-description-trigger"
        label={label}
        fallbackName="About this field"
        description={description}
        iconSlot={descriptionIconSlot}
      />
    </View>
  ) : (
    labelNode
  );
  const wired = <FieldControl aria-required={required || undefined}>{controlSlot}</FieldControl>;
  const rest = (
    <>
      {description && folded === false ? (
        <FieldDescription className={descriptionClassName}>{description}</FieldDescription>
      ) : null}
      {folded ? <FieldDescriptionText>{description}</FieldDescriptionText> : null}
      <FieldError className={errorClassName} />
    </>
  );

  if (orientation === "horizontal") {
    return (
      <Field orientation="horizontal" asGroup={asGroup} className={cn("items-start", className)}>
        {wired}
        <FieldContent>
          {title}
          {rest}
        </FieldContent>
      </Field>
    );
  }
  return (
    <Field asGroup={asGroup} className={className}>
      {title}
      {wired}
      {rest}
    </Field>
  );
}

type InputFieldProps = BoundFieldProps &
  Omit<InputProps, "value" | "onChangeText" | "onBlur" | keyof BoundFieldProps>;

/** The text box behind `InputField`, for every `type` but `number`. */
function TextField(props: InputFieldProps) {
  const [fieldProps, input] = splitProps(props);
  // The stored value is whatever the schema says, a string or null, and this component is
  // generic over both, so there is nothing narrower to write here. `String(… ?? "")` is the
  // one edge: a `TextInput` takes only a string.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  const field = useFieldContext<any>();

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <Input
          {...input}
          value={String(field.state.value ?? "")}
          onBlur={field.handleBlur}
          onChangeText={(text) => field.handleChange(text)}
        />
      }
    />
  );
}

type NumberFieldProps = BoundFieldProps &
  Omit<
    InputProps,
    "value" | "defaultValue" | "onChangeText" | "onBlur" | "type" | keyof BoundFieldProps
  > & {
    /**
     * Whole numbers only: the digits keypad on device, a step of 1 on the web, and a fraction such
     * as `1.5` stores `null` (as a half-typed `-` does) for a validator to report, not a rounding.
     */
    integer?: boolean | undefined;
  };

/**
 * A number box whose field holds `number | null`: empty is `null`, not `0`.
 *
 * What was typed is kept as a draft and drawn while it still means the stored number, so `1.`
 * survives to take its next digit. A lone `-` or `1e` stores `null` and stays in the box. On blur
 * the text settles to the stored number. `signed` gets iOS a keyboard with a minus key.
 */
function NumberField({ integer = false, ...props }: NumberFieldProps) {
  const [fieldProps, input] = splitProps(props);
  const field = useFieldContext<number | null>();
  const [draft, setDraft] = React.useState<string | undefined>(undefined);
  const stored = field.state.value ?? null;

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <Input
          // `type="number"` alone raises the digits-only keypad on a phone, which has no point.
          inputMode={integer ? "numeric" : "decimal"}
          {...(integer ? { step: 1 } : {})}
          {...input}
          type="number"
          value={numberText(draft, stored, integer)}
          onBlur={() => {
            setDraft(undefined);
            field.handleBlur();
          }}
          onChangeText={(text) => {
            setDraft(text);
            field.handleChange(parseNumber(text, integer));
          }}
        />
      }
    />
  );
}

/**
 * A text box and the field around it. `className` is the field's, as on every bound field.
 *
 * `type="number"` is {@link NumberField}, so a call site written before that field existed keeps
 * storing `number | null`. New code names `NumberField`.
 */
function InputField(props: InputFieldProps) {
  if (props.type === "number") {
    return <NumberField {...props} />;
  }
  return <TextField {...props} />;
}

type TextAreaFieldProps = BoundFieldProps &
  Omit<TextareaProps, "value" | "onChangeText" | "onBlur" | keyof BoundFieldProps>;

/** A multi-line text box and the field around it. */
function TextAreaField(props: TextAreaFieldProps) {
  const [fieldProps, textarea] = splitProps(props);
  const field = useFieldContext<string>();

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <Textarea
          {...textarea}
          value={field.state.value ?? ""}
          onBlur={field.handleBlur}
          onChangeText={(text) => field.handleChange(text)}
        />
      }
    />
  );
}

type PasswordFieldProps = BoundFieldProps &
  Omit<PasswordInputProps, "value" | "onChangeText" | "onBlur" | keyof BoundFieldProps>;

/**
 * A password box with its reveal button, and the field around it. Not `InputField` with
 * `type="password"`, which has no button. A string `label` names the button too: "Show API key".
 */
function PasswordField(props: PasswordFieldProps) {
  const [fieldProps, input] = splitProps(props);
  const field = useFieldContext<string | null>();
  const revealLabels = revealLabelsFor(fieldProps.label);

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <PasswordInput
          {...input}
          showLabel={input.showLabel ?? revealLabels.showLabel}
          hideLabel={input.hideLabel ?? revealLabels.hideLabel}
          value={field.state.value ?? ""}
          onBlur={field.handleBlur}
          onChangeText={(text) => field.handleChange(text)}
        />
      }
    />
  );
}

/** What the list of a `SelectField` holds: the options, and the rules between them. */
type SelectFieldEntry = SelectOption | SelectSeparatorEntry;

type SelectFieldProps = BoundFieldProps & {
  /**
   * The choices, in the order they are drawn. An option's `group` puts it under that heading, and
   * `{ separator: true }` rules a line across the list: the list the web `SelectField` takes,
   * minus its notes, which need `ComboboxField`.
   */
  options: readonly SelectFieldEntry[];
  placeholder?: string;
  /** The trigger will not open: a list with nothing in it yet, a choice another field decides. */
  disabled?: boolean | undefined;
  /**
   * Adds a first row for "nothing", which writes `null`. The field then holds `string | null`,
   * and reads `null`, `undefined` and `""` as that row.
   */
  clearable?: boolean | undefined;
  /**
   * What the row for "nothing" says. Read only when `clearable`.
   *
   * @defaultValue `"None"`
   */
  emptyLabel?: string | undefined;
};

type SelectControlProps = Pick<
  SelectFieldProps,
  "options" | "placeholder" | "disabled" | "clearable" | "emptyLabel"
> &
  Omit<React.ComponentProps<typeof SelectTrigger>, "children" | "onBlur" | "disabled">;

/**
 * The select as one control, so the wiring `FieldControl` hands down lands on the trigger. The
 * root renders no element on either platform: handed the `id` and the `aria-*` props it drops
 * them, leaving a trigger the label does not name and an error message nothing points at.
 */
function SelectControl({
  options,
  placeholder,
  disabled,
  clearable = false,
  emptyLabel = "None",
  ...wired
}: SelectControlProps) {
  const field = useFieldContext<string | null>();
  const entries = React.useMemo(
    () => (clearable ? withEmptyOption(options, emptyLabel) : options),
    [options, clearable, emptyLabel],
  );
  const blocks = React.useMemo(() => blocksOf(entries), [entries]);
  const value = clearable ? menuValueOf(field.state.value) : (field.state.value ?? "");
  const chosen = entries.find(
    (entry): entry is SelectOption => "value" in entry && entry.value === value,
  );
  return (
    <Select
      value={value}
      onValueChange={(next) => field.handleChange(clearable ? storedValueOf(next) : next)}
      disabled={disabled}
    >
      <SelectTrigger {...wired} onBlur={field.handleBlur}>
        <SelectValue placeholder={placeholder}>{chosen?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {blocks.map((block, index) => {
          if (isSeparator(block)) {
            // biome-ignore lint/suspicious/noArrayIndexKey: a rule has no identity of its own
            return <SelectSeparator key={`block-${index}`} />;
          }
          // The list's type holds no note, so this only tells the compiler what is left.
          if (isNote(block)) {
            return null;
          }
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: nor does a repeated heading
            <SelectGroup key={`block-${index}`}>
              {block.group ? <SelectLabel>{block.group}</SelectLabel> : null}
              {block.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className={option.className}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** A select bound to a form field holding one of the options' values. */
function SelectField(props: SelectFieldProps) {
  const [fieldProps, control] = splitProps(props);
  return <FieldWrapper {...fieldProps} controlSlot={<SelectControl {...control} />} />;
}

type CheckboxFieldProps = Omit<BoundFieldProps, "label"> & {
  /** A string, because it is also the box's `accessibilityLabel`: device has no `htmlFor`. */
  label: string;
} & Omit<
    React.ComponentProps<typeof Checkbox>,
    "checked" | "defaultChecked" | "onCheckedChange" | "onBlur" | "accessibilityLabel"
  >;

/** A checkbox and its caption. Horizontal by default: a 16px box is not a row of its own. */
function CheckboxField(props: CheckboxFieldProps) {
  const [fieldProps, checkbox] = splitProps(props);
  const field = useFieldContext<boolean>();

  return (
    <FieldWrapper
      orientation="horizontal"
      {...fieldProps}
      controlSlot={
        <Checkbox
          {...checkbox}
          accessibilityLabel={props.label}
          checked={field.state.value ?? false}
          onBlur={field.handleBlur}
          onCheckedChange={(checked) => {
            field.handleChange(checked === true);
            // A press is the whole interaction, and a `Pressable` on device is never blurred —
            // so nothing else would mark the field touched.
            field.handleBlur();
          }}
        />
      }
    />
  );
}

type SwitchFieldProps = Omit<BoundFieldProps, "label"> & {
  /** A string, because it is also the switch's `accessibilityLabel`: device has no `htmlFor`. */
  label: string;
} & Omit<
    React.ComponentProps<typeof Switch>,
    "id" | "checked" | "defaultChecked" | "onCheckedChange" | "onBlur" | "accessibilityLabel"
  >;

/**
 * A switch and its caption, bound to a boolean. Not `@cubeui/switch-field`, which is the unbound
 * row of the same name; this one is the web `app-form`'s `SwitchField`.
 */
function SwitchField(props: SwitchFieldProps) {
  const [fieldProps, control] = splitProps(props);
  const field = useFieldContext<boolean>();

  return (
    <FieldWrapper
      orientation="horizontal"
      {...fieldProps}
      controlSlot={
        <Switch
          {...control}
          accessibilityLabel={props.label}
          checked={field.state.value ?? false}
          onBlur={field.handleBlur}
          onCheckedChange={(checked) => {
            field.handleChange(checked);
            field.handleBlur();
          }}
        />
      }
    />
  );
}

type SubmitButtonProps = {
  isEdit?: boolean;
  createLabel?: string;
  editLabel?: string;
  savingLabel?: string;
  /** Leading glyph, e.g. `<Plus className="mr-1 h-4 w-4" />`. */
  iconSlot?: SlotNode;
  /**
   * A third reason not to submit, OR-ed with `!canSubmit` and `isSubmitting` — a mutation in
   * flight elsewhere. It only ever tightens the guard: `disabled={false}` never enables an invalid
   * form. A form that is valid but unchanged is `requireChanges`.
   */
  disabled?: boolean | undefined;
  /**
   * Disabled while every value is still its default, for an edit form whose Save means nothing
   * until something changes. Read from the store's `isDefaultValue`, not `isDirty`, so a value
   * typed and typed back disables it again. Off by default: a create form, or one replaying what
   * is already in the box, is right to submit untouched.
   */
  requireChanges?: boolean | undefined;
} & ButtonPropsWithout<"disabled" | "content" | "loading" | "loadingLabel">;

/**
 * The submit control: reads `canSubmit` / `isSubmitting` from form context, so
 * every form guards against a double submit the same way rather than each one
 * remembering to.
 */
function SubmitButton({
  isEdit = false,
  createLabel = "Create",
  editLabel = "Save changes",
  savingLabel = "Saving…",
  iconSlot,
  disabled,
  requireChanges = false,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const untouched = useStore(form.store, (s) => s.isDefaultValue);

  // A `Pressable` is not a form control, so it never raises the DOM submit event
  // `<Form>` listens for — it has to call `handleSubmit` itself. Enter inside a
  // field still goes through `<form onSubmit>`, and because pressing this button
  // is not a submit, the two cannot both fire for one press.
  //
  // `disabled` goes after the spread, so nothing spread in can land on the store's answer.
  return (
    <Button
      onPress={() => {
        form.handleSubmit();
      }}
      {...props}
      disabled={disabled === true || canSubmit === false || (requireChanges && untouched)}
      loading={isSubmitting}
      loadingLabel={savingLabel}
      iconSlot={iconSlot}
      content={isEdit ? editLabel : createLabel}
    />
  );
}

/**
 * The fields `useAppForm` hangs off `field.*`. `TextareaField` is the web half's spelling of
 * `TextAreaField`, so a call site written against either reads on both.
 */
const FIELD_COMPONENTS = {
  InputField,
  NumberField,
  TextAreaField,
  TextareaField: TextAreaField,
  PasswordField,
  SelectField,
  CheckboxField,
  SwitchField,
};

/**
 * A `useAppForm` with more on `field.*` than this file ships — the date and colour fields, which
 * are their own items, or one of the app's own:
 *
 * ```tsx
 * export const { useAppForm, withForm } = createAppForm({ DateTimeField, ColorField });
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: TanStack's own constraint on `fieldComponents`; a field's props are its own business
function createAppForm<TFields extends Record<string, ComponentType<any>>>(fields: TFields) {
  return createFormHook({
    fieldContext,
    formContext,
    fieldComponents: { ...FIELD_COMPONENTS, ...fields },
    formComponents: { SubmitButton },
  });
}

/**
 * `useAppForm` — the hook a form calls, with the fields above on `field.*` and `SubmitButton` on
 * the form. The web `app-form`'s, by name and by shape.
 *
 * ```tsx
 * const form = useAppForm({ defaultValues: { title: "" }, onSubmit: ({ value }) => save(value) });
 *
 * <form.AppForm>
 *   <Form>
 *     <form.AppField name="title">{(field) => <field.InputField label="Title" />}</form.AppField>
 *     <form.SubmitButton />
 *   </Form>
 * </form.AppForm>
 * ```
 */
const { useAppForm, withForm } = createAppForm({});

/**
 * Writes the render prop once: a field component as one line, over a form and a name. The web
 * `app-form`'s, under the same name.
 *
 * ```tsx
 * const DueField = bindToForm<ComponentProps<typeof DateTimeField>, Date>(DateTimeField, "DueField");
 *
 * <DueField form={form} name="dueAt" label="Due" mode="date" clearable />
 * ```
 *
 * `TValue` narrows the names it accepts, so a date field over a string is a type error.
 */
function bindToForm<TProps extends object, TValue = unknown>(
  Bound: ComponentType<TProps>,
  displayName: string,
): <TForm extends BindableForm, TName extends NamesOfType<ValuesOf<TForm>, TValue>>(
  props: TProps & FormBinding<TForm, TName>,
) => ReactNode {
  function FormBoundField<TForm extends BindableForm, TName extends DeepKeys<ValuesOf<TForm>>>({
    form,
    name,
    validators,
    asyncDebounceMs,
    listeners,
    ...rest
  }: TProps & FormBinding<TForm, TName>) {
    const Subscribe = fieldOf(form);
    return (
      <Subscribe
        name={name}
        validators={validators}
        asyncDebounceMs={asyncDebounceMs}
        listeners={listeners}
      >
        {(field) => (
          <fieldContext.Provider value={field}>
            <Bound {...(rest as TProps)} />
          </fieldContext.Provider>
        )}
      </Subscribe>
    );
  }
  FormBoundField.displayName = displayName;
  return FormBoundField;
}

export type { BoundFieldProps as FieldProps, SelectFieldEntry, SelectOption, SelectSeparatorEntry };
export {
  bindToForm,
  CheckboxField,
  createAppForm,
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRow,
  FieldWrapper,
  Form,
  InputField,
  NumberField,
  PasswordField,
  SelectField,
  SubmitButton,
  SwitchField,
  splitProps,
  TextAreaField,
  useAppForm,
  useFieldError,
  useFieldIds,
  withForm,
};
