import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://bmhymvgxhmpbzpcxprkr.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_5_n1UNeCghPn3nVtOsVEaw_gLCucHVD';

export const AMAP_JS_KEY: string =
  (import.meta.env.VITE_AMAP_KEY as string | undefined)?.trim() || '';

export const AMAP_SECURITY_JS_CODE: string =
  (import.meta.env.VITE_AMAP_SECURITY_JS_CODE as string | undefined)?.trim() ||
  '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
