'use client'

import { useState, useEffect } from 'react'

interface Player {
  user: { id: string; name: string; email: string }
}

interface Team {
  id: string
  name: string | null
  players: Player[]
}

interface MatchSet {
  setNumber: number
  team1Score: number
  team2Score: number
}

interface Location {
  id: string
  name: string
  address?: string | null
  city?: string | null
}

interface Matchup {
  id: string
  round: number
  homeTeam: Team
  awayTeam: Team
  scheduledAt: string | null
  locationId: string | null
  location?: Location | null
  matchId: string | null
  status: string
  match?: {
    id: string
    status: string
    playedAt: string | null
    sets: MatchSet[]
  } | null
}

interface LeagueScheduleProps {
  leagueId: string
  matchups: Matchup[]
  isAdmin: boolean
  onRefresh: () => void
}

function getTeamName(team: Team): string {
  const playerNames = team.players.map((p) => p.user.name || p.user.email).join(' / ')
  if (team.name) {
    return `${playerNames} (${team.name})`
  }
  return playerNames
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Ceka', className: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Zakazano', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Odigrano', className: 'bg-green-100 text-green-700' },
}

export default function LeagueSchedule({
  leagueId,
  matchups,
  isAdmin,
  onRefresh,
}: LeagueScheduleProps) {
  const [editingMatchup, setEditingMatchup] = useState<string | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [saving, setSaving] = useState(false)
  const [creatingMatch, setCreatingMatch] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationAddress, setNewLocationAddress] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  // Fetch locations for dropdown
  useEffect(() => {
    if (isAdmin) {
      fetchLocations()
    }
  }, [isAdmin])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data)
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
    }
  }

  // Group matchups by round
  const rounds: Record<number, Matchup[]> = {}
  matchups.forEach((m) => {
    if (!rounds[m.round]) rounds[m.round] = []
    rounds[m.round].push(m)
  })

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b)

  const handleSave = async (matchupId: string) => {
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchupId,
          scheduledAt: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          locationId: selectedLocationId || null,
        }),
      })

      if (res.ok) {
        setEditingMatchup(null)
        setScheduledDate('')
        setSelectedLocationId('')
        setShowNewLocation(false)
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Greska')
      }
    } catch {
      setError('Greska pri spremanju')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateLocation = async () => {
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

    setCreatingLocation(true)
    setError('')

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

      if (res.ok) {
        const newLoc = await res.json()
        setLocations((prev) => [...prev, newLoc])
        setSelectedLocationId(newLoc.id)
        setShowNewLocation(false)
        setNewLocationName('')
        setNewLocationAddress('')
        setNewLocationCity('')
      } else {
        const data = await res.json()
        setError(data.error || 'Greska pri kreiranju lokacije')
      }
    } catch {
      setError('Greska pri kreiranju lokacije')
    } finally {
      setCreatingLocation(false)
    }
  }

  const handleCreateMatch = async (matchupId: string) => {
    setCreatingMatch(matchupId)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule/create-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchupId }),
      })

      if (res.ok) {
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Greska pri kreiranju meca')
      }
    } catch {
      setError('Greska pri kreiranju meca')
    } finally {
      setCreatingMatch(null)
    }
  }

  const startEditing = (matchup: Matchup) => {
    setEditingMatchup(matchup.id)
    setScheduledDate(
      matchup.scheduledAt
        ? new Date(matchup.scheduledAt).toISOString().slice(0, 16)
        : ''
    )
    setSelectedLocationId(matchup.locationId || '')
    setError('')
    setShowNewLocation(false)
  }

  if (matchups.length === 0) {
    return (
      <div className="text-sm text-gray-600 py-2">
        Raspored jos nije generiran.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {roundNumbers.map((roundNum) => (
        <div key={roundNum} className="border border-gray-200 rounded-lg">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h4 className="font-medium text-gray-900 text-sm">
              Kolo {roundNum}
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {rounds[roundNum].map((matchup) => {
              const status = statusConfig[matchup.status] || statusConfig.pending
              const matchResult = matchup.match

              return (
                <div key={matchup.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Teams */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 truncate">
                          {getTeamName(matchup.homeTeam)}
                        </span>
                        <span className="text-gray-500 flex-shrink-0">vs</span>
                        <span className="font-medium text-gray-900 truncate">
                          {getTeamName(matchup.awayTeam)}
                        </span>
                      </div>

                      {/* Match result */}
                      {matchResult && matchResult.sets.length > 0 && (
                        <div className="text-xs text-gray-700 mt-1">
                          Rezultat:{' '}
                          {matchResult.sets
                            .map((s) => `${s.team1Score}-${s.team2Score}`)
                            .join(', ')}
                        </div>
                      )}

                      {/* Scheduled date and location */}
                      {(matchup.scheduledAt || matchup.location) && (
                        <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                          {matchup.scheduledAt && (
                            <span>{formatDate(matchup.scheduledAt)}</span>
                          )}
                          {matchup.location && (
                            <span className="text-blue-600">
                              @ {matchup.location.name}
                              {matchup.location.city && `, ${matchup.location.city}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status badge + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>

                      {isAdmin && !matchup.matchId && (
                        <div className="flex items-center gap-1">
                          {/* Edit date/location button */}
                          <button
                            onClick={() => startEditing(matchup)}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            title="Uredi termin"
                          >
                            Termin
                          </button>

                          {/* Create match button */}
                          <button
                            onClick={() => handleCreateMatch(matchup.id)}
                            disabled={creatingMatch === matchup.id}
                            className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
                            title="Kreiraj mec"
                          >
                            {creatingMatch === matchup.id
                              ? 'Kreiranje...'
                              : 'Kreiraj mec'}
                          </button>
                        </div>
                      )}

                      {matchup.matchId && (
                        <span className="text-xs text-gray-500">
                          Mec kreiran
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit inline form */}
                  {isAdmin && editingMatchup === matchup.id && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Date/time */}
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">Datum i vrijeme</label>
                          <input
                            type="datetime-local"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded text-gray-900 bg-white"
                          />
                        </div>

                        {/* Location */}
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">Lokacija</label>
                          {!showNewLocation ? (
                            <div className="flex gap-2">
                              <select
                                value={selectedLocationId}
                                onChange={(e) => setSelectedLocationId(e.target.value)}
                                className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded text-gray-900 bg-white"
                              >
                                <option value="">-- Odaberi lokaciju --</option>
                                {locations.map((loc) => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.name}{loc.city ? ` (${loc.city})` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowNewLocation(true)}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 whitespace-nowrap"
                                title="Dodaj novu lokaciju"
                              >
                                + Nova
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={newLocationName}
                                onChange={(e) => setNewLocationName(e.target.value)}
                                placeholder="Naziv lokacije *"
                                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                              <input
                                type="text"
                                value={newLocationAddress}
                                onChange={(e) => setNewLocationAddress(e.target.value)}
                                placeholder="Adresa *"
                                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                              <input
                                type="text"
                                value={newLocationCity}
                                onChange={(e) => setNewLocationCity(e.target.value)}
                                placeholder="Grad *"
                                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleCreateLocation}
                                  disabled={creatingLocation}
                                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  {creatingLocation ? 'Kreiranje...' : 'Kreiraj lokaciju'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowNewLocation(false)
                                    setNewLocationName('')
                                    setNewLocationAddress('')
                                    setNewLocationCity('')
                                  }}
                                  className="text-xs text-gray-600 hover:text-gray-800 px-2"
                                >
                                  Odustani
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2 border-t border-blue-100">
                        <button
                          onClick={() => handleSave(matchup.id)}
                          disabled={saving}
                          className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Spremanje...' : 'Spremi'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingMatchup(null)
                            setError('')
                            setShowNewLocation(false)
                          }}
                          className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5"
                        >
                          Odustani
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
