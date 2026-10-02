import type {Locale} from '../core/types';

const copy = {
  en: {
    title: 'Behind AlpTap',
    group: 'A project from the Digital Landscape group at IGF, the Institute for Interdisciplinary Mountain Research of the Austrian Academy of Sciences (ÖAW).',
    motivation: 'The motivation is simple: challenge ourselves to learn new peaks, one daily discovery at a time.',
    thanks: 'Thanks also to ChatGPT for coding assistance. Yes, this was vibe coded — the vibes were high, just like the mountains.',
  },
  de: {
    title: 'Hinter AlpTap',
    group: 'Ein Projekt der Gruppe Digital Landscape am IGF, dem Institut für interdisziplinäre Gebirgsforschung der Österreichischen Akademie der Wissenschaften (ÖAW).',
    motivation: 'Die Motivation ist einfach: uns selbst herausfordern und neue Gipfel kennenlernen — jeden Tag eine neue Entdeckung.',
    thanks: 'Danke auch an ChatGPT für die Unterstützung beim Programmieren. Ja, das war Vibe Coding — die Stimmung war hoch, genau wie die Berge.',
  },
  fr: {
    title: 'Derrière AlpTap',
    group: 'Un projet du groupe Digital Landscape à l’IGF, l’Institut de recherche interdisciplinaire sur la montagne de l’Académie autrichienne des sciences (ÖAW).',
    motivation: 'La motivation est simple : nous mettre au défi d’apprendre de nouveaux sommets, une découverte quotidienne à la fois.',
    thanks: 'Merci aussi à ChatGPT pour son aide au développement. Oui, c’est du vibe coding — les vibes étaient au sommet, comme les montagnes.',
  },
  it: {
    title: 'Dietro AlpTap',
    group: 'Un progetto del gruppo Digital Landscape presso l’IGF, l’Istituto di ricerca interdisciplinare sulla montagna dell’Accademia austriaca delle scienze (ÖAW).',
    motivation: 'La motivazione è semplice: metterci alla prova e imparare nuove vette, una scoperta al giorno.',
    thanks: 'Grazie anche a ChatGPT per l’aiuto nella programmazione. Sì, è stato vibe coding — le vibes erano alte, proprio come le montagne.',
  },
};

export function ProjectCredits({locale}: {locale: Locale}) {
  const text = copy[locale];
  return <section aria-label={text.title}>
    <h3>{text.title}</h3>
    <p>{text.group} <a href="https://digital-landscape.at/" target="_blank" rel="noopener noreferrer">Digital Landscape ↗</a></p>
    <p>{text.motivation}</p>
    <p>{text.thanks}</p>
  </section>;
}
