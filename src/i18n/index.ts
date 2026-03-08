import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

function resolveInitialLanguage(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'zh';
  const stored = window.localStorage.getItem('i18nextLng') || '';
  if (stored.startsWith('en')) return 'en';
  if (stored.startsWith('zh')) return 'zh';
  return 'zh';
}

const initialLanguage = resolveInitialLanguage();

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: ['translation'],
    defaultNS: 'translation',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
