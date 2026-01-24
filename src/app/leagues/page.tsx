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

  const getTeamName = (team: League['teams'][0]) => {
    return team.players.map((p) => p.user.name || p.user.email).join(' / ')
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

  // Group leagues by tier
  const leaguesByTier = leagues.reduce((acc, league) => {
    const tier = league.tier
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(league)
    return acc
  }, {} as Record<string, League[]>)

  const tierOrder = ['diamond', 'platinum', 'gold', 'silver', 'bronze']

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lige</h1>

          {/* Season selector */}
          {seasons.length > 0 && (
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* League tier explanation */}
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h2 className="font-semibold mb-3">Hijerarhija liga</h2>
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
          <p className="text-sm text-gray-500 mt-3">
            Top 25% napreduje u visu ligu • Bottom 25% ispada u nizu ligu • Minimum 8 meceva za rangiranje
          </p>
        </div>

        {leagues.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Trenutno nema aktivnih liga.</p>
            <p className="text-sm text-gray-400 mt-2">
              Samo administrator sustava moze kreirati nove lige.
            </p>
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
                              <h2 className="text-xl font-semibold">{league.name}</h2>
                              {league.description && (
                                <p className="text-gray-500 mt-1">{league.description}</p>
                              )}
                              {league.season && (
                                <p className="text-sm text-gray-400 mt-1">
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

                          <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                            <div>
                              <span className="font-medium">{league.teamCount}</span> / 5
                              parova
                              {!league.isActive && league.teamCount < 5 && (
                                <span className="ml-2 text-yellow-600">
                                  (potrebno jos {5 - league.teamCount} za aktivaciju)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Standings table */}
                          {league.standings && league.standings.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h3 className="font-medium mb-3">Rang lista</h3>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-gray-500 border-b">
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
                                        <td className="py-2 pr-4 text-gray-500">{idx + 1}</td>
                                        <td className="py-2 pr-4">
                                          {standing.leagueTeam?.players
                                            .map((p) => p.user.name)
                                            .join(' / ') || '-'}
                                        </td>
                                        <td className="py-2 pr-4 text-center">
                                          {standing.matchesPlayed}
                                        </td>
                                        <td className="py-2 pr-4 text-center text-green-600">
                                          {standing.wins}
                                        </td>
                                        <td className="py-2 pr-4 text-center text-red-600">
                                          {standing.losses}
                                        </td>
                                        <td className="py-2 text-center font-semibold">
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
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                  Prijavljeni parovi:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {league.teams.map((team) => (
                                    <div
                                      key={team.id}
                                      className="bg-gray-50 rounded px-3 py-2 text-sm"
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
