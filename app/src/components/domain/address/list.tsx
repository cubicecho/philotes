import { useMutation } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { AddressListFragment } from '@/__generated__/graphql';
import { AddressTypeEnum } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { MapPin } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldRow, Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Trash2 } from '@/components/ui/icons';

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

export const ADDRESS_LIST_FRAGMENT = graphql(`
  fragment AddressList on Person {
    id
    addresses {
      id
      type
      label
      line1
      line2
      city
      state
      postalCode
      country
      isPrimary
    }
  }
`);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_ADDRESSES = graphql(`
  mutation CreateAddresses($values: [CreateAddressInput!]!) {
    createAddresses(values: $values) {
      id
      type
      label
      line1
      line2
      city
      state
      postalCode
      country
      isPrimary
    }
  }
`);

const DELETE_ADDRESSES = graphql(`
  mutation DeleteAddresses($id: UUID!) {
    deleteAddress(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddressListProps {
  fragmentRef: AddressListFragment;
  onAdd: () => void;
  onDelete: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

interface AddressData {
  id: string;
  type: AddressTypeEnum;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPrimary: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<AddressTypeEnum, string> = {
  [AddressTypeEnum.Home]: 'Home',
  [AddressTypeEnum.Work]: 'Work',
  [AddressTypeEnum.Other]: 'Other',
};

const TYPE_OPTIONS = [AddressTypeEnum.Home, AddressTypeEnum.Work, AddressTypeEnum.Other].map((value) => ({
  value,
  label: TYPE_LABELS[value],
}));

function cityStateLine(address: AddressData): string {
  return [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
}

function formatAddress(address: AddressData): string {
  const parts: string[] = [address.line1];
  if (address.line2) {
    parts.push(address.line2);
  }
  const cityStateParts = cityStateLine(address);
  if (cityStateParts) {
    parts.push(cityStateParts);
  }
  if (address.country) {
    parts.push(address.country);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Address row
// ---------------------------------------------------------------------------

interface AddressRowProps {
  address: AddressData;
  onDelete: () => void;
}

function AddressRow({ address, onDelete }: AddressRowProps) {
  const [deleteAddress] = useMutation(DELETE_ADDRESSES);

  const handleDelete = async () => {
    await deleteAddress({ variables: { id: address.id } });
    onDelete();
  };

  // Everything under line 1, on the row's one description line.
  const rest = [address.line2, cityStateLine(address), address.country].filter(Boolean).join(' · ');

  return (
    <ListItem
      className="border border-border"
      leadingSlot={<MapPin className="h-4 w-4 text-muted-foreground" />}
      title={address.line1}
      description={rest || undefined}
      meta={
        <>
          {address.label ? <Text className="text-muted-foreground text-xs">{address.label}</Text> : null}
          <Badge variant="secondary">{TYPE_LABELS[address.type]}</Badge>
          {address.isPrimary ? <Badge variant="info">Primary</Badge> : null}
        </>
      }
      actionSlot={
        <>
          <CopyButton variant="ghost" value={formatAddress(address)} label="Copy address to clipboard" />
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            label="Delete address"
            title="Delete this address?"
            description={`${address.line1} is removed from this person.`}
            onConfirm={handleDelete}
            iconSlot={<Trash2 className="h-4 w-4" />}
          />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Add address dialog
// ---------------------------------------------------------------------------

const EMPTY_ADDRESS = {
  type: AddressTypeEnum.Home as string,
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  isPrimary: false,
};

interface AddAddressDialogProps {
  personId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

function AddAddressDialog({ personId, open, onOpenChange, onAdded }: AddAddressDialogProps) {
  const [createAddresses, { error, reset }] = useMutation(CREATE_ADDRESSES);

  const form = useAppForm({
    defaultValues: EMPTY_ADDRESS,
    onSubmit: async ({ value }) => {
      try {
        await createAddresses({
          variables: {
            values: [
              {
                personId,
                type: value.type as AddressTypeEnum,
                label: value.label.trim() || null,
                line1: value.line1.trim(),
                line2: value.line2.trim() || null,
                city: value.city.trim() || null,
                state: value.state.trim() || null,
                postalCode: value.postalCode.trim() || null,
                country: value.country.trim() || null,
                isPrimary: value.isPrimary,
              },
            ],
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
    if (!open) {
      return;
    }
    form.reset(EMPTY_ADDRESS);
    reset();
  }, [open, form, reset]);

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add Address">
      <form.AppForm>
        <Form className="gap-4">
          <form.AppField name="type">
            {(field) => <field.SelectField label="Type" options={TYPE_OPTIONS} />}
          </form.AppField>
          <form.AppField name="label">
            {(field) => <field.InputField label="Label" description="Optional" placeholder="e.g. Parents' house" />}
          </form.AppField>
          <form.AppField
            name="line1"
            validators={{ onChange: ({ value }) => (value.trim() ? undefined : 'Address line 1 is required.') }}
          >
            {(field) => <field.InputField label="Address Line 1" required autoFocus placeholder="123 Main St" />}
          </form.AppField>
          <form.AppField name="line2">
            {(field) => <field.InputField label="Address Line 2" description="Optional" placeholder="Apt 4B" />}
          </form.AppField>
          <FieldRow>
            <form.AppField name="city">{(field) => <field.InputField label="City" placeholder="City" />}</form.AppField>
            <form.AppField name="state">
              {(field) => <field.InputField label="State" placeholder="State" />}
            </form.AppField>
            <form.AppField name="postalCode">
              {(field) => <field.InputField label="Postal Code" placeholder="12345" />}
            </form.AppField>
          </FieldRow>
          <form.AppField name="country">
            {(field) => <field.InputField label="Country" placeholder="US" />}
          </form.AppField>
          <form.AppField name="isPrimary">
            {(field) => <field.CheckboxField label="Set as primary address" />}
          </form.AppField>
          <FormDialogFooter onCancel={() => onOpenChange(false)} error={error?.message ?? null}>
            <form.SubmitButton createLabel="Add Address" />
          </FormDialogFooter>
        </Form>
      </form.AppForm>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function AddressList({ fragmentRef, onAdd, onDelete, createOpen, onCreateOpenChange }: AddressListProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = createOpen ?? internalOpen;
  const setDialogOpen = onCreateOpenChange ?? setInternalOpen;
  const person = fragmentRef;
  const addresses = (person.addresses ?? []) as AddressData[];

  return (
    <>
      <View className="gap-2">
        {addresses.length === 0 ? <Text className="text-muted-foreground text-sm">No addresses yet.</Text> : null}

        {addresses.map((address) => (
          <AddressRow key={address.id} address={address} onDelete={onDelete} />
        ))}
      </View>

      <AddAddressDialog personId={person.id} open={dialogOpen} onOpenChange={setDialogOpen} onAdded={onAdd} />
    </>
  );
}
