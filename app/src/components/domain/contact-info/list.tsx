import { useMutation } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { ContactInfo_ListFragment } from '@/__generated__/graphql';
import { ContactTypeEnum } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { Globe, Mail, Phone, Share2, Smartphone } from '@/components/app-icons';
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
    $value: String!
    $label: String
    $isPrimary: Boolean
  ) {
    createContactInfo(
      values: {
        personId: $personId
        type: $type
        value: $value
        label: $label
        isPrimary: $isPrimary
      }
    ) {
      id
      personId
      type
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

const CONTACT_TYPE_OPTIONS: Array<{ value: ContactTypeEnum; label: string }> = [
  { value: ContactTypeEnum.Email, label: 'Email' },
  { value: ContactTypeEnum.Phone, label: 'Phone' },
  { value: ContactTypeEnum.Mobile, label: 'Mobile' },
  { value: ContactTypeEnum.Linkedin, label: 'LinkedIn' },
  { value: ContactTypeEnum.Twitter, label: 'Twitter' },
  { value: ContactTypeEnum.Instagram, label: 'Instagram' },
  { value: ContactTypeEnum.Website, label: 'Website' },
  { value: ContactTypeEnum.Other, label: 'Other' },
];

const CONTACT_TYPE_PLACEHOLDERS: Record<ContactTypeEnum, string> = {
  [ContactTypeEnum.Email]: 'name@example.com',
  [ContactTypeEnum.Phone]: '+1 (555) 000-0000',
  [ContactTypeEnum.Mobile]: '+1 (555) 000-0000',
  [ContactTypeEnum.Linkedin]: 'https://linkedin.com/in/username',
  [ContactTypeEnum.Twitter]: '@username',
  [ContactTypeEnum.Instagram]: '@username',
  [ContactTypeEnum.Website]: 'https://example.com',
  [ContactTypeEnum.Other]: 'Contact value',
};

/** A phone number as a `tel:` link, without its spaces and punctuation. */
function telHref(phoneNumber: string): string {
  return `tel:${phoneNumber.replace(/[^\d+]/g, '')}`;
}

/** A handle as a link to its profile under `profileBase`; a value that is already a URL is kept. */
function profileHref(profileBase: string, handle: string): string {
  const isUrl = handle.startsWith('http');
  return isUrl ? handle : `${profileBase}${handle.replace(/^@/, '')}`;
}

/** A site as a link; a value that is already a URL is kept. */
function websiteHref(site: string): string {
  const isUrl = site.startsWith('http');
  return isUrl ? site : `https://${site}`;
}

/** What turns a trimmed value of each contact type into its href. `other` has nothing to open. */
const CONTACT_HREF_BUILDERS: Record<string, (value: string) => string | null> = {
  [ContactTypeEnum.Email]: (address) => `mailto:${address}`,
  [ContactTypeEnum.Phone]: telHref,
  [ContactTypeEnum.Mobile]: telHref,
  [ContactTypeEnum.Linkedin]: (handle) => profileHref('https://linkedin.com/in/', handle),
  [ContactTypeEnum.Twitter]: (handle) => profileHref('https://x.com/', handle),
  [ContactTypeEnum.Instagram]: (handle) => profileHref('https://instagram.com/', handle),
  [ContactTypeEnum.Website]: websiteHref,
  [ContactTypeEnum.Other]: () => null,
} satisfies Record<ContactTypeEnum, (value: string) => string | null>;

/** Actionable href for a contact value — tap to call/text/email/open. */
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
  [ContactTypeEnum.Mobile]: Smartphone,
  [ContactTypeEnum.Linkedin]: Share2,
  [ContactTypeEnum.Twitter]: Share2,
  [ContactTypeEnum.Instagram]: Share2,
  [ContactTypeEnum.Website]: Globe,
  [ContactTypeEnum.Other]: Ellipsis,
} satisfies Record<ContactTypeEnum, typeof Ellipsis>;

function ContactTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = CONTACT_TYPE_ICONS[type] ?? Ellipsis;
  return <Icon className={className} />;
}

export interface ContactInfoListProps {
  person: ContactInfo_ListFragment;
  onAdd: () => void;
  onDelete: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

interface ContactInfoRowProps {
  id: string;
  type: string;
  value: string;
  label: string | null | undefined;
  isPrimary: boolean;
  onDelete: () => void;
}

function ContactInfoRow({ id, type, value, label, isPrimary, onDelete }: ContactInfoRowProps) {
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

interface ContactInfoFields {
  type: ContactTypeEnum;
  value: string;
  label: string;
  isPrimary: boolean;
}

const EMPTY_CONTACT_INFO: ContactInfoFields = {
  type: ContactTypeEnum.Email,
  value: '',
  label: '',
  isPrimary: false,
};

interface AddContactInfoDialogProps {
  personId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

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
          <form.AppField name="label">
            {(field) => <field.InputField label="Label" description="Optional" placeholder="e.g. Work, Personal" />}
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
