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
import { EmptyState } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldRow, Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Trash2 } from '@/components/ui/icons';

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

export interface AddressListProps {
  /** The person whose addresses are listed. */
  fragmentRef: AddressListFragment;
  /** Called after an address is added. */
  onAdd: () => void;
  /** Called after an address is deleted. */
  onDelete: () => void;
  /** Whether the add dialog is open, when the owner holds that state; left out, the list holds it. */
  createOpen?: boolean;
  /** Receives the add dialog's open state when the owner holds it. */
  onCreateOpenChange?: (open: boolean) => void;
}

/** One address of the fragment. */
type AddressData = AddressListFragment['addresses'][number];

/** What each address type is called on screen. */
const TYPE_LABELS: Record<AddressTypeEnum, string> = {
  [AddressTypeEnum.Home]: 'Home',
  [AddressTypeEnum.Work]: 'Work',
  [AddressTypeEnum.Other]: 'Other',
};

/** The address types as select options. */
const TYPE_OPTIONS = [AddressTypeEnum.Home, AddressTypeEnum.Work, AddressTypeEnum.Other].map((value) => ({
  value,
  label: TYPE_LABELS[value],
}));

/**
 * The city, state and postal code on one line.
 *
 * @param address - The address.
 * @returns The parts that are set, joined by `, `; empty when none is.
 */
function cityStateLine(address: AddressData): string {
  return [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
}

/**
 * An address as the lines of a postal address, for the clipboard.
 *
 * @param address - The address.
 * @returns Line 1, then line 2, the city line and the country where set, one per line.
 */
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

interface AddressRowProps {
  address: AddressData;
  /** Called after the address is deleted. */
  onDelete: () => void;
}

/** One address: its lines, its type and primary badges, and its copy and delete buttons. */
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
      className="border border-foreground/10"
      leadingSlot={<MapPin className="h-4 w-4 text-foreground/60" />}
      title={address.line1}
      description={rest || undefined}
      meta={
        <>
          {address.label ? <Text className="text-foreground/60 text-xs">{address.label}</Text> : null}
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

/** The add-address form's values. */
interface AddressFields {
  type: AddressTypeEnum;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}

/** A blank address form; the country starts as `US`. */
const EMPTY_ADDRESS: AddressFields = {
  type: AddressTypeEnum.Home,
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
  /** The person the address is added to. */
  personId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the address is saved. */
  onAdded: () => void;
}

/** The dialog that adds one address to a person. */
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
                type: value.type,
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
    const isClosed = open === false;
    if (isClosed) {
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

/** A person's addresses and the dialog that adds one. */
export function AddressList({ fragmentRef, onAdd, onDelete, createOpen, onCreateOpenChange }: AddressListProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = createOpen ?? internalOpen;
  const setDialogOpen = onCreateOpenChange ?? setInternalOpen;
  const person = fragmentRef;
  const addresses = person.addresses ?? [];

  return (
    <>
      <View className="gap-2">
        {addresses.length === 0 ? <EmptyState compact title="No addresses yet." /> : null}

        {addresses.map((address) => (
          <AddressRow key={address.id} address={address} onDelete={onDelete} />
        ))}
      </View>

      <AddAddressDialog personId={person.id} open={dialogOpen} onOpenChange={setDialogOpen} onAdded={onAdd} />
    </>
  );
}
