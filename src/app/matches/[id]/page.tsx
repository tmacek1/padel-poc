'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface PlayerPosition {
  id: string
  matchSetId: string
  userId: string
  courtSide: string
}

interface MatchSet {
  id?: string
  setNumber: number
  team1Score: number
  team2Score: number
  team1Tiebreak?: number | null
  team2Tiebreak?: number | null
  playerPositions?: PlayerPosition[]
}

interface Match {
  id: string
  scheduledAt: string
  playedAt: string | null
  status: string
  notes: string | null
  creatorId: string
  canEdit: boolean
  isParticipant: boolean
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

// Valid tennis set scores
const VALID_SET_SCORES = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 7], [6, 7],
]

function isValidSetScore(team1: number, team2: number): boolean {
  return VALID_SET_SCORES.some(([a, b]) => a === team1 && b === team2)
}

function isTiebreakScore(team1: number, team2: number): boolean {
  return (team1 === 7 && team2 === 6) || (team1 === 6 && team2 === 7)
}

function isValidTiebreakScore(winner: number, loser: number): boolean {
  // Tiebreak must be won by 2 points, minimum 7 points to win
  if (winner < 7) return false
  if (winner - loser < 2) return false
  if (loser < 0) return false
  return true
}

function getSetScoreOptions() {
  const options: { label: string; t1: number; t2: number }[] = []
  VALID_SET_SCORES.forEach(([t1, t2]) => {
    options.push({ label: `${t1} - ${t2}`, t1, t2 })
  })
  return options
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
  const [savingPosition, setSavingPosition] = useState<string | null>(null)
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
            : [{ setNumber: 1, team1Score: 0, team2Score: 0 }]
        )
      } else {
        setError(data.error || 'Match nije pronađen')
      }
    } catch (error) {
      console.error('Error fetching match:', error)
      setError('Greška pri učitavanju matcha')
    } finally {
      setLoading(false)
    }
  }

  const validateSets = (): string | null => {
    const filledSets = editSets.filter(s => s.team1Score > 0 || s.team2Score > 0)

    for (const set of filledSets) {
      if (!isValidSetScore(set.team1Score, set.team2Score)) {
        return `Neispravan rezultat seta ${set.setNumber}: ${set.team1Score}-${set.team2Score}. Unesite validan teniski rezultat (npr. 6-4, 7-5, 7-6).`
      }
      // Validate tiebreak if it's a 7-6 score
      if (isTiebreakScore(set.team1Score, set.team2Score)) {
        const tb1 = set.team1Tiebreak ?? 0
        const tb2 = set.team2Tiebreak ?? 0
        if (tb1 === 0 && tb2 === 0) {
          return `Set ${set.setNumber} završio je 7-6, molimo unesite rezultat tiebreaka.`
        }
        const winner = set.team1Score === 7 ? tb1 : tb2
        const loser = set.team1Score === 7 ? tb2 : tb1
        if (!isValidTiebreakScore(winner, loser)) {
          return `Neispravan tiebreak rezultat u setu ${set.setNumber}. Pobjednik mora imati min. 7 bodova i 2 boda prednosti.`
        }
      }
    }

    return null
  }

  const addSet = () => {
    const newSetNumber = editSets.length + 1
    setEditSets([...editSets, { setNumber: newSetNumber, team1Score: 0, team2Score: 0 }])
  }

  const removeSet = (index: number) => {
    if (editSets.length <= 1) return
    const newSets = editSets.filter((_, i) => i !== index)
    // Renumber sets
    const renumbered = newSets.map((s, i) => ({ ...s, setNumber: i + 1 }))
    setEditSets(renumbered)
  }

  const handleSave = async () => {
    // Validate scores
    const validationError = validateSets()
    if (validationError) {
      setError(validationError)
      return
    }

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
        setError(data.error || 'Greška pri spremanju')
      }
    } catch {
      setError('Greška pri spremanju')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Jesi li siguran da želiš obrisati ovaj match?')) return

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/matches')
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri brisanju')
      }
    } catch {
      setError('Greška pri brisanju')
    }
  }

  const handleSetCourtSide = async (setId: string, courtSide: string) => {
    setSavingPosition(setId)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId, courtSide }),
      })

      if (res.ok) {
        // Refresh match data to show updated positions
        await fetchMatch()
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri postavljanju pozicije')
      }
    } catch {
      setError('Greška pri postavljanju pozicije')
    } finally {
      setSavingPosition(null)
    }
  }

  const getMyPositionForSet = (set: MatchSet): string | null => {
    if (!set.playerPositions || !session?.user?.id) return null
    const pos = set.playerPositions.find(p => p.userId === session.user.id)
    return pos?.courtSide || null
  }

  const getPlayerPositionsForSet = (set: MatchSet) => {
    if (!set.playerPositions || !match) return { left: [], right: [] }

    const left: string[] = []
    const right: string[] = []

    set.playerPositions.forEach(pos => {
      const player = match.players.find(p => p.user.id === pos.userId)
      const name = player?.user.name || player?.user.email || 'Nepoznato'
      if (pos.courtSide === 'left') left.push(name)
      else if (pos.courtSide === 'right') right.push(name)
    })

    return { left, right }
  }

  const updateSetScore = (setIndex: number, scoreString: string) => {
    const [t1, t2] = scoreString.split('-').map(s => parseInt(s.trim()))
    const newSets = [...editSets]
    const isTiebreak = isTiebreakScore(t1, t2)
    newSets[setIndex] = {
      ...newSets[setIndex],
      team1Score: t1 || 0,
      team2Score: t2 || 0,
      // Clear tiebreak if not a 7-6 score
      team1Tiebreak: isTiebreak ? newSets[setIndex].team1Tiebreak : null,
      team2Tiebreak: isTiebreak ? newSets[setIndex].team2Tiebreak : null,
    }
    setEditSets(newSets)
  }

  const updateTiebreakScore = (setIndex: number, team: 1 | 2, value: string) => {
    const numValue = parseInt(value) || 0
    const newSets = [...editSets]
    if (team === 1) {
      newSets[setIndex] = { ...newSets[setIndex], team1Tiebreak: numValue }
    } else {
      newSets[setIndex] = { ...newSets[setIndex], team2Tiebreak: numValue }
    }
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Učitavanje...</div>
        </div>
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    )
  }

  if (!match) return null

  const score = getMatchScore()
  const setScoreOptions = getSetScoreOptions()

  return (
    <div className="min-h-screen bg-gray-50">
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
                <div className="text-gray-600">
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
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {match.status === 'scheduled'
                    ? 'Zakazan'
                    : match.status === 'completed'
                    ? 'Završeno'
                    : match.status}
                </span>
              </div>
            </div>

            {/* Creator info */}
            <div className="text-sm text-gray-600">
              Kreirao: {match.creator.name || match.creator.email}
              {match.canEdit && ' (možeš uređivati)'}
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
                <div className="text-xl text-gray-800">{getTeamPlayers(1)}</div>
                {score && (
                  <div className="text-4xl font-bold mt-4 text-gray-900">{score.team1Sets}</div>
                )}
              </div>

              {/* VS */}
              <div className="px-8">
                <div className="text-2xl text-gray-600">vs</div>
              </div>

              {/* Team 2 */}
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-red-600 mb-2">Tim 2</div>
                <div className="text-xl text-gray-800">{getTeamPlayers(2)}</div>
                {score && (
                  <div className="text-4xl font-bold mt-4 text-gray-900">{score.team2Sets}</div>
                )}
              </div>
            </div>

            {/* Set scores */}
            {match.sets.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-center text-gray-600 mb-3">Setovi</div>
                <div className="flex justify-center gap-4">
                  {match.sets.map((set) => {
                    const positions = getPlayerPositionsForSet(set)
                    return (
                      <div
                        key={set.setNumber}
                        className="bg-gray-100 rounded px-4 py-2 text-center"
                      >
                        <div className="text-xs text-gray-600">Set {set.setNumber}</div>
                        <div className="font-semibold text-gray-900">
                          {set.team1Score} - {set.team2Score}
                          {(set.team1Tiebreak !== null && set.team1Tiebreak !== undefined) &&
                           (set.team2Tiebreak !== null && set.team2Tiebreak !== undefined) && (
                            <span className="text-xs font-normal text-gray-600 ml-1">
                              ({set.team1Tiebreak}-{set.team2Tiebreak})
                            </span>
                          )}
                        </div>
                        {(positions.left.length > 0 || positions.right.length > 0) && (
                          <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                            {positions.left.length > 0 && (
                              <div><span className="font-medium">L:</span> {positions.left.join(', ')}</div>
                            )}
                            {positions.right.length > 0 && (
                              <div><span className="font-medium">D:</span> {positions.right.join(', ')}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Court Side Section (for participants) */}
        {match.isParticipant && match.sets.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tvoja pozicija na terenu</h2>
              <p className="text-sm text-gray-600 mb-4">
                Odaberi na kojoj si strani terena igrao u svakom setu (lijeva/desna).
              </p>
              <div className="space-y-4">
                {match.sets.map((set) => {
                  const myPosition = getMyPositionForSet(set)
                  const isSaving = savingPosition === set.id
                  return (
                    <div key={set.id || set.setNumber} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="font-medium text-gray-800">
                        Set {set.setNumber} ({set.team1Score} - {set.team2Score})
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => set.id && handleSetCourtSide(set.id, 'left')}
                          disabled={isSaving || !set.id}
                          className={`px-4 py-2 rounded text-sm font-medium transition ${
                            myPosition === 'left'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          } ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? '...' : 'Lijeva'}
                        </button>
                        <button
                          onClick={() => set.id && handleSetCourtSide(set.id, 'right')}
                          disabled={isSaving || !set.id}
                          className={`px-4 py-2 rounded text-sm font-medium transition ${
                            myPosition === 'right'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          } ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? '...' : 'Desna'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit Section (for creator or admin) */}
        {match.canEdit && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Upravljanje matchom</h2>
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
                      Status matcha
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="scheduled">Zakazan</option>
                      <option value="in_progress">U tijeku</option>
                      <option value="completed">Završeno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  </div>

                  {/* Set Scores with dropdown */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Rezultat po setovima (teniski format)
                      </label>
                      <button
                        type="button"
                        onClick={addSet}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + Dodaj set
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Za 7-6 rezultate unesite i rezultat tiebreaka (npr. 7-5, 7-4, 8-6...)
                    </p>
                    <div className="space-y-3">
                      {editSets.map((set, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center gap-3">
                            <span className="w-14 text-gray-700 font-medium text-sm">Set {set.setNumber}</span>
                            <select
                              value={`${set.team1Score}-${set.team2Score}`}
                              onChange={(e) => updateSetScore(idx, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            >
                              <option value="0-0">-- Odaberi rezultat --</option>
                              {setScoreOptions.map((opt) => (
                                <option key={opt.label} value={`${opt.t1}-${opt.t2}`}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {editSets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSet(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Ukloni set"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {/* Tiebreak input for 7-6 scores */}
                          {isTiebreakScore(set.team1Score, set.team2Score) && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <label className="block text-xs text-gray-600 mb-2">
                                Tiebreak rezultat (min. 7 bodova, razlika 2)
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Tim 1:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={set.team1Tiebreak ?? ''}
                                  onChange={(e) => updateTiebreakScore(idx, 1, e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900 bg-white"
                                  placeholder="0"
                                />
                                <span className="text-gray-600">-</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={set.team2Tiebreak ?? ''}
                                  onChange={(e) => updateTiebreakScore(idx, 2, e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900 bg-white"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-600">:Tim 2</span>
                              </div>
                            </div>
                          )}
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
                      className="border border-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-50 transition"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}

              {!editing && (
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Obriši match
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {match.notes && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Napomena</h2>
              <p className="text-gray-700">{match.notes}</p>
            </div>
          </div>
        )}

        {/* League info */}
        {match.league && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Liga</h2>
              <p className="text-gray-700">{match.league.name}</p>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="mt-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline font-medium"
          >
            &larr; Natrag
          </button>
        </div>
      </main>
    </div>
  )
}
