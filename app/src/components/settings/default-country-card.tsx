import { useMutation, useQuery } from '@apollo/client';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { z } from 'zod';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Form } from '@/components/ui/form';

const GET_DEFAULT_COUNTRY = graphql(`
  query GetDefaultCountry {
    user {
      id
      defaultCountry
    }
  }
`);

const SET_DEFAULT_COUNTRY = graphql(`
  mutation SetDefaultCountry($country: String!) {
    setDefaultCountry(country: $country) {
      id
      defaultCountry
    }
  }
`);

/** A country as its ISO 3166-1 alpha-2 code. The server decides whether the two letters name one. */
const countrySchema = z.object({
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Give the two-letter country code, such as US or GB.'),
});

/**
 * The setting for the country a phone number is read in when it is written without a country code.
 * Saving it works every stored number out again, so `(555) 010-0100` and `+1 555 010 0100` stay one number.
 */
export function DefaultCountryCard() {
  const { data, error: loadError, refetch } = useQuery(GET_DEFAULT_COUNTRY);
  const [setDefaultCountry, { error: saveError }] = useMutation(SET_DEFAULT_COUNTRY);
  const stored = data?.user?.defaultCountry ?? '';

  const form = useAppForm({
    defaultValues: { country: stored },
    validators: { onSubmit: countrySchema },
    onSubmit: async ({ value }) => {
      try {
        await setDefaultCountry({ variables: { country: value.country.trim().toUpperCase() } });
      } catch {
        // The card shows the mutation's error under the field.
      }
    },
  });

  // The stored country arrives after the first render, and changes when it is saved.
  useEffect(() => {
    form.reset({ country: stored });
  }, [stored, form]);

  return (
    <Section
      surface="card"
      title="Phone Numbers"
      description="The country a number is read in when it has no country code. It is how a number typed two ways is known to be the same one."
      contentSlot={
        <form.AppForm>
          <Form className="gap-3">
            {loadError ? (
              <QueryError compact error={loadError} what="your default country" onRetry={() => refetch()} />
            ) : null}
            <form.AppField name="country">
              {(field) => (
                <field.InputField label="Default country" placeholder="US" autoCapitalize="characters" maxLength={2} />
              )}
            </form.AppField>
            {saveError ? (
              <Text role="alert" className="text-destructive text-sm">
                {saveError.message}
              </Text>
            ) : null}
            <form.SubmitButton createLabel="Save" savingLabel="Saving…" className="self-start" />
          </Form>
        </form.AppForm>
      }
    />
  );
}
