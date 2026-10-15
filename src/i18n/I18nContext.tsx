import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Locale, type Translations } from './translations';

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  toggleLocale: () => void;
  setLocale: (loc: Locale) => void;
}

const STORAGE_KEY = 'manhunt_locale';

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // ignore storage errors
  }
  return 'zh'; // Default to Simplified Chinese as requested
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  t: translations.zh,
  toggleLocale: () => {},
  setLocale: () => {},
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
      document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en';
    } catch {
      // ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  }, [locale, setLocale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        t: translations[locale],
        toggleLocale,
        setLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
