import { useMutation } from '@apollo/client';
import {
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MoreHorizontal,
  Phone,
  Smartphone,
  Star,
  Trash2,
  Twitter,
} from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import type { ContactInfo_ListFragment } from '@/__generated__/graphql.js';
import { ContactInfosTypeEnum } from '@/__generated__/graphql.js';
import { Button } from '@/components/ui/button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_CONTACT_INFO = graphql(`
  mutation CreateContactInfo(
    $personId: String!
    $type: ContactInfosTypeEnum!
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
  mutation DeleteContactInfo($id: String!) {
    deleteContactInfos(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Contact type helpers
// ---------------------------------------------------------------------------

const CONTACT_TYPE_OPTIONS: Array<{ value: ContactInfosTypeEnum; label: string }> = [
  { value: ContactInfosTypeEnum.Email, label: 'Email' },
  { value: ContactInfosTypeEnum.Phone, label: 'Phone' },
  { value: ContactInfosTypeEnum.Mobile, label: 'Mobile' },
  { value: ContactInfosTypeEnum.Linkedin, label: 'LinkedIn' },
  { value: ContactInfosTypeEnum.Twitter, label: 'Twitter' },
  { value: ContactInfosTypeEnum.Instagram, label: 'Instagram' },
  { value: ContactInfosTypeEnum.Website, label: 'Website' },
  { value: ContactInfosTypeEnum.Other, label: 'Other' },
];

const CONTACT_TYPE_PLACEHOLDERS: Record<ContactInfosTypeEnum, string> = {
  [ContactInfosTypeEnum.Email]: 'name@example.com',
  [ContactInfosTypeEnum.Phone]: '+1 (555) 000-0000',
  [ContactInfosTypeEnum.Mobile]: '+1 (555) 000-0000',
  [ContactInfosTypeEnum.Linkedin]: 'https://linkedin.com/in/username',
  [ContactInfosTypeEnum.Twitter]: '@username',
  [ContactInfosTypeEnum.Instagram]: '@username',
  [ContactInfosTypeEnum.Website]: 'https://example.com',
  [ContactInfosTypeEnum.Other]: 'Contact value',
};

function ContactTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type as ContactInfosTypeEnum) {
    case ContactInfosTypeEnum.Email:
      return <Mail className={className} />;
    case ContactInfosTypeEnum.Phone:
      return <Phone className={className} />;
    case ContactInfosTypeEnum.Mobile:
      return <Smartphone className={className} />;
    case ContactInfosTypeEnum.Linkedin:
      return <Linkedin className={className} />;
    case ContactInfosTypeEnum.Twitter:
      return <Twitter className={className} />;
    case ContactInfosTypeEnum.Instagram:
      return <Instagram className={className} />;
    case ContactInfosTypeEnum.Website:
      return <Globe className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactInfoListProps {
  person: ContactInfo_ListFragment;
  onAdd: () => void;
  onDelete: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// ContactInfoRow
// ---------------------------------------------------------------------------

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

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ContactTypeIcon type={type} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
              {typeLabel}
            </span>
            {label && <span className="text-xs text-muted-foreground">{label}</span>}
            {isPrimary && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Star className="h-2.5 w-2.5" />
                Primary
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Delete contact info"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add contact info form
// ---------------------------------------------------------------------------

interface AddContactInfoFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function AddContactInfoForm({ personId, onAdded, onCancel }: AddContactInfoFormProps) {
  const [type, setType] = useState<ContactInfosTypeEnum>(ContactInfosTypeEnum.Email);
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [createContactInfo] = useMutation(CREATE_CONTACT_INFO);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await createContactInfo({
        variables: {
          personId,
          type,
          value: value.trim(),
          label: label.trim() || null,
          isPrimary,
        },
      });
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type */}
      <div className="space-y-1.5">
        <label htmlFor="contact-type" className="text-sm font-medium">
          Type
        </label>
        <select
          id="contact-type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as ContactInfosTypeEnum);
            setValue('');
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CONTACT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value */}
      <div className="space-y-1.5">
        <label htmlFor="contact-value" className="text-sm font-medium">
          Value
        </label>
        <input
          id="contact-value"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={CONTACT_TYPE_PLACEHOLDERS[type]}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <label htmlFor="contact-label" className="text-sm font-medium">
          Label <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="contact-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Work, Personal"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Primary */}
      <div className="flex items-center gap-2">
        <input
          id="contact-is-primary"
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor="contact-is-primary" className="text-sm">
          Mark as primary
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !value.trim()}>
          {submitting ? 'Saving...' : 'Add Contact Info'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ContactInfoList({ person, onAdd, onDelete, createOpen, onCreateOpenChange }: ContactInfoListProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = createOpen ?? internalOpen;
  const setDialogOpen = onCreateOpenChange ?? setInternalOpen;
  const contactInfos = person.contactInfos ?? [];

  return (
    <div className="space-y-2">
      {contactInfos.length === 0 && <p className="text-muted-foreground text-sm">No contact info yet.</p>}

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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact Info</DialogTitle>
          </DialogHeader>
          <AddContactInfoForm
            personId={person.id}
            onAdded={() => {
              setDialogOpen(false);
              onAdd();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
