import { createClient } from '@supabase/supabase-js';
import { readOnlyFetch } from '@/preview-ui/read-only-fetch';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: readOnlyFetch },
  auth: { storageKey: 'visionhub-ui-real-readonly-session' },
});
