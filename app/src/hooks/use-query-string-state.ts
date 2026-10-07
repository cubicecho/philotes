import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

/** Whether a state change replaces the current history entry or adds one. */
type HistoryChangeType = 'replace' | 'push';

/** How a query-string value is read back. A key with no entry in the type map is read as a string. */
type ParamType = 'number' | 'string' | 'boolean' | 'stringArray';

/** How each key of the state is read back from the URL. */
type TypeMap<T extends object> = {
  [K in keyof T]?: ParamType;
};

/** What `useQueryStringState` can be told about its state. */
interface UseQueryStringStateOptions<T extends object> {
  /** The type of each key that is not a string. */
  typeMap?: TypeMap<T>;
}

/** Turns the text of one query-string value into the value its type names. */
const PARSE_BY_PARAM_TYPE: Record<ParamType, (rawValue: string) => unknown> = {
  number: (rawValue) => Number(rawValue),
  string: (rawValue) => rawValue,
  boolean: (rawValue) => rawValue === 'true',
  stringArray: (rawValue) => rawValue.split(',').filter((s) => s.length > 0),
};

/**
 * Reads a query string into state, converting each value by the type its key is given.
 *
 * @typeParam T - The state's shape.
 * @param search - The query string, with or without its leading `?`.
 * @param [typeMap] - The type of each key that is not a string.
 * @returns The keys present in the query string. A repeated key keeps its last value.
 */
export function parseSearch<T extends object>(search: string, typeMap?: TypeMap<T>): Partial<T> {
  const params = new URLSearchParams(search);
  const paramTypes = new Map<string, ParamType | undefined>(Object.entries(typeMap ?? {}));
  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of params.entries()) {
    const paramType = paramTypes.get(key) ?? 'string';
    result[key] = PARSE_BY_PARAM_TYPE[paramType](rawValue);
  }
  // The one assertion: a URL is text, so nothing here can prove its keys and values are the caller's T.
  return result as Partial<T>;
}

/**
 * Writes state as a query string. Blank values and empty arrays are left out, and an array is joined
 * by commas.
 *
 * @param state - The state to write.
 * @returns The query string with its leading `?`, or an empty string when nothing is left to write.
 */
export function stringifyState(state: object): string {
  const params = new URLSearchParams();
  const entries: [string, unknown][] = Object.entries(state);
  for (const [key, value] of entries) {
    const isBlank = value === undefined || value === null || value === '';
    if (isBlank) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Keeps a page's state in the URL's query string, so it survives a reload and can be linked to.
 *
 * @typeParam T - The state's shape.
 * @param [defaultState] - The value each key has while the URL does not carry it.
 * @param [options] - How to read the keys that are not strings.
 * @returns The current state, and a setter that merges a change into it and navigates.
 *
 * @remarks
 * The setter replaces the history entry unless it is passed `'push'`.
 */
export function useQueryStringState<T extends object>(
  defaultState: Partial<T> = {},
  options?: UseQueryStringStateOptions<T>,
): [Partial<T>, (newState: Partial<T>, historyChangeType?: HistoryChangeType) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const rawParams = useLocalSearchParams<Record<string, string>>();

  const searchStr = Object.keys(rawParams).length ? `?${new URLSearchParams(rawParams).toString()}` : '';

  const parsed = parseSearch<T>(searchStr, options?.typeMap);
  const state = { ...defaultState, ...parsed };

  const setState = (newState: Partial<T>, historyChangeType: HistoryChangeType = 'replace') => {
    const merged = { ...state, ...newState };
    const newSearch = stringifyState(merged);
    const newPath = `${pathname}${newSearch}`;
    if (historyChangeType === 'replace') {
      router.replace(newPath);
    } else {
      router.push(newPath);
    }
  };

  return [state, setState];
}
