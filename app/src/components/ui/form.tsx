import type { AnyFieldApi, DeepKeys, DeepValue } from '@tanstack/react-form';
import { createFormHook, createFormHookContexts, useStore } from '@tanstack/react-form';
import { Slot } from 'radix-ui';
import type { ComponentType, ReactNode } from 'react';
import * as React from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FieldContent,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldLabel as FieldLabelPrimitive,
  Field as FieldPrimitive,
} from '@/components/ui/field';
import { FormElement } from '@/components/ui/form-element';
import type { FormElementProps } from '@/components/ui/form-element-base';
import { Input } from '@/components/ui/input';
import type { InputProps } from '@/components/ui/input-base';
import type { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { TextareaProps } from '@/components/ui/textarea-base';
import { cn, type SlotNode } from '@/lib/utils';

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

/**
 * Per-field unique ID, so the `id`s below are derived rather than passed — and whether the label
 * names the control by `htmlFor` or the control points back at it by `aria-labelledby`.
 */
const IdContext = React.createContext<{ id: string; asGroup: boolean } | null>(null);

function messageOf(error: unknown): string | undefined {
  // A validator may yield a string, a `{ message }`, or something else entirely — a
  // standard-schema issue, a thrown value. Narrow, then fall back to `String`, because showing
  // the wrong text beats showing none.
  if (error == null) return undefined;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

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
  if (!isTouched && submissionAttempts === 0) return undefined;
  return messageOf(errors[0]);
}

/**
 * The ids of the field's parts, for a control with a second element to name. `ColorField`'s
 * swatch row points back at `labelId`: the label names the hex box by `htmlFor`, and a `<label>`
 * cannot also name a `radiogroup`.
 */
function useFieldIds() {
  const context = React.useContext(IdContext);
  if (!context) throw new Error('Form field components must be used within <Field>');
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
function Form({ className, children }: Omit<FormElementProps, 'onSubmit'>) {
  const form = useFormContext();
  return (
    <FormElement
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
function FieldControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { controlId, labelId, descriptionId, messageId, hasError, asGroup } = useFieldComponentContext();
  const describedBy = [descriptionId, hasError ? messageId : null].filter(Boolean).join(' ');
  return (
    <Slot.Root
      id={controlId}
      aria-labelledby={asGroup ? labelId : undefined}
      aria-describedby={describedBy || undefined}
      aria-invalid={hasError || undefined}
      {...props}
    />
  );
}

function FieldDescription({ ...props }: React.ComponentProps<typeof FieldDescriptionPrimitive>) {
  const { descriptionId } = useFieldComponentContext();
  return <FieldDescriptionPrimitive id={descriptionId} {...props} />;
}

function FieldError({ ...props }: React.ComponentProps<typeof FieldErrorPrimitive>) {
  const { error, messageId } = useFieldComponentContext();
  if (!error) return null;
  return (
    <FieldErrorPrimitive id={messageId} {...props}>
      {error}
    </FieldErrorPrimitive>
  );
}

/**
 * Fields side by side, two to a row — what `grid grid-cols-2 gap-4` did on web.
 * `grid` has no native equivalent, and the `flex-1` has to sit on each cell
 * rather than on the field, which would then only be laid out correctly inside
 * a row. `min-w-[45%]` is what makes a third field wrap instead of squeezing.
 */
function FieldRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <View className={cn('flex-row flex-wrap gap-4', className)}>
      {React.Children.map(children, (child) =>
        child == null || child === false ? null : <View className="min-w-[45%] flex-1">{child}</View>,
      )}
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
  /** Draws the asterisk and sets `aria-required` on the control. */
  required?: boolean | undefined;
  /** `horizontal` puts the control first and the label beside it: a checkbox, a switch. */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /** See {@link Field}: the label names the control by `aria-labelledby`. */
  asGroup?: boolean | undefined;
  className?: string | undefined;
  labelClassName?: string | undefined;
  descriptionClassName?: string | undefined;
  errorClassName?: string | undefined;
};

/** The keys above, as values, so one flat prop list can be split into field and control. */
const FIELD_KEYS = new Set<string>([
  'label',
  'description',
  'required',
  'orientation',
  'asGroup',
  'className',
  'labelClassName',
  'descriptionClassName',
  'errorClassName',
]);

/**
 * Splits one flat prop list into the half the field draws and the half the control takes — the
 * web `app-form`'s, so a field this file does not ship is written the way these are.
 */
function splitProps<T>(props: BoundFieldProps & T): [BoundFieldProps, T] {
  const field: Record<string, unknown> = {};
  const control: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (FIELD_KEYS.has(key)) field[key] = value;
    else control[key] = value;
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
  required = false,
  orientation = 'vertical',
  asGroup,
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
}: FieldWrapperProps) {
  const title = (
    <FieldLabel className={labelClassName}>
      {label}
      {required ? (
        // Decoration: the name stays "Email", not "Email star". `aria-required` says it instead.
        <Text aria-hidden className="text-negative">
          {' *'}
        </Text>
      ) : null}
    </FieldLabel>
  );
  const wired = <FieldControl aria-required={required || undefined}>{controlSlot}</FieldControl>;
  const rest = (
    <>
      {description ? <FieldDescription className={descriptionClassName}>{description}</FieldDescription> : null}
      <FieldError className={errorClassName} />
    </>
  );

  if (orientation === 'horizontal') {
    return (
      <Field orientation="horizontal" asGroup={asGroup} className={cn('items-start', className)}>
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

type InputFieldProps = BoundFieldProps & Omit<InputProps, 'value' | 'onChangeText' | 'onBlur' | keyof BoundFieldProps>;

/** A text box and the field around it. `className` is the field's, as on every bound field. */
function InputField(props: InputFieldProps) {
  const [fieldProps, input] = splitProps(props);
  // The stored value is whatever the schema says — string, number or null — and
  // this component is generic over all of them, so there is nothing narrower to
  // write here. Both edges are handled explicitly: `String(… ?? "")` going in,
  // and the `type === "number"` branch coming out.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  const field = useFieldContext<any>();

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <Input
          {...input}
          value={String(field.state.value ?? '')}
          onBlur={field.handleBlur}
          onChangeText={(text) => {
            if (input.type === 'number') {
              // `valueAsNumber` is DOM-only; parse the text so native agrees.
              field.handleChange(text === '' ? null : Number(text));
            } else {
              field.handleChange(text);
            }
          }}
        />
      }
    />
  );
}

type TextAreaFieldProps = BoundFieldProps &
  Omit<TextareaProps, 'value' | 'onChangeText' | 'onBlur' | keyof BoundFieldProps>;

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
          value={field.state.value ?? ''}
          onBlur={field.handleBlur}
          onChangeText={(text) => field.handleChange(text)}
        />
      }
    />
  );
}

type SelectOption = {
  label: string;
  value: string;
};

type SelectFieldProps = BoundFieldProps & {
  options: readonly SelectOption[];
  placeholder?: string;
};

function SelectField(props: SelectFieldProps) {
  const [fieldProps, { options, placeholder }] = splitProps(props);
  const field = useFieldContext<string>();

  return (
    <FieldWrapper
      {...fieldProps}
      controlSlot={
        <Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
          <SelectTrigger onBlur={field.handleBlur}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ label: optionLabel, value }) => (
              <SelectItem key={value} value={value}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

type CheckboxFieldProps = Omit<BoundFieldProps, 'label'> & {
  /** A string, because it is also the box's `accessibilityLabel`: device has no `htmlFor`. */
  label: string;
} & Omit<
    React.ComponentProps<typeof Checkbox>,
    'checked' | 'defaultChecked' | 'onCheckedChange' | 'onBlur' | 'accessibilityLabel'
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

type SwitchFieldProps = Omit<BoundFieldProps, 'label'> & {
  /** A string, because it is also the switch's `accessibilityLabel`: device has no `htmlFor`. */
  label: string;
} & Omit<
    React.ComponentProps<typeof Switch>,
    'id' | 'checked' | 'defaultChecked' | 'onCheckedChange' | 'onBlur' | 'accessibilityLabel'
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
   * flight elsewhere, a form that is valid but unchanged. It only ever tightens the guard:
   * `disabled={false}` never enables an invalid form.
   */
  disabled?: boolean | undefined;
} & Omit<React.ComponentProps<typeof Button>, 'disabled' | 'content' | 'loading' | 'loadingLabel'>;

/**
 * The submit control: reads `canSubmit` / `isSubmitting` from form context, so
 * every form guards against a double submit the same way rather than each one
 * remembering to.
 */
function SubmitButton({
  isEdit = false,
  createLabel = 'Create',
  editLabel = 'Save changes',
  savingLabel = 'Saving…',
  iconSlot,
  disabled,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

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
      disabled={disabled === true || !canSubmit}
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
  TextAreaField,
  TextareaField: TextAreaField,
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
 * What a bound field needs off a form, and nothing else — structural, so `bindToForm` works with
 * a plain `useForm` as well as with `useAppForm`.
 */
type BindableForm = {
  state: { values: unknown };
  // Not `=> ReactNode`: TanStack types `Field` as a function component that may return a promise.
  Field: (props: never) => ReactNode | Promise<ReactNode>;
};

type ValuesOf<TForm extends BindableForm> = TForm extends { state: { values: infer TValues } } ? TValues : never;

type Validate<TValue> = (context: { value: TValue; fieldApi: AnyFieldApi; signal: AbortSignal }) => unknown;

type Listen<TValue> = (context: { value: TValue; fieldApi: AnyFieldApi }) => void;

/** The names of the fields holding a `TValue`, `null` allowed. See the web `app-form`. */
type NamesOfType<TValues, TValue> = {
  [TName in DeepKeys<TValues>]: NonNullable<DeepValue<TValues, TName>> extends TValue ? TName : never;
}[DeepKeys<TValues>] &
  DeepKeys<TValues>;

type FormBinding<TForm extends BindableForm, TName extends DeepKeys<ValuesOf<TForm>>> = {
  form: TForm;
  /** A key of the form's values. Checked: `naem` is a type error, not a field that stays empty. */
  name: TName;
  validators?:
    | Partial<
        Record<
          'onMount' | 'onChange' | 'onChangeAsync' | 'onBlur' | 'onBlurAsync' | 'onSubmit' | 'onSubmitAsync',
          Validate<DeepValue<ValuesOf<TForm>, TName>>
        >
      >
    | undefined;
  /** How long to wait before running the async validators, in milliseconds. */
  asyncDebounceMs?: number | undefined;
  listeners?:
    | Partial<
        Record<'onMount' | 'onUnmount' | 'onChange' | 'onBlur' | 'onSubmit', Listen<DeepValue<ValuesOf<TForm>, TName>>>
      >
    | undefined;
};

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
    // The generic `Field` cannot be described without repeating the twenty-odd type parameters
    // already correct on `form`. The cast is here, once, and `name` above is what it protects.
    const Subscribe = form.Field as ComponentType<{
      name: unknown;
      validators?: unknown | undefined;
      asyncDebounceMs?: number | undefined;
      listeners?: unknown | undefined;
      children: (field: AnyFieldApi) => ReactNode;
    }>;
    return (
      <Subscribe name={name} validators={validators} asyncDebounceMs={asyncDebounceMs} listeners={listeners}>
        {(field) => (
          <fieldContext.Provider value={field}>
            <Bound {...(rest as unknown as TProps)} />
          </fieldContext.Provider>
        )}
      </Subscribe>
    );
  }
  FormBoundField.displayName = displayName;
  return FormBoundField;
}

export type { BoundFieldProps as FieldProps };
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
