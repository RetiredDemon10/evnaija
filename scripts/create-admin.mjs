#!/usr/bin/env node
/**
 * Provision an EV Naija administrator using the Supabase service role.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD='a-long-unique-password' \
 *   ADMIN_NAME='Ada Admin' \
 *   npm run seed:admin
 *
 * The script reads SUPABASE_URL / VITE_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from the environment, or from .env.local / .env.
 * It never prints the service key or password.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const contents = fs.readFileSync(file, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFile(path.resolve(process.cwd(), '.env'))

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const email = (arg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = arg('password') || process.env.ADMIN_PASSWORD || ''
const fullName = (arg('name') || process.env.ADMIN_NAME || '').trim()

if (!url || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in the environment or in .env.local. Never commit the service role key.',
  )
  process.exit(1)
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Provide a valid admin email via ADMIN_EMAIL or --email.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('Provide ADMIN_PASSWORD or --password with at least 12 characters.')
  process.exit(1)
}
if (!fullName) {
  console.error('Provide ADMIN_NAME or --name for the administrator profile.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === target)
    if (found) return found
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  console.log(`Provisioning administrator ${email} on ${url}`)

  let user = await findUserByEmail(email)
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        account_type: 'admin',
      },
    })
    if (error) throw error
    user = data.user
    console.log('Created Supabase auth user.')
  } else {
    console.log('Supabase auth user already exists; promoting it to administrator.')
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata ?? {}), full_name: fullName },
    })
    if (error) throw error
  }

  if (!user) throw new Error('Could not create or locate the auth user.')

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: fullName,
      email,
    },
    { onConflict: 'id' },
  )
  if (profileError) throw profileError

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert(
      { user_id: user.id, role: 'admin' },
      { onConflict: 'user_id,role', ignoreDuplicates: true },
    )
  if (roleError) throw roleError

  console.log('Administrator ready. Sign in at /login and open /admin.')
  console.log(`User ID: ${user.id}`)
}

main().catch((error) => {
  console.error('Admin provisioning failed:', error.message ?? error)
  process.exit(1)
})
