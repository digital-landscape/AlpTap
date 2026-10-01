import type {Locale} from '../core/types';

const labels = {
  de: {academy: 'ÖAW — Österreichische Akademie der Wissenschaften', institute: 'IGF — Institut für interdisziplinäre Gebirgsforschung', opens: 'öffnet in einem neuen Tab'},
  en: {academy: 'ÖAW — Austrian Academy of Sciences', institute: 'IGF — Institute for Interdisciplinary Mountain Research', opens: 'opens in a new tab'},
  fr: {academy: 'ÖAW — Académie autrichienne des sciences', institute: 'IGF — Institut de recherche interdisciplinaire sur la montagne', opens: 's’ouvre dans un nouvel onglet'},
  it: {academy: 'ÖAW — Accademia austriaca delle scienze', institute: 'IGF — Istituto di ricerca interdisciplinare sulla montagna', opens: 'si apre in una nuova scheda'},
};

export function InstitutionFooter({locale, placement = 'chrome'}: {locale: Locale; placement?: 'chrome' | 'welcome'}) {
  const text = labels[locale];
  const german = locale === 'de';
  return <footer className={`institution-footer${placement === 'welcome' ? ' institution-footer--welcome' : ''}`}>
    <span className="institution-credit">{{de: 'Gestaltet von', en: 'Designed by', fr: 'Conçu par', it: 'Progettato da'}[locale]}</span>
    <a href={german ? 'https://www.oeaw.ac.at' : 'https://www.oeaw.ac.at/en/'} target="_blank" rel="noopener noreferrer" aria-label={`${text.academy} (${text.opens})`} title={`${text.academy} · ${text.opens}`}>
      <img src="/logos/oeaw-logo-animated-cropped.svg" alt={text.academy}/>
    </a>
    <span className="institution-divider" aria-hidden="true"/>
    <a href={german ? 'https://www.oeaw.ac.at/igf/home' : 'https://www.oeaw.ac.at/en/igf/home'} target="_blank" rel="noopener noreferrer" aria-label={`${text.institute} (${text.opens})`} title={`${text.institute} · ${text.opens}`}>
      <img src="/logos/igf-animated-cropped.svg" alt={text.institute}/>
    </a>
  </footer>;
}
