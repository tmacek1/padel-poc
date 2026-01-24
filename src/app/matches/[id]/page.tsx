'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface MatchSet {
  id?: string
  setNumber: number
  team1Score: number
  team2Score: number
  team1Tiebreak?: number | null
  team2Tiebreak?: number | null
}

interface Match {
  id: string
  scheduledAt: string
  playedAt: string | null
  status: string
  notes: string | null
  creatorId: string
  canEdit: boolean
  location?: { id: string; name: string }
  creator: { id: string; name: string; email: string }
  players: {
    id: string
    team: number
    user: { id: string; name: string; email: string; image?: string }
  }[]
  sets: MatchSet[]
  league?: { id: string; name: string }
}

export default function MatchDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit form state
  const [editStatus, setEditStatus] = useState('')
  const [editSets, setEditSets] = useState<MatchSet[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session && matchId) {
      fetchMatch()
    }
  }, [session, matchId])

  const fetchMatch = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`)
      const data = await res.json()

      if (res.ok) {
        setMatch(data)
        setEditStatus(data.status)
        setEditSets(
          data.sets.length > 0
            ? data.sets
            : [
                { setNumber: 1, team1Score: 0, team2Score: 0 },
                { setNumber: 2, team1Score: 0, team2Score: 0 },
                { setNumber: 3, team1Score: 0, team2Score: 0 },
              ]
        )
      } else {
        setError(data.error || 'Mec nije pronaden')
      }
    } catch (error) {
      console.error('Error fetching match:', error)
      setError('Greska pri ucitavanju meca')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          sets: editSets.filter(
            (s) => s.team1Score > 0 || s.team2Score > 0
          ),
          playedAt: editStatus === 'completed' ? new Date().toISOString() : null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMatch({ ...data, canEdit: match?.canEdit })
        setEditing(false)
      } else {
        setError(data.error || 'Greska pri spremanju')
      }
    } catch {
      setError('Greska pri spremanju')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Jesi li siguran da zelis obrisati ovaj mec?')) return

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/matches')
      } else {
        const data = await res.json()
        setError(data.error || 'Greska pri brisanju')
      }
    } catch {
      setError('Greska pri brisanju')
    }
  }

  const updateSetScore = (
    setIndex: number,
    team: 'team1Score' | 'team2Score',
    value: number
  ) => {
    const newSets = [...editSets]
    newSets[setIndex] = { ...newSets[setIndex], [team]: value }
    setEditSets(newSets)
  }

  const getTeamPlayers = (team: number) => {
    return match?.players
      .filter((p) => p.team === team)
      .map((p) => p.user.name || p.user.email)
      .join(' / ')
  }

  const getMatchScore = () => {
    if (!match || match.sets.length === 0) return null
    let team1Sets = 0
    let team2Sets = 0
    match.sets.forEach((set) => {
      if (set.team1Score > set.team2Score) team1Sets++
      else if (set.team2Score > set.team1Score) team2Sets++
    })
    return { team1Sets, team2Sets }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Ucitavanje...</div>
        </div>
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    )
  }

  if (!match) return null

  const score = getMatchScore()

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h1>
                <div className="text-gray-500">
                  {new Date(match.scheduledAt).toLocaleTimeString('hr-HR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {match.location && ` - ${match.location.name}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    match.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-800'
                      : match.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {match.status === 'scheduled'
                    ? 'Zakazan'
                    : match.status === 'completed'
                    ? 'Zavrseno'
                    : match.status}
                </span>
              </div>
            </div>

            {/* Creator info */}
            <div className="text-sm text-gray-500">
              Kreirao: {match.creator.name || match.creator.email}
              {match.canEdit && ' (ti)'}
            </div>
          </div>
        </div>

        {/* Score Display */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              {/* Team 1 */}
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-blue-600 mb-2">Tim 1</div>
                <div className="text-xl">{getTeamPlayers(1)}</div>
                {score && (
                  <div className="text-4xl font-bold mt-4">{score.team1Sets}</div>
                )}
              </div>

              {/* VS */}
              <div className="px-8">
                <div className="text-2xl text-gray-400">vs</div>
              </div>

              {/* Team 2 */}
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-red-600 mb-2">Tim 2</div>
                <div className="text-xl">{getTeamPlayers(2)}</div>
                {score && (
                  <div className="text-4xl font-bold mt-4">{score.team2Sets}</div>
                )}
              </div>
            </div>

            {/* Set scores */}
            {match.sets.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-center text-gray-500 mb-3">Setovi</div>
                <div className="flex justify-center gap-4">
                  {match.sets.map((set) => (
                    <div
                      key={set.setNumber}
                      className="bg-gray-100 rounded px-4 py-2 text-center"
                    >
                      <div className="text-xs text-gray-500">Set {set.setNumber}</div>
                      <div className="font-semibold">
                        {set.team1Score} - {set.team2Score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Section (only for creator) */}
        {match.canEdit && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Upravljanje mecom</h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Uredi rezultat
                  </button>
                )}
              </div>

              {editing && (
                <div className="space-y-6">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status meca
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="scheduled">Zakazan</option>
                      <option value="in_progress">U tijeku</option>
                      <option value="completed">Zavrseno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  </div>

                  {/* Set Scores */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rezultat po setovima
                    </label>
                    <div className="space-y-3">
                      {editSets.map((set, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="w-16 text-gray-500">Set {set.setNumber}</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={set.team1Score}
                            onChange={(e) =>
                              updateSetScore(idx, 'team1Score', parseInt(e.target.value) || 0)
                            }
                            className="w-20 px-3 py-2 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={set.team2Score}
                            onChange={(e) =>
                              updateSetScore(idx, 'team2Score', parseInt(e.target.value) || 0)
                            }
                            className="w-20 px-3 py-2 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save/Cancel buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {saving ? 'Spremanje...' : 'Spremi'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="border border-gray-300 px-6 py-2 rounded hover:bg-gray-50 transition"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}

              {!editing && (
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Obrisi mec
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {match.notes && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-2">Napomena</h2>
              <p className="text-gray-600">{match.notes}</p>
            </div>
          </div>
        )}

        {/* League info */}
        {match.league && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-2">Liga</h2>
              <p className="text-gray-600">{match.league.name}</p>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="mt-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline"
          >
            &larr; Natrag
          </button>
        </div>
      </main>
    </div>
  )
}
