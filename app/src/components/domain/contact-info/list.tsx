import { useMutation } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { ContactInfo_ListFragment } from '@/__generated__/graphql';
import { ContactInfosKindEnum, ContactTypeEnum } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { Globe, Mail, MessageSquare, Phone, Printer, Share2 } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Ellipsis, Trash2 } from '@/components/ui/icons';

export const CONTACT_INFO_LIST_FRAGMENT = graphql(`
  fragment ContactInfo_List on Person {
    id
    contactInfos {
      id
      type
      kind
      value
      label
      isPrimary
    }
  }
`);

const CREATE_CONTACT_INFO = graphql(`
  mutation CreateContactInfo(
    $personId: UUID!
    $type: ContactTypeEnum!
    $kind: ContactInfosKindEnum
    $value: String!
    $label: String
    $isPrimary: Boolean
  ) {
    createContactInfo(
      values: {
        personId: $personId
        type: $type
        kind: $kind
        value: $value
        label: $label
        isPrimary: $isPrimary
      }
    ) {
      id
      personId
      type
      kind
      value
      label
      isPrimary
    }
  }
`);

const DELETE_CONTACT_INFO = graphql(`
  mutation DeleteContactInfo($id: UUID!) {
    deleteContactInfo(where: { id: { eq: $id } }) {
      id
    }
  }
`);

/** The contact types as select options, in the order offered. */
const CONTACT_TYPE_OPTIONS: Array<{ value: ContactTypeEnum; label: string }> = [
  { value: ContactTypeEnum.Email, label: 'Email' },
  { value: ContactTypeEnum.Phone, label: 'Phone' },
  { value: ContactTypeEnum.Fax, label: 'Fax' },
  { value: ContactTypeEnum.Im, label: 'Messaging' },
  { value: ContactTypeEnum.Linkedin, label: 'LinkedIn' },
  { value: ContactTypeEnum.Twitter, label: 'Twitter' },
  { value: ContactTypeEnum.Instagram, label: 'Instagram' },
  { value: ContactTypeEnum.Website, label: 'Website' },
  { value: ContactTypeEnum.Other, label: 'Other' },
];

/** The select's value for "no kind". A select cannot hold an empty string, and the API takes null. */
const NO_KIND = 'none';

/** Where a contact value reaches the person, as select options. The first leaves it unsaid. */
const CONTACT_KIND_OPTIONS: Array<{ value: ContactInfosKindEnum | typeof NO_KIND; label: string }> = [
  { value: NO_KIND, label: 'Not set' },
  { value: ContactInfosKindEnum.Mobile, label: 'Mobile' },
  { value: ContactInfosKindEnum.Home, label: 'Home' },
  { value: ContactInfosKindEnum.Work, label: 'Work' },
  { value: ContactInfosKindEnum.Other, label: 'Other' },
];

/** The name shown for each kind. */
const CONTACT_KIND_LABELS: Record<ContactInfosKindEnum, string> = {
  [ContactInfosKindEnum.Mobile]: 'Mobile',
  [ContactInfosKindEnum.Home]: 'Home',
  [ContactInfosKindEnum.Work]: 'Work',
  [ContactInfosKindEnum.Other]: 'Other',
};

/** An example value for each contact type, shown as the value field's placeholder. */
const CONTACT_TYPE_PLACEHOLDERS: Record<ContactTypeEnum, string> = {
  [ContactTypeEnum.Email]: 'name@example.com',
  [ContactTypeEnum.Phone]: '+1 (555) 000-0000',
  [ContactTypeEnum.Fax]: '+1 (555) 000-0000',
  [ContactTypeEnum.Im]: 'Handle or address',
  [ContactTypeEnum.Linkedin]: 'https://linkedin.com/in/username',
  [ContactTypeEnum.Twitter]: '@username',
  [ContactTypeEnum.Instagram]: '@username',
  [ContactTypeEnum.Website]: 'https://example.com',
  [ContactTypeEnum.Other]: 'Contact value',
};

/**
 * A phone number as a `tel:` link, without its spaces and punctuation.
 *
 * @param phoneNumber - The number as typed; only its digits and `+` are kept.
 * @returns The `tel:` href.
 */
function telHref(phoneNumber: string): string {
  return `tel:${phoneNumber.replace(/[^\d+]/g, '')}`;
}

/**
 * A handle as a link to its profile under `profileBase`; a value that is already a URL is kept.
 *
 * @param profileBase - The network's profile URL up to the handle, ending in `/`.
 * @param handle - The handle, with or without its leading `@`, or a full URL.
 * @returns The profile URL.
 */
function profileHref(profileBase: string, handle: string): string {
  const isUrl = handle.startsWith('http');
  return isUrl ? handle : `${profileBase}${handle.replace(/^@/, '')}`;
}

/**
 * A site as a link; a value that is already a URL is kept.
 *
 * @param site - A bare domain or a full URL.
 * @returns The URL, with `https://` put in front of a bare domain.
 */
function websiteHref(site: string): string {
  const isUrl = site.startsWith('http');
  return isUrl ? site : `https://${site}`;
}

/** What turns a trimmed value of each contact type into its href. */
const CONTACT_HREF_BUILDERS: Record<string, (value: string) => string | null> = {
  [ContactTypeEnum.Email]: (address) => `mailto:${address}`,
  [ContactTypeEnum.Phone]: telHref,
  // A fax number and a messaging handle have nothing a phone or browser opens.
  [ContactTypeEnum.Fax]: () => null,
  [ContactTypeEnum.Im]: () => null,
  [ContactTypeEnum.Linkedin]: (handle) => profileHref('https://linkedin.com/in/', handle),
  [ContactTypeEnum.Twitter]: (handle) => profileHref('https://x.com/', handle),
  [ContactTypeEnum.Instagram]: (handle) => profileHref('https://instagram.com/', handle),
  [ContactTypeEnum.Website]: websiteHref,
  [ContactTypeEnum.Other]: () => null,
} satisfies Record<ContactTypeEnum, (value: string) => string | null>;

/**
 * Actionable href for a contact value — tap to call/text/email/open.
 *
 * @param type - The contact type, one of the `ContactTypeEnum` values.
 * @param value - The contact value as stored; it is trimmed before use.
 * @returns The href, or `null` when the type has nothing to open or is not a known one.
 */
export function contactHref(type: string, value: string): string | null {
  const buildHref = CONTACT_HREF_BUILDERS[type];
  if (!buildHref) {
    return null;
  }
  return buildHref(value.trim());
}

/** The glyph for each contact type. lucide dropped its brand glyphs, so the three networks share one. */
const CONTACT_TYPE_ICONS: Record<string, typeof Ellipsis> = {
  [ContactTypeEnum.Email]: Mail,
  [ContactTypeEnum.Phone]: Phone,
  [ContactTypeEnum.Fax]: Printer,
  [ContactTypeEnum.Im]: MessageSquare,
  [ContactTypeEnum.Linkedin]: Share2,
  [ContactTypeEnum.Twitter]: Share2,
  [ContactTypeEnum.Instagram]: Share2,
  [ContactTypeEnum.Website]: Globe,
  [ContactTypeEnum.Other]: Ellipsis,
} satisfies Record<ContactTypeEnum, typeof Ellipsis>;

/** The glyph for a contact type; anything unrecognised gets the ellipsis. */
function ContactTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = CONTACT_TYPE_ICONS[type] ?? Ellipsis;
  return <Icon className={className} />;
}

export interface ContactInfoListProps {
  /** The person whose contact values are listed. */
  person: ContactInfo_ListFragment;
  /** Called after a contact value is added. */
  onAdd: () => void;
  /** Called after a contact value is deleted. */
  onDelete: () => void;
  /** Whether the add dialog is open, when the owner holds that state; left out, the list holds it. */
  createOpen?: boolean;
  /** Receives the add dialog's open state when the owner holds it. */
  onCreateOpenChange?: (open: boolean) => void;
}

interface ContactInfoRowProps {
  id: string;
  /** The contact type, one of the `ContactTypeEnum` values; it picks the glyph and what a press opens. */
  type: string;
  value: string;
  /** Where the value reaches the person: home, work, mobile or other. Shown as a badge when set. */
  kind: ContactInfosKindEnum | null | undefined;
  /** The user's own name for the value, such as Assistant; shown under it. */
  label: string | null | undefined;
  isPrimary: boolean;
  /** Called after the contact value is deleted. */
  onDelete: () => void;
}

/** One contact value with its type and primary badges. Pressing the row calls, mails or opens the value. */
function ContactInfoRow({ id, type, kind, value, label, isPrimary, onDelete }: ContactInfoRowProps) {
  const [deleteContactInfo] = useMutation(DELETE_CONTACT_INFO);

  const handleDelete = async () => {
    await deleteContactInfo({ variables: { id } });
    onDelete();
  };

  const typeLabel = CONTACT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  const href = contactHref(type, value);

  return (
    <ListItem
      className="border border-foreground/10"
      leadingSlot={<ContactTypeIcon type={type} className="h-4 w-4 text-foreground/60" />}
      title={value}
      titleClassName={href ? 'text-info' : undefined}
      description={label || undefined}
      meta={
        <>
          <Badge variant="secondary">{typeLabel}</Badge>
          {kind ? <Badge variant="outline">{CONTACT_KIND_LABELS[kind]}</Badge> : null}
          {isPrimary ? <Badge variant="warning">Primary</Badge> : null}
        </>
      }
      // Pressing the row calls, mails or opens the value.
      onPress={href ? () => void Linking.openURL(href) : undefined}
      actionSlot={
        <ConfirmButton
          variant="ghost"
          size="icon-sm"
          label="Delete contact info"
          title="Delete this contact info?"
          description={`${typeLabel} ${value} is removed from this person.`}
          onConfirm={handleDelete}
          iconSlot={<Trash2 className="h-4 w-4" />}
        />
      }
    />
  );
}

/** The add-contact-info form's values. */
interface ContactInfoFields {
  type: ContactTypeEnum;
  kind: ContactInfosKindEnum | typeof NO_KIND;
  value: string;
  label: string;
  isPrimary: boolean;
}

/** A blank contact info form; the type starts as email. */
const EMPTY_CONTACT_INFO: ContactInfoFields = {
  type: ContactTypeEnum.Email,
  kind: NO_KIND,
  value: '',
  label: '',
  isPrimary: false,
};

interface AddContactInfoDialogProps {
  /** The person the contact value is added to. */
  personId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the contact value is saved and the dialog has been told to close. */
  onAdded: () => void;
}

/** The dialog that adds one contact value to a person. Changing the type clears the value typed so far. */
function AddContactInfoDialog({ personId, open, onOpenChange, onAdded }: AddContactInfoDialogProps) {
  const [createContactInfo, { error, reset }] = useMutation(CREATE_CONTACT_INFO);

  const form = useAppForm({
    defaultValues: EMPTY_CONTACT_INFO,
    onSubmit: async ({ value }) => {
      try {
        await createContactInfo({
          variables: {
            personId,
            type: value.type,
            kind: value.kind === NO_KIND ? null : value.kind,
            value: value.value.trim(),
            label: value.label.trim() || null,
            isPrimary: value.isPrimary,
          },
        });
      } catch {
        // Stay open with what was typed; the footer shows the mutation's error.
        return;
      }
      onOpenChange(false);
      onAdded();
    },
  });

  useEffect(() => {
    const isClosed = open === false;
    if (isClosed) {
      return;
    }
    form.reset(EMPTY_CONTACT_INFO);
    reset();
  }, [open, form, reset]);

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add Contact Info">
      <form.AppForm>
        <Form className="gap-4">
          <form.AppField
            name="type"
            // An email typed so far is not a phone number: a new type starts the value over.
            listeners={{ onChange: () => form.setFieldValue('value', '') }}
          >
            {(field) => <field.SelectField label="Type" options={CONTACT_TYPE_OPTIONS} />}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.type}>
            {(type) => (
              <form.AppField
                name="value"
                validators={{ onChange: ({ value }) => (value.trim() ? undefined : 'A value is required.') }}
              >
                {(field) => <field.InputField label="Value" required placeholder={CONTACT_TYPE_PLACEHOLDERS[type]} />}
              </form.AppField>
            )}
          </form.Subscribe>
          <form.AppField name="kind">
            {(field) => <field.SelectField label="Kind" options={CONTACT_KIND_OPTIONS} />}
          </form.AppField>
          <form.AppField name="label">
            {(field) => (
              <field.InputField label="Label" description="Optional" placeholder="e.g. Assistant, Front desk" />
            )}
          </form.AppField>
          <form.AppField name="isPrimary">{(field) => <field.CheckboxField label="Mark as primary" />}</form.AppField>
          <FormDialogFooter onCancel={() => onOpenChange(false)} error={error?.message ?? null}>
            <form.SubmitButton createLabel="Add Contact Info" savingLabel="Saving..." />
          </FormDialogFooter>
        </Form>
      </form.AppForm>
    </FormDialog>
  );
}

/** A person's contact values and the dialog that adds one. */
export function ContactInfoList({ person, onAdd, onDelete, createOpen, onCreateOpenChange }: ContactInfoListProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = createOpen ?? internalOpen;
  const setDialogOpen = onCreateOpenChange ?? setInternalOpen;
  const contactInfos = person.contactInfos ?? [];

  return (
    <>
      <View className="gap-2">
        {contactInfos.length === 0 ? <EmptyState compact title="No contact info yet." /> : null}

        {contactInfos.map((info) => (
          <ContactInfoRow
            key={info.id}
            id={info.id}
            type={info.type}
            kind={info.kind}
            value={info.value}
            label={info.label}
            isPrimary={info.isPrimary}
            onDelete={onDelete}
          />
        ))}
      </View>

      <AddContactInfoDialog personId={person.id} open={dialogOpen} onOpenChange={setDialogOpen} onAdded={onAdd} />
    </>
  );
}
