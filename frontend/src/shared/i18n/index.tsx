import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ru } from 'date-fns/locale';
import { enUS } from 'date-fns/locale/en-US';
import type { Locale } from 'date-fns';
import { ru as ruTranslations } from './translations/ru';
import { en as enTranslations } from './translations/en';
import { uz as uzTranslations } from './translations/uz';

export type LangCode = 'ru' | 'en' | 'uz';

const STORAGE_KEY = 'app_lang';

const translations: Record<LangCode, Record<string, string>> = {
  ru: ruTranslations,
  en: enTranslations,
  uz: uzTranslations,
};

const dateLocales: Record<LangCode, Locale> = {
  ru,
  en: enUS,
  uz: ru,
};

const FALLBACK_LANG: LangCode = 'ru';

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? `{{${key}}}`));
}

function loadPersistedLang(): LangCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ru' || stored === 'en' || stored === 'uz') return stored;
  } catch {}
  return null;
}

function persistLang(lang: LangCode) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

function mergeTranslations(
  userLang?: string | null,
  persistedLang?: LangCode | null,
): LangCode {
  if (userLang === 'ru' || userLang === 'en' || userLang === 'uz') return userLang;
  if (persistedLang) return persistedLang;
  return FALLBACK_LANG;
}

interface I18nContextValue {
  lang: LangCode;
  t: (key: string, values?: Record<string, string | number>) => string;
  setLang: (lang: LangCode) => void;
  dateLocale: Locale;
}

const I18nContext = createContext<I18nContextValue>({
  lang: FALLBACK_LANG,
  t: (key) => key,
  setLang: () => {},
  dateLocale: ru,
});

export function useTranslation() {
  return useContext(I18nContext);
}

export function I18nProvider({
  children,
  userLanguage,
}: {
  children: React.ReactNode;
  userLanguage?: string | null;
}) {
  const [lang, setLangState] = useState<LangCode>(() =>
    mergeTranslations(userLanguage, loadPersistedLang()),
  );

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    persistLang(next);
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const template = translations[lang]?.[key] ?? translations[FALLBACK_LANG]?.[key] ?? key;
      return interpolate(template, values);
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, t, setLang, dateLocale: dateLocales[lang] ?? ru }),
    [lang, t, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
