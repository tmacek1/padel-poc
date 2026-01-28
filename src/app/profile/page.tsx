'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface UserProfile {
  id: string
  name: string | null
  email: string
  image: string | null
  createdAt: string
  gender: string | null
  dominantHand: string | null
  preferredCourtSide: string | null
  club: { id: string; name: string } | null
  locations: {
    id: string
    isPrimary: boolean
    location: { id: string; name: string; city: string | null }
  }[]
}

interface Location {
  id: string
  name: string
  city: string | null
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form
  const [editName, setEditName] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile()
      fetchLocations()
    }
  }, [session])

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/users/${session?.user?.id}/profile`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setEditName(data.name || '')
        setSelectedLocations(data.locations?.map((l: { location: { id: string } }) => l.location.id) || [])
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${session?.user?.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          locationIds: selectedLocations,
        }),
      })

      if (res.ok) {
        await fetchProfile()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700">Ucitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Moj profil</h1>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {/* Avatar */}
            <div className="flex items-center mb-6">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || '?'}
                </div>
              )}
              <div className="ml-4">
                <div className="text-xl font-semibold">
                  {profile?.name || session?.user?.name || 'Bez imena'}
                </div>
                <div className="text-gray-700">{session?.user?.email}</div>
              </div>
            </div>

            {editing ? (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ime i prezime
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                {/* Locations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Omiljena lokacija
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {locations.map((loc) => (
                      <label key={loc.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(loc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLocations([...selectedLocations, loc.id])
                            } else {
                              setSelectedLocations(
                                selectedLocations.filter((id) => id !== loc.id)
                              )
                            }
                          }}
                          className="mr-2"
                        />
                        {loc.name} {loc.city && `(${loc.city})`}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Spremanje...' : 'Spremi'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Odustani
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <div className="text-sm text-gray-700">Email</div>
                  <div className="font-medium text-gray-900">
                    {profile?.email}
                  </div>
                </div>

                {/* Dominant Hand */}
                <div>
                  <div className="text-sm text-gray-700">Dominantna ruka</div>
                  <div className="font-medium text-gray-900">
                    {profile?.dominantHand === 'left' ? 'Lijeva' : profile?.dominantHand === 'right' ? 'Desna' : 'Nije određeno'}
                  </div>
                </div>

                {/* Preferred Court Side */}
                <div>
                  <div className="text-sm text-gray-700">Preferirana strana terena</div>
                  <div className="font-medium text-gray-900">
                    {profile?.preferredCourtSide === 'left' ? 'Lijeva (Reves)' : profile?.preferredCourtSide === 'right' ? 'Desna (Drive)' : 'Nije određeno'}
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <div className="text-sm text-gray-700">Spol</div>
                  <div className="font-medium text-gray-900">
                    {profile?.gender === 'male' ? 'Muško' : profile?.gender === 'female' ? 'Žensko' : 'Nije određeno'}
                  </div>
                </div>

                {/* Club */}
                <div>
                  <div className="text-sm text-gray-700">Klub</div>
                  <div className="font-medium text-gray-900">
                    {profile?.club?.name || 'Nije učlanjen'}
                  </div>
                </div>

                {/* Locations */}
                <div>
                  <div className="text-sm text-gray-700">Omiljena lokacija</div>
                  <div className="font-medium text-gray-900">
                    {profile?.locations && profile.locations.length > 0
                      ? profile.locations
                          .map((l) => l.location.name)
                          .join(', ')
                      : 'Nije određeno'}
                  </div>
                </div>

                {/* Registration date */}
                <div>
                  <div className="text-sm text-gray-700">Datum registracije</div>
                  <div className="font-medium text-gray-900">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('hr-HR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '-'}
                  </div>
                </div>

                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Uredi profil
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
