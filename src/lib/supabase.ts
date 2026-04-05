import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Role = {
  id: string
  name: 'super_admin' | 'admin' | 'operator' | 'viewer'
  description: string
  created_at: string
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  roles?: Role
}

export type InspeksiBarang = {
  id: string
  id_barang: string
  waktu_masuk: string
  logam: boolean
  organik: boolean
  cairan: boolean
  sintetis: boolean
  foto_url: string | null
  raw_stats: Record<string, unknown> | null
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  catatan: string | null
  profiles?: Profile
}

export type UserActivity = {
  id: string
  user_id: string | null
  action: string
  target_table: string | null
  target_id: string | null
  description: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  profiles?: Profile
}

// Log user activity helper
export async function logActivity(
  userId: string,
  action: string,
  options?: {
    targetTable?: string
    targetId?: string
    description?: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await supabase.from('user_activities').insert({
      user_id: userId,
      action,
      target_table: options?.targetTable,
      target_id: options?.targetId,
      description: options?.description,
      user_agent: navigator.userAgent,
      metadata: options?.metadata,
    })
  } catch (e) {
    console.error('Failed to log activity:', e)
  }
}
