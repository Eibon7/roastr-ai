/**
 * Refresh Token Service
 *
 * Uses Supabase client to refresh session tokens.
 * The Supabase JS SDK handles token refresh internally,
 * but this module is kept for compatibility with code that
 * explicitly triggers a refresh.
 */

import { supabase } from '../supabaseClient';
import { setTokens, clearTokens } from './tokenStorage';

export async function refreshAccessToken(): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    clearTokens();
    throw new Error(error?.message || 'Token refresh failed');
  }

  setTokens(data.session.access_token, data.session.refresh_token);

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
