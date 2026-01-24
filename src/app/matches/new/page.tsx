'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface User {
  id: string
  name: string | null
  email: string
}

interface Location {
  id: string
  name: string
  address?: string
  city?: string
}

interface ConflictWarning {
  userId: string
  conflicts: {
    type: string
    message: string
  }[]
}

export default function NewMatchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<ConflictWarning[]>([])
  const [showWarningModal, setShowWarningModal] = useState(false)

  // Form state
  const [scheduledAt, setScheduledAt] = useState('')
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [team1Player1, setTeam1Player1] = useState('')
  const [team1Player2, setTeam1Player2] = useState('')
  const [team2Player1, setTeam2Player1] = useState('')
  const [team2Player2, setTeam2Player2] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent, ignoreConflicts = false) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate all players are selected
    const players = [team1Player1, team1Player2, team2Player1, team2Player2]
    if (players.some((p) => !p)) {
      setError('Molimo odaberi sva 4 igraca')
      setLoading(false)
      return
    }

    // Check for duplicates
    const uniquePlayers = new Set(players)
    if (uniquePlayers.size !== 4) {
      setError('Svaki igrac moze biti odabran samo jednom')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt,
          locationId: locationId || null,
          notes,
          ignoreConflicts,
          players: [
            { userId: team1Player1, team: 1 },
            { userId: team1Player2, team: 1 },
            { userId: team2Player1, team: 2 },
            { userId: team2Player2, team: 2 },
          ],
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        // Conflict detected
        setWarnings([
          ...(data.criticalConflicts || []),
          ...(data.warnings || []),
        ])
        setShowWarningModal(true)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Greska pri kreiranju meca')
        setLoading(false)
        return
      }

      // Success - check for warnings
      if (data.warnings && data.warnings.length > 0) {
        // Show warnings but redirect anyway
        console.log('Match created with warnings:', data.warnings)
      }

      router.push(`/matches/${data.match?.id || data.id}`)
    } catch {
      setError('Greska pri kreiranju meca')
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user?.name || user?.email || 'Nepoznato'
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Ucitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Novi mec</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date and Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Datum i vrijeme</h2>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Lokacija</h2>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Odaberi lokaciju --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.city ? `(${loc.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Players */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Igraci</h2>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Pretrazi igrace..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team 1 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 text-blue-600">Tim 1</h3>
                <div className="space-y-3">
                  <select
                    value={team1Player1}
                    onChange={(e) => setTeam1Player1(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Igrac 1</option>
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={team1Player2}
                    onChange={(e) => setTeam1Player2(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Igrac 2</option>
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Team 2 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 text-red-600">Tim 2</h3>
                <div className="space-y-3">
                  <select
                    value={team2Player1}
                    onChange={(e) => setTeam2Player1(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Igrac 1</option>
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={team2Player2}
                    onChange={(e) => setTeam2Player2(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Igrac 2</option>
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Napomena (opcionalno)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Dodatne napomene o mecu..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj mec'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Odustani
            </button>
          </div>
        </form>
      </main>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4">
              Upozorenje - Konflikt u rasporedu
            </h3>
            <div className="space-y-3 mb-6">
              {warnings.map((warning, idx) => (
                <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="font-medium">{getUserName(warning.userId)}</div>
                  {warning.conflicts.map((conflict, cidx) => (
                    <div key={cidx} className="text-sm text-gray-600">
                      {conflict.message}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  setShowWarningModal(false)
                  handleSubmit(e, true)
                }}
                className="flex-1 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition"
              >
                Ipak kreiraj
              </button>
              <button
                onClick={() => setShowWarningModal(false)}
                className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
