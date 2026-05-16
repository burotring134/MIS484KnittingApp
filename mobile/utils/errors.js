// Maps a raw error (from fetch / our reachability pre-check / the
// backend's JSON `error` field) to a user-friendly `{title, message}`
// pair. Developer signals (env-var names, internal keys, stack
// fragments) are deliberately filtered out — those belong in
// console.log, not on screen.
//
// Callers should still console.log the raw error for debugging:
//   const friendly = friendlyError(err);
//   console.log('[generate] FAILED:', err.message);
//   setError(friendly);
export function friendlyError(err) {
  const msg = err?.message || String(err);

  // Backend / AI-provider plumbing leaking through — never show to the
  // user, they can't act on it. Frame as a temporary degradation so
  // the retry button still feels meaningful.
  if (/FAL_KEY|fal\.ai|UPSTASH|MONGO_|OPENAI_|API_KEY/i.test(msg)) {
    return {
      title: 'AI şu an müsait değil',
      message: 'Klasik mod deneniyor. Birazdan tekrar dene.',
    };
  }

  // No network path to the dev server. Covers our explicit Turkish
  // pre-check message ("Sunucuya ulaşılamıyor") plus RN's stock
  // fetch failures ("Network request failed", "TypeError: …").
  if (/ulaşılamıyor|Network request failed|TypeError|Failed to fetch/i.test(msg)) {
    return {
      title: 'Sunucu uzak',
      message: "Mac ve telefon aynı Wi-Fi'da mı?",
    };
  }

  // Reachable but the health endpoint or 5xx from the backend.
  if (/sağlık kontrolü|HTTP 5\d\d|Server error 5|Sunucu hatası 5/i.test(msg)) {
    return {
      title: 'Sunucu yanıt vermiyor',
      message: 'Birazdan tekrar dene.',
    };
  }

  // 4xx from the backend — usually a validation issue we want the
  // user to see verbatim, since the server already framed it.
  if (/HTTP 4\d\d|Server error 4|Sunucu hatası 4/i.test(msg)) {
    return {
      title: 'İstek kabul edilmedi',
      message: msg,
    };
  }

  // Fallback — surface the raw message so the user has something
  // actionable to report back, but with a soft title.
  return {
    title: 'Bir şeyler ters gitti',
    message: msg,
  };
}
