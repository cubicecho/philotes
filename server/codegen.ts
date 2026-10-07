import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './__generated__/schema.graphql',
  importExtension: '.ts',
  generates: {
    './__generated__/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        inputMaybeValue: 'T | undefined',
        useTypeImports: true,
        enumsAsConst: true,
        //         useIndexSignature: true,
        contextType: '../src/core/context.ts#Context',
        scalars: {
          UUID: 'string',
        },
        avoidOptionals: {
          // Use `null` for nullable fields instead of optionals
          field: true,
          // Allow nullable input fields to remain unspecified
          inputValue: false,
        },
      },
    },
    //     'server/src/__generated__/schema.graphql': {
    //       plugins: ['schema-ast'],
    //       config: {
    //         inputMaybeValue: 'T | undefined',
    //         contextType: '../src/core/context.ts#Context',
    //         includeDirectives: true,
    //         avoidOptionals: {
    //           // Use `null` for nullable fields instead of optionals
    //           field: true,
    //           // Allow nullable input fields to remain unspecified
    //           inputValue: false,
    //         },
    //       },
    //     },
  },
};

export default config;
