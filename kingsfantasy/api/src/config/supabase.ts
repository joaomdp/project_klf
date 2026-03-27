import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env from multiple possible locations
dotenv.config(); // Current directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // From src/config/
dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // From cwd

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Missing Supabase credentials! Check your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

if (!supabaseServiceKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is required in production! Admin operations will fail without it.');
  }
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set. Admin operations may be limited by RLS.');
}

export const adminSupabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase;

