import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../server/__generated__/schema.graphql',
  importExtension: '.ts',
  documents: ['./src/**/*.ts', './src/**/*.tsx', './app/**/*.ts', './app/**/*.tsx'],
  ignoreNoDocuments: true,
  generates: {
    'src/__generated__/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        customDirectives: {
          apolloUnmask: true,
        },
        avoidOptionals: {
          field: true, // Use `null` for nullable fields instead of optionals
        },
        useTypeImports: true,
        defaultScalarType: 'unknown',
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
        scalars: {
          DateTime: 'Date',
          Date: { input: 'string', output: 'Date' },
        },
      },
    },
    'src/__generated__/type-policies.ts': {
      plugins: ['@homebound/graphql-typescript-scalar-type-policies'],
      config: {
        scalarTypePolicies: {
          DateTime: '@/lib/date-type-policy#dateTimeTypePolicy',
          Date: '@/lib/date-type-policy#dateTypePolicy',
        },
      },
    },
  },
};

export default config;
