import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, Profile, logActivity } from '../lib/supabase'

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isSuperAdmin: boolean
  isAdmin: boolean
  isOperator: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, roles(*)')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as Profile)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      await fetchProfile(data.user.id)
      await logActivity(data.user.id, 'login', { description: 'User login' })
    }
    return { error: error as Error | null }
  }

  const signOut = async () => {
    if (user) {
      await logActivity(user.id, 'logout', { description: 'User logout' })
    }
    await supabase.auth.signOut()
    setProfile(null)
  }

  const roleName = (profile?.roles as { name?: string })?.name ?? ''
  const isSuperAdmin = roleName === 'super_admin'
  const isAdmin = ['super_admin', 'admin'].includes(roleName)
  const isOperator = ['super_admin', 'admin', 'operator'].includes(roleName)

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile, isSuperAdmin, isAdmin, isOperator }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
