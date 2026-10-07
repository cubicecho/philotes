import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

type HistoryChangeType = 'replace' | 'push';

/** How a query-string value is read back. A key with no entry in the type map is read as a string. */
type ParamType = 'number' | 'string' | 'boolean' | 'stringArray';

type TypeMap<T extends object> = {
  [K in keyof T]?: ParamType;
};

interface UseQueryStringStateOptions<T extends object> {
  typeMap?: TypeMap<T>;
}

/** Turns the text of one query-string value into the value its type names. */
const PARSE_BY_PARAM_TYPE: Record<ParamType, (rawValue: string) => unknown> = {
  number: (rawValue) => Number(rawValue),
  string: (rawValue) => rawValue,
  boolean: (rawValue) => rawValue === 'true',
  stringArray: (rawValue) => rawValue.split(',').filter((s) => s.length > 0),
};

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
