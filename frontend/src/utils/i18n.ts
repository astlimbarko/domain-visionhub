import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from '../locales/es/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: es },
    },
    lng: 'es',
    fallbackLng: 'es',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

export default i18n;
