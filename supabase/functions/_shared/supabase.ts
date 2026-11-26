import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.47.10'
import { requireEnv } from './http.ts'

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cached) return cached
  cached = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  return cached
}

function bearerToken(req: Request): string {
  const header = req.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    throw new Error('Missing authorization token.')
  }
  return header.slice('Bearer '.length)
}

export async function requireUser(req: Request): Promise<User> {
  const token = bearerToken(req)
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) throw new Error('Your session is invalid or has expired.')
  return data.user
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req)
  const { data, error } = await adminClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Administrator access is required.')
  return user
}
