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
    location: { id: string; name: string; address: string | null; city: string | null }
  }[]
}

interface Location {
  id: string
  name: string
  address?: string | null
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
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [editDominantHand, setEditDominantHand] = useState('')
  const [editPreferredSide, setEditPreferredSide] = useState('')
  const [editClubName, setEditClubName] = useState('')
  const [imageError, setImageError] = useState(false)

  // New location form
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationAddress, setNewLocationAddress] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')

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
        setSelectedLocationId(data.locations?.[0]?.location?.id || '')
        setEditDominantHand(data.dominantHand || '')
        setEditPreferredSide(data.preferredCourtSide || '')
        setEditClubName(data.club?.name || '')
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
          locationId: selectedLocationId || null,
          dominantHand: editDominantHand || null,
          preferredCourtSide: editPreferredSide || null,
          clubName: editClubName || null,
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

  const handleSaveNewLocation = async () => {
    if (!newLocationName.trim()) {
      setLocationError('Naziv lokacije je obavezan')
      return
    }
    if (!newLocationAddress.trim()) {
      setLocationError('Adresa je obavezna')
      return
    }
    if (!newLocationCity.trim()) {
      setLocationError('Grad je obavezan')
      return
    }

    setSavingLocation(true)
    setLocationError('')

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocationName.trim(),
          address: newLocationAddress.trim(),
          city: newLocationCity.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Add to locations and select it
        setLocations([...locations, data])
        setSelectedLocationId(data.id)
        setShowNewLocation(false)
        setNewLocationName('')
        setNewLocationAddress('')
        setNewLocationCity('')
      } else {
        setLocationError(data.error || 'Greška pri kreiranju lokacije')
      }
    } catch {
      setLocationError('Greška pri kreiranju lokacije')
    } finally {
      setSavingLocation(false)
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
              {session?.user?.image && !imageError ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-20 h-20 rounded-full"
                  onError={() => setImageError(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || '?'}
                </div>
              )}
              <div className="ml-4">
                <div className="text-xl font-semibold text-gray-900">
                  {profile?.name || session?.user?.name || 'Bez imena'}
                </div>
                <div className="text-gray-700">{session?.user?.email}</div>
              </div>
            </div>

            {editing ? (
              <div className="space-y-4">
                {/* Dominant Hand */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dominantna ruka
                  </label>
                  <select
                    value={editDominantHand}
                    onChange={(e) => setEditDominantHand(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">-- Odaberi --</option>
                    <option value="right">Desna</option>
                    <option value="left">Lijeva</option>
                  </select>
                </div>

                {/* Preferred Court Side */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferirana strana terena
                  </label>
                  <select
                    value={editPreferredSide}
                    onChange={(e) => setEditPreferredSide(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">-- Odaberi --</option>
                    <option value="left">Lijeva (Reves)</option>
                    <option value="right">Desna (Drive)</option>
                  </select>
                </div>

                {/* Club */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klub
                  </label>
                  <input
                    type="text"
                    value={editClubName}
                    onChange={(e) => setEditClubName(e.target.value)}
                    placeholder="Upiši ime kluba"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                {/* Location */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Omiljena lokacija
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewLocation(!showNewLocation)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showNewLocation ? 'Otkaži' : '+ Nova lokacija'}
                    </button>
                  </div>

                  {showNewLocation ? (
                    <div className="space-y-4 p-4 bg-gray-50 border rounded-lg">
                      {locationError && (
                        <div className="text-sm text-red-600">{locationError}</div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Naziv padel centra *
                        </label>
                        <input
                          type="text"
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          placeholder="npr. Padel Zagreb"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adresa *
                        </label>
                        <input
                          type="text"
                          value={newLocationAddress}
                          onChange={(e) => setNewLocationAddress(e.target.value)}
                          placeholder="npr. Ulica grada Vukovara 123"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Grad *
                        </label>
                        <input
                          type="text"
                          value={newLocationCity}
                          onChange={(e) => setNewLocationCity(e.target.value)}
                          placeholder="npr. Zagreb"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveNewLocation}
                        disabled={savingLocation}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {savingLocation ? 'Spremanje...' : 'Spremi lokaciju'}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="">-- Bez lokacije --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}{loc.city ? ` (${loc.city})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
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
                    className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition"
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

                {/* Location */}
                <div>
                  <div className="text-sm text-gray-700">Omiljena lokacija</div>
                  {profile?.locations && profile.locations.length > 0 ? (
                    <div>
                      <div className="font-medium text-gray-900">{profile.locations[0].location.name}</div>
                      {(profile.locations[0].location.address || profile.locations[0].location.city) && (
                        <div className="text-sm text-gray-600">
                          {profile.locations[0].location.address}{profile.locations[0].location.address && profile.locations[0].location.city && ', '}{profile.locations[0].location.city}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="font-medium text-gray-900">Nije određeno</div>
                  )}
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
