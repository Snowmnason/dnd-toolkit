import { AuthContext } from '@/hooks/use-auth-context'
import { getSupabaseClient } from '@/lib/database/supabase'
import { logger } from '@/lib/utils/logger'
import type { Session } from '@supabase/supabase-js'
import { PropsWithChildren, useEffect, useState } from 'react'

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | undefined | null>()
  const [profile, setProfile] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Fetch the session once, and subscribe to auth state changes
  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true)
      const supabase = getSupabaseClient()
      if (!supabase) {
        logger.category('auth').warn('Supabase not configured for session fetch')
        setIsLoading(false)
        return
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        logger.category('auth').error('Failed to fetch session', { error: error.message })
      } else {
        logger.category('auth').debug('Session fetched', { hasSession: !!session, userId: session?.user.id })
      }

      setSession(session)
      setIsLoading(false)
    }

    fetchSession()

    const supabase = getSupabaseClient()
    if (!supabase) {
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (
        _event: import('@supabase/supabase-js').AuthChangeEvent,
        session: Session | null
      ) => {
        logger.category('auth').debug('Auth state changed', { event: _event, hasSession: !!session })
        setSession(session)
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Fetch the profile when the session changes
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)

      if (session) {
        try {
          const supabase = getSupabaseClient()
          if (!supabase) {
            logger.category('auth').warn('Supabase not configured for profile fetch')
            setIsLoading(false)
            return
          }

          const { data, error } = await supabase
            .from('users')  // Changed from 'profiles' to 'users'
            .select('*')
            .eq('auth_id', session.user.id)  // Changed from 'id' to 'auth_id'
            .single()

          if (error) {
            logger.category('auth').error('Failed to fetch profile', { error: error.message, userId: session.user.id })
          } else {
            logger.category('auth').debug('Profile fetched', { userId: session.user.id, hasProfile: !!data })
          }

          setProfile(data)
        } catch (error) {
          logger.category('auth').error('Unexpected error fetching profile', { error: String(error) })
        }
      } else {
        logger.category('auth').debug('No session, clearing profile')
        setProfile(null)
      }

      setIsLoading(false)
    }

    fetchProfile()
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        profile,
        isLoggedIn: session !== undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}