import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabasePublishableKey &&
  !supabaseUrl.includes('your-project')

// Provide a safe fallback so imports never crash at module-load time.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!)
  : (new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        if (prop === 'from') {
          // Return a chainable no-op so `.from(...).select(...)` etc. won't throw
          const noop: any = () => noop
          noop.then = (resolve: any) => resolve({ data: null, error: { message: 'Supabase not configured' } })
          return () => noop
        }
        return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
      },
    }) as unknown as SupabaseClient)
