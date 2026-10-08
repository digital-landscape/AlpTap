import { GAME } from './config';
import { gameURL, type GameRoute } from './game-url';
import { nextViennaRollover } from './date';
import { validChallenge } from './persistence';
import { validV2, scoringRuleFor, TIERS, type ChallengeV2 } from './modes';
import type { Challenge, Locale } from './types';

export type SharedGame = { kind: 'alpine'; challenge: Challenge; key: string } | { kind: 'world'; challenge: ChallengeV2; key: string };
export type ShareChallenge = Challenge | ChallengeV2;
const isMode = (challenge: ShareChallenge): challenge is ChallengeV2 => 'targetIds' in challenge;

// Store the ordered selection, not a request to regenerate a particular day.
// Compact ASCII JSON keeps links portable without a server or URL shortener.
export function challengeToken(challenge: ShareChallenge): string {
  const payload = isMode(challenge)
    ? [1, 'world', challenge.datasetVersion, challenge.date, challenge.algorithmVersion, challenge.targetIds]
    : [1, 'alpine', challenge.datasetVersion, challenge.date, challenge.algorithmVersion, challenge.peakIds, challenge.region, challenge.difficulty];
  return btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function parseSharedGame(search: string): SharedGame | null {
  const params = new URLSearchParams(search);
  if (!params.has('play')) return null;
  const token = params.get('play')!;
  try {
    if (params.getAll('play').length !== 1 || !/^[A-Za-z0-9_-]{1,4096}$/.test(token)) throw new Error();
    const payload: unknown = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')));
    if (!Array.isArray(payload)) throw new Error();
    const [version, kind, datasetVersion, date, algorithmVersion, ids, region, difficulty] = payload;
    if (version !== 1 || !['alpine', 'world'].includes(kind) || payload.length !== (kind === 'alpine' ? 8 : 6)
      || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0,10) !== date
      || typeof algorithmVersion !== 'string' || !/^[a-z0-9-]{1,80}$/.test(algorithmVersion)) throw new Error();
    const common = { id: `shared-v1:${token}`, date, datasetVersion, algorithmVersion, timezone: GAME.timezone, nextRollover: nextViennaRollover(date) };
    let game: SharedGame;
    const key = `alptap:replay:v1:${token}`;
    if (kind === 'alpine') {
      const challenge = { ...common, region, difficulty, peakIds: ids, roundCount: ids?.length, ...(difficulty === 'mixed' ? { roundDifficulties: [...TIERS] } : {}) };
      if (!validChallenge(challenge)) throw new Error();
      game = { kind, challenge, key };
    } else {
      const challenge = { ...common, schemaVersion: 2 as const, mode: 'world-peaks' as const, region: 'world', scoringRule: scoringRuleFor('world-peaks'), targetIds: ids, roundDifficulties: [...TIERS] };
      if (!validV2(challenge)) throw new Error();
      game = { kind, challenge, key };
    }
    // Reject alternate encodings; one exact game has one replay storage key.
    if (challengeToken(game.challenge) !== token) throw new Error();
    return game;
  } catch { throw new Error('Invalid shared challenge'); }
}

export function challengeLink(challenge: ShareChallenge, pageUrl: string, basePath: string): string {
  const url = new URL(basePath, pageUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('play', challengeToken(challenge));
  return url.href;
}

// Result invitations follow the current daily game; only custom areas need their full route.
export function resultLink(challenge: ShareChallenge, pageUrl: string, basePath: string, route?: GameRoute): string {
  const dailyRoute: GameRoute = route?.mode === 'custom' ? route : isMode(challenge)
    ? { mode: 'world-peaks', region: 'alps' }
    : { mode: 'alpine-peaks', region: challenge.region };
  return gameURL(new URL(basePath, pageUrl).href, dailyRoute);
}

export const scoreEmoji = (score: number): string => score >= 1000 ? '🏔️' : score >= 900 ? '🧗' : score >= 700 ? '🥾' : '🚶';
export const shareMessages = {
  en: { share: 'Share results', copy: 'Copy results', copied: 'Results copied!', failed: 'Select and copy your results below.', preview: 'Your share message', final: 'Final score', play: 'Play these peaks', shared: 'Shared challenge', hint: 'The same peaks, in the same order. Play at your own pace.', daily: 'Play today’s game', invalid: 'This challenge link is invalid or unsupported.', legend: '🚶 Walker <700 · 🥾 Hiker 700+ · 🧗 Climber 900+ · 🏔️ Summit 1000' },
  de: { share: 'Ergebnisse teilen', copy: 'Ergebnisse kopieren', copied: 'Ergebnisse kopiert!', failed: 'Wähle und kopiere deine Ergebnisse unten.', preview: 'Deine Nachricht', final: 'Gesamtpunktzahl', play: 'Diese Gipfel spielen', shared: 'Geteilte Herausforderung', hint: 'Dieselben Gipfel in derselben Reihenfolge. Spiele in deinem Tempo.', daily: 'Heutiges Spiel starten', invalid: 'Dieser Spiellink ist ungültig oder wird nicht unterstützt.', legend: '🚶 Spaziergänger <700 · 🥾 Wanderer 700+ · 🧗 Kletterer 900+ · 🏔️ Gipfel 1000' },
  fr: { share: 'Partager les résultats', copy: 'Copier les résultats', copied: 'Résultats copiés !', failed: 'Sélectionnez et copiez vos résultats ci-dessous.', preview: 'Votre message', final: 'Score final', play: 'Jouer ces sommets', shared: 'Défi partagé', hint: 'Les mêmes sommets, dans le même ordre. Jouez à votre rythme.', daily: 'Jouer le défi du jour', invalid: 'Ce lien de défi est invalide ou non pris en charge.', legend: '🚶 Marcheur <700 · 🥾 Randonneur 700+ · 🧗 Alpiniste 900+ · 🏔️ Sommet 1000' },
  it: { share: 'Condividi i risultati', copy: 'Copia i risultati', copied: 'Risultati copiati!', failed: 'Seleziona e copia i risultati qui sotto.', preview: 'Il tuo messaggio', final: 'Punteggio finale', play: 'Gioca queste cime', shared: 'Sfida condivisa', hint: 'Le stesse cime, nello stesso ordine. Gioca al tuo ritmo.', daily: 'Gioca la sfida di oggi', invalid: 'Questo link non è valido o non è supportato.', legend: '🚶 Camminatore <700 · 🥾 Escursionista 700+ · 🧗 Alpinista 900+ · 🏔️ Vetta 1000' },
} satisfies Record<Locale, Record<string, string>>;

export function shareText(scores: readonly number[], label: string, locale: Locale, link: string, daily = false): string {
  const t = shareMessages[locale];
  return `AlpTap · ${label}\n${scores.map(score => `${score}${scoreEmoji(score)}`).join(' ')}\n${t.final}: ${scores.reduce((sum, score) => sum + score, 0)} / ${scores.length * GAME.maxRoundScore}\n${daily ? t.daily : t.play} 👇\n${link}`;
}
