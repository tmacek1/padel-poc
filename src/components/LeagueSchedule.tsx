'use client'

import { useState } from 'react'

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

interface Matchup {
  id: string
  round: number
  homeTeam: Team
  awayTeam: Team
  scheduledAt: string | null
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
  return team.name || team.players.map((p) => p.user.name || p.user.email).join(' / ')
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
  pending: { label: 'Ceka', className: 'bg-gray-100 text-gray-600' },
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
  const [saving, setSaving] = useState(false)
  const [creatingMatch, setCreatingMatch] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Group matchups by round
  const rounds: Record<number, Matchup[]> = {}
  matchups.forEach((m) => {
    if (!rounds[m.round]) rounds[m.round] = []
    rounds[m.round].push(m)
  })

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b)

  const handleSetDate = async (matchupId: string) => {
    if (!scheduledDate) {
      setError('Datum je obavezan')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchupId,
          scheduledAt: new Date(scheduledDate).toISOString(),
        }),
      })

      if (res.ok) {
        setEditingMatchup(null)
        setScheduledDate('')
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Greska')
      }
    } catch {
      setError('Greska pri postavljanju datuma')
    } finally {
      setSaving(false)
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

  if (matchups.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
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
                        <span className="text-gray-400 flex-shrink-0">vs</span>
                        <span className="font-medium text-gray-900 truncate">
                          {getTeamName(matchup.awayTeam)}
                        </span>
                      </div>

                      {/* Match result */}
                      {matchResult && matchResult.sets.length > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          Rezultat:{' '}
                          {matchResult.sets
                            .map((s) => `${s.team1Score}-${s.team2Score}`)
                            .join(', ')}
                        </div>
                      )}

                      {/* Scheduled date */}
                      {matchup.scheduledAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(matchup.scheduledAt)}
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
                          {/* Set date button */}
                          <button
                            onClick={() => {
                              setEditingMatchup(matchup.id)
                              setScheduledDate(
                                matchup.scheduledAt
                                  ? new Date(matchup.scheduledAt)
                                      .toISOString()
                                      .slice(0, 16)
                                  : ''
                              )
                              setError('')
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            title="Postavi datum"
                          >
                            Datum
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
                        <span className="text-xs text-gray-400">
                          Mec kreiran
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date edit inline form */}
                  {isAdmin && editingMatchup === matchup.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                      />
                      <button
                        onClick={() => handleSetDate(matchup.id)}
                        disabled={saving}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Spremanje...' : 'Spremi'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingMatchup(null)
                          setError('')
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                      >
                        Odustani
                      </button>
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
