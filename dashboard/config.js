// Public connection details (the same publishable keys that ship inside the app; row-level
// security and the admin + 2-step checks inside the database functions are what protect the data).
// Never put a secret key here.
window.BB_ENVS = {
  prod: { label: 'Production', url: 'https://jcdyppjnmszkvtcwcyiq.supabase.co', key: 'sb_publishable_WaauJ8OjgVon5qaQ3VTV4Q_YtcOsD83' },
  dev: { label: 'Dev', url: 'https://yquvmypmkyivaqxogste.supabase.co', key: 'sb_publishable_TYWS6Ym_Om68PeRdsRQ9EQ_OJmcwUTL' },
};
