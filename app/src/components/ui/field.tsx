import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { Platform, Text, View } from 'react-native';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// `className` is re-declared rather than inherited — see `card.tsx`: nativewind types it as
// `className?: string`, which under `exactOptionalPropertyTypes` rejects `cond ? "x" : undefined`.
//
// `id` rides in both: `ui/form.tsx` wires `aria-describedby` from the control to the description
// and the error, so both need to carry one. React Native takes `id` as a cross-platform prop.
type ViewProps = Omit<React.ComponentProps<typeof View>, 'className'> & {
  className?: string | undefined;
};
type TextProps = Omit<React.ComponentProps<typeof Text>, 'className'> & {
  className?: string | undefined;
};

/**
 * A set of fields under one legend. A `<fieldset>` on the web, which is its own group to
 * assistive technology; a `View` with the group role on device.
 */
function FieldSet({ className, ...props }: ViewProps) {
  return (
    <View
      webAs="fieldset"
      role="group"
      testID="field-set"
      className={cn('w-full flex-col gap-6', className)}
      {...props}
    />
  );
}

/**
 * The set's name. `variant="label"` sizes it as a field label rather than a heading, for a set
 * that is one question — a radio group — rather than a section of the form.
 */
function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: TextProps & { variant?: 'legend' | 'label' | undefined }) {
  return (
    <Text
      webAs="legend"
      testID="field-legend"
      className={cn('mb-3 font-medium text-foreground', variant === 'legend' ? 'text-base' : 'text-sm', className)}
      {...props}
    />
  );
}

/**
 * Fields stacked. On the web it is also the container `orientation="responsive"` measures, which
 * is a container query and has no device counterpart.
 */
function FieldGroup({ className, ...props }: ViewProps) {
  return (
    <View
      testID="field-group"
      className={cn(
        'w-full flex-col gap-4',
        Platform.select({ web: '@container/field-group', default: undefined }),
        className,
      )}
      {...props}
    />
  );
}

const fieldVariants = cva('w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-center',
      // Side by side once the enclosing `FieldGroup` is wide enough, stacked below that. A phone
      // is never that wide, and has no container queries to ask with, so it stacks.
      responsive: Platform.select({
        web: 'flex-col @md/field-group:flex-row @md/field-group:items-center',
        default: 'flex-col',
      }),
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

function Field({ className, orientation = 'vertical', ...props }: ViewProps & VariantProps<typeof fieldVariants>) {
  return (
    // The `role` is hand-written because a `<fieldset>` has no native counterpart.
    <View role="group" testID="field" className={cn(fieldVariants({ orientation }), className)} {...props} />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  // `data-slot` rather than `testID`: `Label`'s shared contract has no `testID`, the native half
  // ignores an attribute it does not know, and the web half spreads it over its own `label`.
  return <Label data-slot="field-label" className={className} {...props} />;
}

function FieldDescription({ className, ...props }: TextProps) {
  return <Text testID="field-description" className={cn('text-foreground/60 text-sm', className)} {...props} />;
}

/**
 * What a validator returns, as shadcn's `FieldError` takes it — a TanStack or react-hook-form
 * error object — plus the bare string a hand-rolled validator returns.
 */
type FieldErrorEntry = { message?: string | undefined } | string | null | undefined;

/**
 * The error under a field: its `children`, or else the distinct messages in `errors` — one as a
 * line, several as a list. Nothing at all when there is neither, so it can be rendered
 * unconditionally.
 */
function FieldError({
  className,
  children,
  errors,
  ...props
}: TextProps & { errors?: readonly FieldErrorEntry[] | undefined }) {
  const classes = cn('text-negative text-sm font-medium', className);
  const messages = [
    ...new Set(
      (errors ?? [])
        .map((error) => (typeof error === 'string' ? error : error?.message))
        .filter((message): message is string => Boolean(message)),
    ),
  ];
  const content = children || (messages.length === 1 ? messages[0] : null);
  if (content) {
    return (
      <Text role="alert" testID="field-error" className={classes} {...props}>
        {content}
      </Text>
    );
  }
  if (messages.length === 0) return null;
  return (
    <View role="alert" testID="field-error" id={props.id} className="gap-1">
      <View role="list" className="gap-1">
        {messages.map((message) => (
          <View key={message} role="listitem" className="flex-row gap-2">
            <Text className={classes}>•</Text>
            <Text className={classes}>{message}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The label column of a horizontal field: label, description and error stacked
 * beside the control rather than under it, so a description's second line starts
 * under the label and not under the checkbox.
 */
function FieldContent({ className, ...props }: ViewProps) {
  return <View testID="field-content" className={cn('min-w-0 flex-1 flex-col gap-1.5', className)} {...props} />;
}

/**
 * A field's name where a `<label>` would be wrong — a radio group or a checkbox
 * set, where the name belongs to the group and each control has its own label.
 * Same type as `FieldLabel`, no `htmlFor`: the group is named by
 * `aria-labelledby` pointing at this `id`.
 */
function FieldTitle({ className, ...props }: TextProps) {
  // `field-label`, as shadcn's does: it is the label of its group, and styled as one.
  return <Text testID="field-label" className={cn('text-foreground text-sm font-medium', className)} {...props} />;
}

/**
 * A rule between fields, with an optional word on it — "or", between two ways to sign in.
 */
function FieldSeparator({ className, children, ...props }: ViewProps) {
  return (
    <View testID="field-separator" className={cn('relative h-5 w-full justify-center', className)} {...props}>
      <View className="absolute inset-x-0 top-1/2 h-px bg-foreground/10" />
      {children ? (
        <View testID="field-separator-content" className="items-center">
          <Text className="bg-background px-2 text-foreground/60 text-sm">{children}</Text>
        </View>
      ) : null}
    </View>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
