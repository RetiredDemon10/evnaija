import type { AppNotification, Favorite, Profile, Station } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'
import { compressImage } from '@/lib/utils'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (isPreviewMode || !supabase) return demoStore.profile
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  if (isPreviewMode || !supabase) {
    Object.assign(demoStore.profile, patch)
    return demoStore.profile
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (isPreviewMode || !supabase) return URL.createObjectURL(file)
  const compressed = await compressImage(file, 600, 0.85)
  const path = `${userId}/avatar-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  await updateProfile(userId, { avatar_url: data.publicUrl })
  return data.publicUrl
}

export async function listFavorites(userId: string): Promise<Favorite[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.favorites
      .filter((f) => f.user_id === userId)
      .map((f) => ({
        ...f,
        station: demoStore.stations.find((s) => s.id === f.station_id),
      }))
  }
  const { data, error } = await supabase
    .from('favorites')
    .select('*, station:stations(*, station_images(*), chargers(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Favorite[]
}

export async function toggleFavorite(userId: string, stationId: string): Promise<boolean> {
  if (isPreviewMode || !supabase) {
    const existing = demoStore.favorites.find(
      (f) => f.user_id === userId && f.station_id === stationId,
    )
    if (existing) {
      demoStore.favorites = demoStore.favorites.filter((f) => f.id !== existing.id)
      return false
    }
    demoStore.favorites.push({
      id: `fav-${Date.now()}`,
      user_id: userId,
      station_id: stationId,
      created_at: new Date().toISOString(),
    })
    return true
  }
  const { data: existing, error: lookupError } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('station_id', stationId)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (existing) {
    const { error } = await supabase.from('favorites').delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    return false
  }
  const { error } = await supabase.from('favorites').insert({ user_id: userId, station_id: stationId })
  if (error) throw new Error(error.message)
  return true
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markNotificationRead(userId: string, id: string) {
  if (isPreviewMode || !supabase) {
    const notification = demoStore.notifications.find((n) => n.id === id)
    if (notification) notification.is_read = true
    return
  }
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(userId: string) {
  if (isPreviewMode || !supabase) {
    demoStore.notifications.filter((n) => n.user_id === userId).forEach((n) => (n.is_read = true))
    return
  }
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
}

export async function subscribeToNotifications(userId: string, onChange: () => void) {
  if (isPreviewMode || !supabase) return () => {}
  const client = supabase
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

export function stationsForFavorites(favorites: Favorite[]): Station[] {
  return favorites.map((f) => f.station).filter((s): s is Station => Boolean(s))
}
