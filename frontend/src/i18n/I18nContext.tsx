import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Locale, translations } from './translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = 'ig_locale';

const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(source: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, segment) => {
    if (typeof acc !== 'object' || acc === null || !(segment in acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, source);
  return typeof value === 'string' ? value : undefined;
}

function initialLocale(): Locale {
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached === 'en' || cached === 'zh') {
      return cached;
    }
  } catch {
    return 'zh';
  }
  return 'zh';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      return;
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key: string) => {
        return resolvePath(translations[locale], key)
          ?? resolvePath(translations.zh, key)
          ?? key;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
