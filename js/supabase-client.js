// ==============================================================================
// PathPulse AI - Supabase Client Initializer (js/supabase-client.js)
// ==============================================================================

const SUPABASE_CONFIG = {
  url: 'https://iepzzsrrixbdgzmymtat.supabase.co',
  anonKey: 'sb_publishable_bZ1R-6-mKX3fLWuMiUA9wQ_3YOWzLc-'
};

// Global Supabase client instance
window.supabaseClient = null;

function initSupabaseClient() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log('✓ PathPulse Supabase Client successfully initialized.');
    } catch (err) {
      console.warn('Supabase initialization notice:', err);
    }
  } else {
    console.warn('Supabase JS library not yet loaded. Include @supabase/supabase-js in head.');
  }
}

// Auto initialize when library is present
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabaseClient);
} else {
  initSupabaseClient();
}
