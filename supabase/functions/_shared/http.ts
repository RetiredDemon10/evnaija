export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function optionsResponse() {
  return new Response('ok', { headers: corsHeaders })
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment secret: ${name}`)
  return value
}

export function appUrl() {
  return (
    Deno.env.get('APP_URL') ??
    Deno.env.get('SITE_URL') ??
    'http://localhost:5173'
  ).replace(/\/$/, '')
}

export function methodNotAllowed() {
  return json({ error: 'Method not allowed.' }, 405)
}
