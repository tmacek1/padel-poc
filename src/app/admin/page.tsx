'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  isAdmin?: boolean
  createdAt?: string
  club?: { id: string; name: string } | null
}

interface Location {
  id: string
  name: string
  address: string | null
  city: string | null
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  // New location form
  const [showNewLocationForm, setShowNewLocationForm] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationAddress, setNewLocationAddress] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)

  // Edit location
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editLocationName, setEditLocationName] = useState('')
  const [editLocationAddress, setEditLocationAddress] = useState('')
  const [editLocationCity, setEditLocationCity] = useState('')
  const [updatingLocation, setUpdatingLocation] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) {
      router.push('/dashboard')
      return
    }
    fetchUsers()
    fetchLocations()
  }, [status, session, router])

  async function fetchUsers() {
    try {
      // Fetch 5 most recently registered users
      const res = await fetch('/api/users?limit=5&sortBy=createdAt')
      if (!res.ok) throw new Error('Greska pri dohvacanju korisnika')
      const data = await res.json()
      setRecentUsers(data)
    } catch {
      setError('Greska pri dohvacanju korisnika')
    } finally {
      setLoading(false)
    }
  }

  async function searchUsers(query: string) {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=20`)
      if (!res.ok) throw new Error('Greska pri pretrazi')
      const data = await res.json()
      setSearchResults(data)
    } catch {
      setError('Greska pri pretrazi korisnika')
    } finally {
      setSearching(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  async function fetchLocations() {
    try {
      const res = await fetch('/api/locations')
      if (!res.ok) throw new Error('Greska pri dohvacanju lokacija')
      const data = await res.json()
      setLocations(data)
    } catch {
      console.error('Error fetching locations')
    }
  }

  async function deleteLocation(locationId: string) {
    if (!confirm('Jesi li siguran da želiš obrisati ovu lokaciju?')) return

    setDeletingLocationId(locationId)
    setError(null)

    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Greška pri brisanju lokacije')
      }

      setLocations((prev) => prev.filter((loc) => loc.id !== locationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepoznata greška')
    } finally {
      setDeletingLocationId(null)
    }
  }

  async function handleCreateLocation() {
    if (!newLocationName.trim()) {
      setError('Naziv lokacije je obavezan')
      return
    }
    if (!newLocationAddress.trim()) {
      setError('Adresa je obavezna')
      return
    }
    if (!newLocationCity.trim()) {
      setError('Grad je obavezan')
      return
    }

    setSavingLocation(true)
    setError(null)

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

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Greška pri kreiranju lokacije')
      }

      const newLocation = await res.json()
      setLocations((prev) => [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name)))
      setShowNewLocationForm(false)
      setNewLocationName('')
      setNewLocationAddress('')
      setNewLocationCity('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepoznata greška')
    } finally {
      setSavingLocation(false)
    }
  }

  function startEditingLocation(location: Location) {
    setEditingLocationId(location.id)
    setEditLocationName(location.name)
    setEditLocationAddress(location.address || '')
    setEditLocationCity(location.city || '')
    setError(null)
  }

  function cancelEditingLocation() {
    setEditingLocationId(null)
    setEditLocationName('')
    setEditLocationAddress('')
    setEditLocationCity('')
  }

  async function handleUpdateLocation() {
    if (!editingLocationId) return

    if (!editLocationName.trim()) {
      setError('Naziv lokacije je obavezan')
      return
    }
    if (!editLocationAddress.trim()) {
      setError('Adresa je obavezna')
      return
    }
    if (!editLocationCity.trim()) {
      setError('Grad je obavezan')
      return
    }

    setUpdatingLocation(true)
    setError(null)

    try {
      const res = await fetch(`/api/locations/${editingLocationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editLocationName.trim(),
          address: editLocationAddress.trim(),
          city: editLocationCity.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Greška pri ažuriranju lokacije')
      }

      const updatedLocation = await res.json()
      setLocations((prev) =>
        prev.map((loc) => (loc.id === editingLocationId ? updatedLocation : loc))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      cancelEditingLocation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepoznata greška')
    } finally {
      setUpdatingLocation(false)
    }
  }

  async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
    setTogglingId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/users/${userId}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Greska pri promjeni admin statusa')
      }

      const updatedUser = await res.json()
      // Update both recent users and search results
      const updateUserInList = (prev: User[]) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isAdmin: updatedUser.isAdmin } : u
        )
      setRecentUsers(updateUserInList)
      setSearchResults(updateUserInList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepoznata greska')
    } finally {
      setTogglingId(null)
    }
  }

  // Helper to format date
  function formatDate(dateStr?: string) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="max-w-4xl mx-auto p-6">
          <p className="text-gray-700">Ucitavanje...</p>
        </div>
      </div>
    )
  }

  if (!session?.user?.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Upravljanje korisnicima</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pretraži korisnike
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Upiši ime ili email..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searching && (
              <span className="absolute right-3 top-2.5 text-sm text-gray-500">Tražim...</span>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <h3 className="font-medium text-gray-900">Rezultati pretrage ({searchResults.length})</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Korisnik</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Registriran</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Akcija</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchResults.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.image && !imageErrors.has(user.id) ? (
                          <img src={user.image} alt="" className="w-8 h-8 rounded-full mr-3" onError={() => setImageErrors(prev => new Set(prev).add(user.id))} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">{user.name?.[0] || user.email[0]}</div>
                        )}
                        <span className="font-medium text-gray-900">{user.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isAdmin ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Da</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800">Ne</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.id === session.user.id ? (
                        <span className="text-gray-600 text-sm font-medium">Vi</span>
                      ) : (
                        <button
                          onClick={() => toggleAdmin(user.id, !!user.isAdmin)}
                          disabled={togglingId === user.id}
                          className={`px-3 py-1 rounded text-sm font-medium ${user.isAdmin ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} disabled:opacity-50`}
                        >
                          {togglingId === user.id ? '...' : user.isAdmin ? 'Ukloni admina' : 'Postavi admina'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !searching && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 text-center text-gray-600">
            Nema rezultata za &quot;{searchQuery}&quot;
          </div>
        )}

        {/* Recent Users Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Zadnje registrirani korisnici</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Korisnik</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Registriran</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Akcija</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.image && !imageErrors.has(user.id) ? (
                        <img src={user.image} alt="" className="w-8 h-8 rounded-full mr-3" onError={() => setImageErrors(prev => new Set(prev).add(user.id))} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">{user.name?.[0] || user.email[0]}</div>
                      )}
                      <span className="font-medium text-gray-900">{user.name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-800">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isAdmin ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Da</span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800">Ne</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.id === session.user.id ? (
                      <span className="text-gray-600 text-sm font-medium">Vi</span>
                    ) : (
                      <button
                        onClick={() => toggleAdmin(user.id, !!user.isAdmin)}
                        disabled={togglingId === user.id}
                        className={`px-3 py-1 rounded text-sm font-medium ${user.isAdmin ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} disabled:opacity-50`}
                      >
                        {togglingId === user.id ? '...' : user.isAdmin ? 'Ukloni admina' : 'Postavi admina'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Locations Management Section */}
        <h2 className="text-2xl font-bold mb-6 mt-12 text-gray-900">Upravljanje lokacijama</h2>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <span className="text-sm text-gray-600">{locations.length} lokacija</span>
            <button
              onClick={() => setShowNewLocationForm(!showNewLocationForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              {showNewLocationForm ? 'Odustani' : '+ Nova lokacija'}
            </button>
          </div>

          {/* New location form */}
          {showNewLocationForm && (
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Naziv *</label>
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="npr. Padel Zagreb"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresa *</label>
                  <input
                    type="text"
                    value={newLocationAddress}
                    onChange={(e) => setNewLocationAddress(e.target.value)}
                    placeholder="npr. Ulica grada Vukovara 123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grad *</label>
                  <input
                    type="text"
                    value={newLocationCity}
                    onChange={(e) => setNewLocationCity(e.target.value)}
                    placeholder="npr. Zagreb"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateLocation}
                disabled={savingLocation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
              >
                {savingLocation ? 'Kreiranje...' : 'Kreiraj lokaciju'}
              </button>
            </div>
          )}

          {locations.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Nema lokacija. Klikni &quot;+ Nova lokacija&quot; za dodavanje.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Naziv
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Adresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Grad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Akcija
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr key={location.id}>
                    {editingLocationId === location.id ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editLocationName}
                            onChange={(e) => setEditLocationName(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editLocationAddress}
                            onChange={(e) => setEditLocationAddress(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editLocationCity}
                            onChange={(e) => setEditLocationCity(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateLocation}
                              disabled={updatingLocation}
                              className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                            >
                              {updatingLocation ? '...' : 'Spremi'}
                            </button>
                            <button
                              onClick={cancelEditingLocation}
                              className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              Odustani
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900">{location.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                          {location.address || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                          {location.city || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingLocation(location)}
                              className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Uredi
                            </button>
                            <button
                              onClick={() => deleteLocation(location.id)}
                              disabled={deletingLocationId === location.id}
                              className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              {deletingLocationId === location.id ? '...' : 'Obriši'}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
