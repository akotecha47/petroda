import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('users')
    .select('id, full_name, role, station_id')
    .eq('id', userId)
    .single()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Single source of truth for initial auth state
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!error && data.session) {
        setSession(data.session)
        setUser(await fetchProfile(data.session.user.id))
      }
      setLoading(false)
    })

    // Listener only for session lifecycle events — no profile fetching here
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, setSession, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

export { fetchProfile }
