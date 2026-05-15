import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = 'philotes-theme';

function getInitialDark(): boolean {
  if (Platform.OS !== 'web') return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.classList.toggle('dark', dark);
    window.localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
