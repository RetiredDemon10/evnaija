import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppRole, OperatorProfile, Profile } from '@/types'
import { isPreviewMode } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { markGuestClaimed } from '@/services/bookings'
import { demoCredentials, demoProfiles, demoStore } from '@/data/demo'

interface AuthUser {
  id: string
  email: string
  profile: Profile
  roles: AppRole[]
  operatorProfile?: OperatorProfile | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isPreview: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUpCustomer: (input: {
    fullName: string
    email: string
    phone: string
    password: string
    referralCode?: string | null
  }) => Promise<{ error: string | null; needsVerification: boolean }>
  signUpOperator: (input: {
    businessName: string
    ownerName: string
    email: string
    phone: string
    businessAddress: string
    registrationNumber?: string
    businessDescription: string
    password: string
  }) => Promise<{ error: string | null; needsVerification: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
  enterPreview: (role: AppRole) => void
  exitPreview: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const PREVIEW_ROLE_KEY = 'evn.preview.role'

function previewUser(role: AppRole): AuthUser {
  if (role === 'admin') {
    return {
      id: demoProfiles.admin.id,
      email: demoProfiles.admin.email,
      profile: demoProfiles.admin,
      roles: ['admin'],
    }
  }
  if (role === 'operator') {
    return {
      id: demoProfiles.operator.id,
      email: demoProfiles.operator.email,
      profile: demoProfiles.operator,
      roles: ['operator'],
      operatorProfile: demoStore.operatorProfile,
    }
  }
  if (role === 'mechanic') {
    return {
      id: demoProfiles.mechanic.id,
      email: demoProfiles.mechanic.email,
      profile: demoProfiles.mechanic,
      roles: ['mechanic'],
    }
  }
  return {
    id: demoProfiles.customer.id,
    email: demoProfiles.customer.email,
    profile: demoProfiles.customer,
    roles: ['customer'],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadRealUser = useCallback(async () => {
    if (!supabase) {
      setUser(null)
      setLoading(false)
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) {
      setUser(null)
      setLoading(false)
      return
    }
    const [{ data: profile }, { data: roles }, { data: operatorProfile }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', session.user.id),
      supabase.from('operator_profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
    ])
    const roleList = ((roles ?? []) as { role: AppRole }[]).map((row) => row.role)
    setUser({
      id: session.user.id,
      email: session.user.email ?? '',
      profile:
        (profile as Profile | null) ?? {
          id: session.user.id,
          full_name: (session.user.user_metadata?.full_name as string) ?? session.user.email ?? 'EV Naija user',
          email: session.user.email ?? '',
          phone: (session.user.user_metadata?.phone as string) ?? null,
          avatar_url: null,
          home_address: null,
          preferred_city: null,
          preferred_state: null,
          is_suspended: false,
          created_at: session.user.created_at,
        },
      roles: roleList.length ? roleList : ['customer'],
      operatorProfile: (operatorProfile as OperatorProfile | null) ?? null,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isPreviewMode) {
      const stored = (localStorage.getItem(PREVIEW_ROLE_KEY) as AppRole | null) ?? null
      setUser(stored ? previewUser(stored) : null)
      setLoading(false)
      return
    }
    void loadRealUser()
    if (!supabase) return
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void loadRealUser()
      }
    })
    return () => subscription.subscription.unsubscribe()
  }, [loadRealUser])

  const signIn = useCallback(async (email: string, password: string) => {
    if (isPreviewMode) {
      const match = demoCredentials.find(
        (credential) => credential.email.toLowerCase() === email.trim().toLowerCase(),
      )
      if (!match || password !== match.password) {
        return {
          error:
            'Invalid preview credentials. Use one of the demo accounts below (password: Demo1234!).',
        }
      }
      localStorage.setItem(PREVIEW_ROLE_KEY, match.role)
      setUser(previewUser(match.role))
      return { error: null }
    }
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  const signUpCustomer = useCallback(
    async (input: { fullName: string; email: string; phone: string; password: string; referralCode?: string | null }) => {
      if (isPreviewMode) {
        localStorage.setItem(PREVIEW_ROLE_KEY, 'customer')
        setUser(previewUser('customer'))
        return { error: null, needsVerification: false }
      }
      if (!supabase) return { error: 'Supabase is not configured.', needsVerification: false }
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            phone: input.phone,
            account_type: 'customer',
            ...(input.referralCode ? { referral_code: input.referralCode } : {}),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) return { error: error.message, needsVerification: false }
      return { error: null, needsVerification: true }
    },
    [],
  )

  const signUpOperator = useCallback(
    async (input: {
      businessName: string
      ownerName: string
      email: string
      phone: string
      businessAddress: string
      registrationNumber?: string
      businessDescription: string
      password: string
    }) => {
      if (isPreviewMode) {
        localStorage.setItem(PREVIEW_ROLE_KEY, 'operator')
        setUser(previewUser('operator'))
        return { error: null, needsVerification: false }
      }
      if (!supabase) return { error: 'Supabase is not configured.', needsVerification: false }
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.ownerName,
            phone: input.phone,
            account_type: 'operator',
            business_name: input.businessName,
            business_address: input.businessAddress,
            business_registration_number: input.registrationNumber ?? '',
            business_description: input.businessDescription,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) return { error: error.message, needsVerification: false }
      // The on_auth_user_created trigger provisions the profile, role and
      // operator record using this metadata. The browser must not write these
      // identity rows directly.
      return { error: null, needsVerification: true }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (isPreviewMode) {
      localStorage.removeItem(PREVIEW_ROLE_KEY)
      setUser(null)
      return
    }
    await supabase?.auth.signOut()
    setUser(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (isPreviewMode) {
      return { error: 'Password reset requires a configured Supabase project.' }
    }
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (isPreviewMode) return { error: 'Password updates require a configured Supabase project.' }
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    // If a guest just set a password from their recovery link, promote the
    // profile from guest to a full account.
    try {
      await markGuestClaimed()
    } catch {
      /* claim marker is best-effort; the password change already succeeded */
    }
    return { error: null }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (isPreviewMode) return
    await loadRealUser()
  }, [loadRealUser])

  const enterPreview = useCallback((role: AppRole) => {
    localStorage.setItem(PREVIEW_ROLE_KEY, role)
    setUser(previewUser(role))
  }, [])

  const exitPreview = useCallback(() => {
    localStorage.removeItem(PREVIEW_ROLE_KEY)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isPreview: isPreviewMode,
      signIn,
      signUpCustomer,
      signUpOperator,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
      enterPreview,
      exitPreview,
    }),
    [
      user,
      loading,
      signIn,
      signUpCustomer,
      signUpOperator,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
      enterPreview,
      exitPreview,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
