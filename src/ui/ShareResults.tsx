import { useRef, useState } from 'react';
import { challengeLink, shareMessages, shareText, type ShareChallenge } from '../core/sharing';
import type { Locale } from '../core/types';

export function ShareResults({ challenge, scores, label, locale }: { challenge: ShareChallenge; scores: number[]; label: string; locale: Locale }) {
  const t = shareMessages[locale];
  const link = challengeLink(challenge, window.location.href, import.meta.env.BASE_URL);
  const text = shareText(scores, label, locale, link);
  const [status, setStatus] = useState<'copied' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('failed'); requestAnimationFrame(() => { fallback.current?.focus(); fallback.current?.select(); }); }
  };
  const share = async () => {
    setStatus(null); setBusy(true);
    try {
      if (navigator.share) await navigator.share({ title: 'AlpTap', text: text.slice(0, -(link.length + 1)), url: link });
      else await copy();
    } catch (error) {
      // Closing the native sheet is intentional, not a request to copy.
      if (!(error instanceof Error && error.name === 'AbortError')) await copy();
    } finally { setBusy(false); }
  };
  return <div className="share-results">
    <div className="share-actions"><button className="primary" disabled={busy} onClick={share}>{t.share} <span aria-hidden="true">↗</span></button><button className="share-copy" disabled={busy} onClick={copy}>{t.copy}</button></div>
    <p className="share-legend">{t.legend}</p>
    <p className="share-status" role="status">{status ? t[status] : ''}</p>
    {status === 'failed' && <textarea ref={fallback} aria-label={t.preview} readOnly value={text} rows={7} onFocus={event => event.currentTarget.select()}/>}
  </div>;
}
