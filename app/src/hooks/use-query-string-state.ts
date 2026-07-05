import { usePathname, useRouter, useLocalSearchParams } from 'expo-router';

type HistoryChangeType = 'replace' | 'push';

type TypeMap<T extends object> = {
  [K in keyof T]?: 'number' | 'string' | 'boolean' | 'stringArray';
};

interface UseQueryStringStateOptions<T extends object> {
  typeMap?: TypeMap<T>;
}

export function parseSearch<T extends object>(search: string, typeMap?: TypeMap<T>): Partial<T> {
  const params = new URLSearchParams(search);
  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of params.entries()) {
    const hint = typeMap?.[key as keyof T];
    if (hint === 'number') {
      result[key] = Number(rawValue);
    } else if (hint === 'boolean') {
      result[key] = rawValue === 'true';
    } else if (hint === 'stringArray') {
      result[key] = rawValue === '' ? [] : rawValue.split(',').filter((s) => s.length > 0);
    } else {
      result[key] = rawValue;
    }
  }
  return result as Partial<T>;
}

export function stringifyState(state: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
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
): [T, (newState: Partial<T>, historyChangeType?: HistoryChangeType) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const rawParams = useLocalSearchParams<Record<string, string>>();

  const searchStr = Object.keys(rawParams).length
    ? '?' + new URLSearchParams(rawParams as Record<string, string>).toString()
    : '';

  const parsed = parseSearch<T>(searchStr, options?.typeMap);
  const state = { ...defaultState, ...parsed } as T;

  const setState = (newState: Partial<T>, historyChangeType: HistoryChangeType = 'replace') => {
    const merged = { ...(state as Record<string, unknown>), ...(newState as Record<string, unknown>) };
    const newSearch = stringifyState(merged);
    const newPath = `${pathname}${newSearch}`;
    if (historyChangeType === 'replace') {
      router.replace(newPath as never);
    } else {
      router.push(newPath as never);
    }
  };

  return [state, setState];
}
