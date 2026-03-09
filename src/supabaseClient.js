import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kpgcnqvlfbxhhtyhfxop.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwZ2NucXZsZmJ4aGh0eWhmeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDcyMjEsImV4cCI6MjA4NjkyMzIyMX0.WvkDzO0nVptXtxd-dXn_bcR4ZeKjsJklavWe1nERGKs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})
