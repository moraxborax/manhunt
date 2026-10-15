/// Project credentials from Supabase MCP (`get_project_url` / `get_publishable_keys`).
/// Override at build time with:
/// `--dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`
class SupabaseConfig {
  static const url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://bmhymvgxhmpbzpcxprkr.supabase.co',
  );

  /// Publishable key from Supabase MCP `get_publishable_keys`.
  static const publishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'sb_publishable_5_n1UNeCghPn3nVtOsVEaw_gLCucHVD',
  );

  /// Legacy anon JWT fallback (older tooling / dart-defines).
  static const anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtaHltdmd4aG1wYnpwY3hwcmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzkyMjMsImV4cCI6MjEwNzU1NTIyM30.pGtJK0p3VlRAsg7X-KeCkrw0YYCuqgNkqR_jpp25fmE',
  );
}
