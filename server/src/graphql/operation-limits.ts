import { maxAliasesRule } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthRule } from '@escape.tech/graphql-armor-max-depth';
import type { ExecutionArgs, GraphQLError, ValidationContext } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';
import type { Plugin } from 'graphql-yoga';
import { OPERATION_LIMIT_DEFAULTS } from '../core/defaults.ts';
import { tooComplex } from '../core/errors.ts';

const { maxDepth, maxAliases, maxCost, defaultFieldCost } = OPERATION_LIMIT_DEFAULTS;

/**
 * Re-reports an armor refusal with our code. Armor's own error has none and reads "Syntax Error: ...".
 *
 * @param context - Validation context. It is null outside validation.
 * @param error - Armor's error.
 */
function reportCoded(context: ValidationContext | null, error: GraphQLError): void {
  context?.reportError(tooComplex(error.message.replace(/^Syntax Error: /, '')));
}

/** Armor rules report through reportCoded instead of throwing. */
const armor = { propagateOnRejection: false, onReject: [reportCoded] };

/**
 * Prices an operation with its own variables (`limit: $n`).
 *
 * @param args - Execution args.
 * @returns The cost.
 */
function costOf(args: ExecutionArgs): number {
  return getComplexity({
    schema: args.schema,
    query: args.document,
    operationName: args.operationName ?? undefined,
    variables: args.variableValues ?? {},
    // drizzle-graphql's hints first. Any other field costs `defaultFieldCost`.
    estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: defaultFieldCost })],
  });
}

/** The part of Yoga's execute and subscribe payloads that the cost check uses. */
interface OperationStart {
  args: ExecutionArgs;
  /** Ends the operation with a result of our choosing. */
  setResultAndStopExecution: (result: { errors: GraphQLError[] }) => void;
}

/**
 * Stops an operation that costs more than `maxCost`.
 *
 * @param start - The operation about to run.
 */
function refuseCostly({ args, setResultAndStopExecution }: OperationStart): void {
  const cost = costOf(args);
  if (cost <= maxCost) {
    return;
  }
  const advice = 'Ask for fewer rows (limit) or fewer nested lists.';
  setResultAndStopExecution({ errors: [tooComplex(`Query cost ${cost} exceeds ${maxCost}. ${advice}`)] });
}

/**
 * Refuses operations that are too deep, too aliased or too costly, before any resolver runs.
 *
 * @returns A Yoga plugin.
 */
export function useOperationLimits(): Plugin {
  return {
    onValidate: ({ addValidationRule }) => {
      addValidationRule(maxDepthRule({ n: maxDepth, ...armor }));
      addValidationRule(maxAliasesRule({ n: maxAliases, ...armor }));
    },
    // Cost needs the variables, which validation doesn't see, so it's checked when execution starts.
    onExecute: refuseCostly,
    onSubscribe: refuseCostly,
  };
}
