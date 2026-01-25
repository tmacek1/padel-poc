'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

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
    }
  }, [session])

  useEffect(() => {
    if (selectedSeason) {
      fetchLeagues(selectedSeason)
    }
  }, [selectedSeason])

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
                Liga neće biti aktivna dok nema najmanje 5 parova.
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
              <p className="text-sm text-gray-500 mt-2">
                Kao administrator, možeš kreirati novu ligu klikom na gumb &quot;+ Nova liga&quot;.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
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
                                <p className="text-sm text-gray-500 mt-1">
                                  Sezona: {league.season.name}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                league.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {league.isActive ? 'Aktivna' : 'Neaktivna'}
                            </span>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                            <div>
                              <span className="font-medium text-gray-900">{league.teamCount}</span> / 5
                              parova
                              {!league.isActive && league.teamCount < 5 && (
                                <span className="ml-2 text-yellow-600">
                                  (potrebno još {5 - league.teamCount} za aktivaciju)
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

                          {/* Teams (if no standings yet) */}
                          {(!league.standings || league.standings.length === 0) &&
                            league.teams.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <div className="text-sm font-medium text-gray-800 mb-2">
                                  Prijavljeni parovi:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {league.teams.map((team) => (
                                    <div
                                      key={team.id}
                                      className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-800"
                                    >
                                      {getTeamName(team)}
                                    </div>
                                  ))}
                                </div>
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
