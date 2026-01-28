'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import PlayerSearch from '@/components/PlayerSearch'
import LeagueSchedule from '@/components/LeagueSchedule'

interface User {
  id: string
  name: string | null
  email: string
}

interface Standing {
  id: string
  points: number
  matchesPlayed: number
  wins: number
  losses: number
  tiebreakLosses: number
  leagueTeam?: {
    players: {
      user: { id: string; name: string }
    }[]
  }
}

interface League {
  id: string
  name: string
  description: string | null
  tier: string
  tierName: string
  isActive: boolean
  teamCount: number
  season?: { id: string; name: string; status: string }
  teams: {
    id: string
    name: string | null
    players: {
      user: { id: string; name: string; email: string }
    }[]
  }[]
  standings: Standing[]
}

interface Season {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  minMatches: number
  leagues: {
    id: string
    name: string
    tier: string
  }[]
}

const tierBadges: Record<string, string> = {
  diamond: 'bg-blue-100 text-blue-800 border-blue-300',
  platinum: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  silver: 'bg-gray-200 text-gray-800 border-gray-400',
  bronze: 'bg-amber-100 text-amber-800 border-amber-300',
}

const tierIcons: Record<string, string> = {
  diamond: '💎',
  platinum: '⚪',
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
}

export default function LeaguesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [leagues, setLeagues] = useState<League[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Admin create league form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueDescription, setNewLeagueDescription] = useState('')
  const [newLeagueTier, setNewLeagueTier] = useState('bronze')
  const [creatingLeague, setCreatingLeague] = useState(false)
  const [error, setError] = useState('')

  // Team management
  const [users, setUsers] = useState<User[]>([])
  const [addingTeamToLeague, setAddingTeamToLeague] = useState<string | null>(null)
  const [teamPlayer1, setTeamPlayer1] = useState('')
  const [teamPlayer2, setTeamPlayer2] = useState('')
  const [teamName, setTeamName] = useState('')
  const [savingTeam, setSavingTeam] = useState(false)

  // Schedule management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedules, setSchedules] = useState<Record<string, any[]>>({})
  const [generatingSchedule, setGeneratingSchedule] = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<string | null>(null)

  const isAdmin = session?.user?.isAdmin

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchSeasons()
      fetchLeagues()
      if (isAdmin) {
        fetchUsers()
      }
    }
  }, [session, isAdmin])

  useEffect(() => {
    if (selectedSeason) {
      fetchLeagues(selectedSeason)
    }
  }, [selectedSeason])

  // Fetch schedules for all leagues
  useEffect(() => {
    leagues.forEach((league) => {
      if (league.isActive && !schedules[league.id]) {
        fetchSchedule(league.id)
      }
    })
  }, [leagues])

  const fetchSeasons = async () => {
    try {
      const res = await fetch('/api/seasons')
      const data = await res.json()
      if (Array.isArray(data)) {
        setSeasons(data)
        // Auto-select active season
        const active = data.find((s: Season) => s.status === 'active')
        if (active) setSelectedSeason(active.id)
      }
    } catch (error) {
      console.error('Error fetching seasons:', error)
    }
  }

  const fetchLeagues = async (seasonId?: string) => {
    try {
      const url = seasonId ? `/api/leagues?seasonId=${seasonId}` : '/api/leagues'
      const res = await fetch(url)
      const data = await res.json()
      if (Array.isArray(data)) {
        setLeagues(data)
      }
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleAddTeam = async (leagueId: string) => {
    if (!teamPlayer1 || !teamPlayer2) {
      setError('Oba igrača su obavezna')
      return
    }

    if (teamPlayer1 === teamPlayer2) {
      setError('Igrači moraju biti različiti')
      return
    }

    setSavingTeam(true)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1Id: teamPlayer1,
          player2Id: teamPlayer2,
          teamName: teamName.trim() || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        fetchLeagues(selectedSeason || undefined)
        setAddingTeamToLeague(null)
        setTeamPlayer1('')
        setTeamPlayer2('')
        setTeamName('')
      } else {
        setError(data.error || 'Greška pri dodavanju tima')
      }
    } catch {
      setError('Greška pri dodavanju tima')
    } finally {
      setSavingTeam(false)
    }
  }

  const handleRemoveTeam = async (leagueId: string, teamId: string) => {
    if (!confirm('Jesi li siguran da želiš ukloniti ovaj tim iz lige?')) return

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams?teamId=${teamId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchLeagues(selectedSeason || undefined)
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri brisanju tima')
      }
    } catch {
      setError('Greška pri brisanju tima')
    }
  }

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeagueName.trim()) {
      setError('Naziv lige je obavezan')
      return
    }

    setCreatingLeague(true)
    setError('')

    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLeagueName.trim(),
          description: newLeagueDescription.trim() || null,
          tier: newLeagueTier,
          seasonId: selectedSeason || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Refresh leagues and reset form
        fetchLeagues(selectedSeason || undefined)
        setShowCreateForm(false)
        setNewLeagueName('')
        setNewLeagueDescription('')
        setNewLeagueTier('bronze')
      } else {
        setError(data.error || 'Greška pri kreiranju lige')
      }
    } catch {
      setError('Greška pri kreiranju lige')
    } finally {
      setCreatingLeague(false)
    }
  }

  const getTeamName = (team: League['teams'][0]) => {
    return team.players.map((p) => p.user.name || p.user.email).join(' / ')
  }

  const handleToggleActive = async (leagueId: string, currentActive: boolean) => {
    setTogglingActive(leagueId)
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (res.ok) {
        fetchLeagues(selectedSeason || undefined)
      } else {
        const data = await res.json()
        setError(data.error || 'Greska pri promjeni statusa')
      }
    } catch {
      setError('Greska pri promjeni statusa')
    } finally {
      setTogglingActive(null)
    }
  }

  const fetchSchedule = async (leagueId: string) => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setSchedules((prev) => ({ ...prev, [leagueId]: data }))
      }
    } catch (err) {
      console.error('Error fetching schedule:', err)
    }
  }

  const handleGenerateSchedule = async (leagueId: string) => {
    if (!confirm('Generiranje novog rasporeda ce obrisati postojeci raspored. Nastaviti?')) return

    setGeneratingSchedule(leagueId)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (res.ok) {
        setSchedules((prev) => ({ ...prev, [leagueId]: data }))
      } else {
        setError(data.error || 'Greska pri generiranju rasporeda')
      }
    } catch {
      setError('Greska pri generiranju rasporeda')
    } finally {
      setGeneratingSchedule(null)
    }
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

  // Group leagues by tier
  const leaguesByTier = leagues.reduce((acc, league) => {
    const tier = league.tier
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(league)
    return acc
  }, {} as Record<string, League[]>)

  const tierOrder = ['diamond', 'platinum', 'gold', 'silver', 'bronze']

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lige</h1>

          <div className="flex items-center gap-4">
            {/* Admin: Create League button */}
            {isAdmin && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {showCreateForm ? 'Otkaži' : '+ Nova liga'}
              </button>
            )}

            {/* Season selector */}
            {seasons.length > 0 && (
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">Sve lige</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} {season.status === 'active' && '(aktivna)'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Admin: Create League Form */}
        {isAdmin && showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kreiraj novu ligu</h2>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naziv lige *
                </label>
                <input
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  placeholder="npr. Bronze Liga Zagreb"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opis (opcionalno)
                </label>
                <textarea
                  value={newLeagueDescription}
                  onChange={(e) => setNewLeagueDescription(e.target.value)}
                  placeholder="Opis lige..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier
                </label>
                <select
                  value={newLeagueTier}
                  onChange={(e) => setNewLeagueTier(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {tierOrder.map((tier) => (
                    <option key={tier} value={tier}>
                      {tierIcons[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingLeague}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {creatingLeague ? 'Kreiranje...' : 'Kreiraj ligu'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition"
                >
                  Odustani
                </button>
              </div>
              <p className="text-sm text-gray-600">
                Liga neće biti aktivna dok nema najmanje 2 para.
              </p>
            </form>
          </div>
        )}

        {/* League tier explanation */}
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h2 className="font-semibold text-gray-900 mb-3">Hijerarhija liga</h2>
          <div className="flex flex-wrap gap-3">
            {tierOrder.map((tier) => (
              <span
                key={tier}
                className={`px-3 py-1 rounded-full text-sm font-medium border ${tierBadges[tier]}`}
              >
                {tierIcons[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Top 25% napreduje u višu ligu • Bottom 25% ispada u nižu ligu • Minimum 8 matcheva za rangiranje
          </p>
        </div>

        {leagues.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Trenutno nema aktivnih liga.</p>
            {isAdmin ? (
              <p className="text-sm text-gray-700 mt-2">
                Kao administrator, možeš kreirati novu ligu klikom na gumb &quot;+ Nova liga&quot;.
              </p>
            ) : (
              <p className="text-sm text-gray-700 mt-2">
                Samo administrator sustava može kreirati nove lige.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {tierOrder.map((tier) => {
              const tierLeagues = leaguesByTier[tier]
              if (!tierLeagues || tierLeagues.length === 0) return null

              return (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${tierBadges[tier]}`}
                    >
                      {tierIcons[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)} Liga
                    </span>
                  </div>

                  <div className="space-y-4">
                    {tierLeagues.map((league) => (
                      <div
                        key={league.id}
                        className="bg-white rounded-lg shadow hover:shadow-md transition"
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h2 className="text-xl font-semibold text-gray-900">{league.name}</h2>
                              {league.description && (
                                <p className="text-gray-600 mt-1">{league.description}</p>
                              )}
                              {league.season && (
                                <p className="text-sm text-gray-700 mt-1">
                                  Sezona: {league.season.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  league.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {league.isActive ? 'Aktivna' : 'Neaktivna'}
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => handleToggleActive(league.id, league.isActive)}
                                  disabled={togglingActive === league.id}
                                  className={`text-xs px-2 py-1 rounded font-medium transition disabled:opacity-50 ${
                                    league.isActive
                                      ? 'text-yellow-700 hover:bg-yellow-50 border border-yellow-300'
                                      : 'text-green-700 hover:bg-green-50 border border-green-300'
                                  }`}
                                >
                                  {togglingActive === league.id
                                    ? '...'
                                    : league.isActive
                                    ? 'Deaktiviraj'
                                    : 'Aktiviraj'}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                            <div>
                              <span className="font-medium text-gray-900">{league.teamCount}</span> / 2
                              para
                              {!league.isActive && league.teamCount < 2 && (
                                <span className="ml-2 text-yellow-600">
                                  (potrebno još {2 - league.teamCount} za aktivaciju)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Standings table */}
                          {league.standings && league.standings.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h3 className="font-medium text-gray-900 mb-3">Rang lista</h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-gray-600 border-b">
                                      <th className="pb-2 pr-4">#</th>
                                      <th className="pb-2 pr-4">Par</th>
                                      <th className="pb-2 pr-4 text-center">M</th>
                                      <th className="pb-2 pr-4 text-center">W</th>
                                      <th className="pb-2 pr-4 text-center">L</th>
                                      <th className="pb-2 text-center font-semibold">Bodovi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {league.standings.map((standing, idx) => (
                                      <tr key={standing.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4 text-gray-600">{idx + 1}</td>
                                        <td className="py-2 pr-4 text-gray-900">
                                          {standing.leagueTeam?.players
                                            .map((p) => p.user.name)
                                            .join(' / ') || '-'}
                                        </td>
                                        <td className="py-2 pr-4 text-center text-gray-700">
                                          {standing.matchesPlayed}
                                        </td>
                                        <td className="py-2 pr-4 text-center text-green-600">
                                          {standing.wins}
                                        </td>
                                        <td className="py-2 pr-4 text-center text-red-600">
                                          {standing.losses}
                                        </td>
                                        <td className="py-2 text-center font-semibold text-gray-900">
                                          {standing.points}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Teams section */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex justify-between items-center mb-3">
                              <div className="text-sm font-medium text-gray-800">
                                Prijavljeni parovi ({league.teams.length}):
                              </div>
                              {isAdmin && addingTeamToLeague !== league.id && (
                                <button
                                  onClick={() => {
                                    setAddingTeamToLeague(league.id)
                                    setTeamPlayer1('')
                                    setTeamPlayer2('')
                                    setTeamName('')
                                    setError('')
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  + Dodaj par
                                </button>
                              )}
                            </div>

                            {/* Add team form */}
                            {isAdmin && addingTeamToLeague === league.id && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <h4 className="font-medium text-gray-900 mb-3">Dodaj novi par</h4>
                                {error && (
                                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm">
                                    {error}
                                  </div>
                                )}
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm text-gray-700 mb-1">Ime tima (opcionalno)</label>
                                    <input
                                      type="text"
                                      value={teamName}
                                      onChange={(e) => setTeamName(e.target.value)}
                                      placeholder="npr. Dream Team"
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <PlayerSearch
                                      users={users}
                                      selectedUserId={teamPlayer1}
                                      onSelect={setTeamPlayer1}
                                      excludeIds={teamPlayer2 ? [teamPlayer2] : []}
                                      label="Igrač 1"
                                      placeholder="Pretraži igrača..."
                                    />
                                    <PlayerSearch
                                      users={users}
                                      selectedUserId={teamPlayer2}
                                      onSelect={setTeamPlayer2}
                                      excludeIds={teamPlayer1 ? [teamPlayer1] : []}
                                      label="Igrač 2"
                                      placeholder="Pretraži igrača..."
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAddTeam(league.id)}
                                      disabled={savingTeam}
                                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {savingTeam ? 'Spremanje...' : 'Dodaj par'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAddingTeamToLeague(null)
                                        setError('')
                                      }}
                                      className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
                                    >
                                      Odustani
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {league.teams.length === 0 ? (
                              <p className="text-sm text-gray-600">Još nema prijavljenih parova.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {league.teams.map((team) => (
                                  <div
                                    key={team.id}
                                    className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-800 flex justify-between items-center"
                                  >
                                    <span>{getTeamName(team)}</span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemoveTeam(league.id, team.id)}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                        title="Ukloni par"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Schedule section */}
                          {league.isActive && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="font-medium text-gray-900 text-sm">Raspored</h3>
                                {isAdmin && league.teams.length >= 2 && (
                                  <button
                                    onClick={() => handleGenerateSchedule(league.id)}
                                    disabled={generatingSchedule === league.id}
                                    className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50 transition"
                                  >
                                    {generatingSchedule === league.id
                                      ? 'Generiranje...'
                                      : schedules[league.id]?.length
                                      ? 'Regeneriraj raspored'
                                      : 'Generiraj raspored'}
                                  </button>
                                )}
                              </div>
                              <LeagueSchedule
                                leagueId={league.id}
                                matchups={schedules[league.id] || []}
                                isAdmin={!!isAdmin}
                                onRefresh={() => fetchSchedule(league.id)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
