import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export async function getSession() { if (!supabase) return null; const { data } = await supabase.auth.getSession(); return data.session; }
export async function signIn(email, password) { if (!supabase) throw new Error('Supabase no está configurado.'); return supabase.auth.signInWithPassword({ email, password }); }
export async function signOut() { return supabase?.auth.signOut(); }
export function onAuthStateChange(callback) { return supabase?.auth.onAuthStateChange((_event, session) => callback(session)); }
