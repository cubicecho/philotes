import { useMutation } from '@apollo/client';
import { Clipboard, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import type { AddressListFragment } from '@/__generated__/graphql.js';
import { AddressesTypeEnum } from '@/__generated__/graphql.js';
import { Button } from '@/components/ui/button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';

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
  mutation DeleteAddresses($id: String!) {
    deleteAddresses(where: { id: { eq: $id } }) {
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
  type: AddressesTypeEnum;
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

const TYPE_LABELS: Record<AddressesTypeEnum, string> = {
  [AddressesTypeEnum.Home]: 'Home',
  [AddressesTypeEnum.Work]: 'Work',
  [AddressesTypeEnum.Other]: 'Other',
};

function formatAddress(address: AddressData): string {
  const parts: string[] = [address.line1];
  if (address.line2) parts.push(address.line2);
  const cityStateParts = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
  if (cityStateParts) parts.push(cityStateParts);
  if (address.country) parts.push(address.country);
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
  const [deleteAddresses] = useMutation(DELETE_ADDRESSES);

  const handleDelete = async () => {
    await deleteAddresses({ variables: { id: address.id } });
    onDelete();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatAddress(address));
  };

  const cityStateLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');

  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          {/* Type badge + label + primary badge */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
              {TYPE_LABELS[address.type]}
            </span>
            {address.label && <span className="text-xs text-muted-foreground">{address.label}</span>}
            {address.isPrimary && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">Primary</span>
            )}
          </div>

          {/* Address lines */}
          <p className="font-medium">{address.line1}</p>
          {address.line2 && <p className="text-muted-foreground text-xs">{address.line2}</p>}
          {cityStateLine && <p className="text-muted-foreground text-xs">{cityStateLine}</p>}
          {address.country && <p className="text-muted-foreground text-xs">{address.country}</p>}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={handleCopy}
            className="hover:text-foreground transition-colors"
            aria-label="Copy address to clipboard"
          >
            <Clipboard className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="hover:text-destructive transition-colors"
            aria-label="Delete address"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add address form
// ---------------------------------------------------------------------------

interface AddressFormValues {
  type: AddressesTypeEnum;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}

interface AddAddressFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function AddAddressForm({ personId, onAdded, onCancel }: AddAddressFormProps) {
  const [createAddresses, { loading }] = useMutation(CREATE_ADDRESSES);
  const [values, setValues] = useState<AddressFormValues>({
    type: AddressesTypeEnum.Home,
    label: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.line1.trim()) return;

    await createAddresses({
      variables: {
        values: [
          {
            personId,
            type: values.type,
            label: values.label.trim() || null,
            line1: values.line1.trim(),
            line2: values.line2.trim() || null,
            city: values.city.trim() || null,
            state: values.state.trim() || null,
            postalCode: values.postalCode.trim() || null,
            country: values.country.trim() || null,
            isPrimary: values.isPrimary,
          },
        ],
      },
    });
    onAdded();
  };

  const fieldClass =
    'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const labelClass = 'block text-sm font-medium mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type */}
      <div>
        <label htmlFor="addr-type" className={labelClass}>
          Type
        </label>
        <select
          id="addr-type"
          value={values.type}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              type: e.target.value as AddressesTypeEnum,
            }))
          }
          className={fieldClass}
        >
          <option value={AddressesTypeEnum.Home}>Home</option>
          <option value={AddressesTypeEnum.Work}>Work</option>
          <option value={AddressesTypeEnum.Other}>Other</option>
        </select>
      </div>

      {/* Label */}
      <div>
        <label htmlFor="addr-label" className={labelClass}>
          Label <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="addr-label"
          type="text"
          placeholder="e.g. Parents' house"
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          className={fieldClass}
        />
      </div>

      {/* Line 1 */}
      <div>
        <label htmlFor="addr-line1" className={labelClass}>
          Address Line 1
        </label>
        <input
          id="addr-line1"
          type="text"
          placeholder="123 Main St"
          value={values.line1}
          onChange={(e) => setValues((v) => ({ ...v, line1: e.target.value }))}
          className={fieldClass}
          required
          // biome-ignore lint/a11y/noAutofocus: intentional for modal forms
          autoFocus
        />
      </div>

      {/* Line 2 */}
      <div>
        <label htmlFor="addr-line2" className={labelClass}>
          Address Line 2 <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="addr-line2"
          type="text"
          placeholder="Apt 4B"
          value={values.line2}
          onChange={(e) => setValues((v) => ({ ...v, line2: e.target.value }))}
          className={fieldClass}
        />
      </div>

      {/* City / State / Postal */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="addr-city" className={labelClass}>
            City
          </label>
          <input
            id="addr-city"
            type="text"
            placeholder="City"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="addr-state" className={labelClass}>
            State
          </label>
          <input
            id="addr-state"
            type="text"
            placeholder="State"
            value={values.state}
            onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="addr-postal" className={labelClass}>
            Postal Code
          </label>
          <input
            id="addr-postal"
            type="text"
            placeholder="12345"
            value={values.postalCode}
            onChange={(e) => setValues((v) => ({ ...v, postalCode: e.target.value }))}
            className={fieldClass}
          />
        </div>
      </div>

      {/* Country */}
      <div>
        <label htmlFor="addr-country" className={labelClass}>
          Country
        </label>
        <input
          id="addr-country"
          type="text"
          placeholder="US"
          value={values.country}
          onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
          className={fieldClass}
        />
      </div>

      {/* Is Primary */}
      <div className="flex items-center gap-2">
        <input
          id="addr-primary"
          type="checkbox"
          checked={values.isPrimary}
          onChange={(e) => setValues((v) => ({ ...v, isPrimary: e.target.checked }))}
          className="h-4 w-4 rounded border-border"
        />
        <label htmlFor="addr-primary" className="text-sm">
          Set as primary address
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={!values.line1.trim() || loading}>
          {loading ? 'Saving…' : 'Add Address'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
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
      <div className="space-y-2">
        {addresses.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4" />
            <span>No addresses yet.</span>
          </div>
        )}

        {addresses.map((address) => (
          <AddressRow key={address.id} address={address} onDelete={onDelete} />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Address</DialogTitle>
          </DialogHeader>
          <AddAddressForm
            personId={person.id}
            onAdded={() => {
              setDialogOpen(false);
              onAdd();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
