'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

interface Match {
  id: string
  scheduledAt: string
  status: string
  location?: { name: string }
  players: {
    team: number
    user: { id: string; name: string; email: string }
  }[]
}

interface Stats {
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  regularStats?: {
    matches: number
    wins: number
    losses: number
    draws: number
    winRate: number
  }
  rotationStats?: {
    setsWon: number
    setsLost: number
    setsDrawn: number
    totalSets: number
    winRate: number
  }
}

interface RankedPlayer {
  userId: string
  name: string
  wins: number
  losses: number
  draws: number
  totalMatches: number
  winRate: number
}

interface RankedPair {
  pairKey: string
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  wins: number
  losses: number
  draws: number
  totalMatches: number
  winRate: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [rankings, setRankings] = useState<RankedPlayer[]>([])
  const [pairRankings, setPairRankings] = useState<RankedPair[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
    // Redirect to profile completion if not completed
    if (status === 'authenticated' && session?.user?.profileCompleted === false) {
      router.push('/profile/complete')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      // Fetch matches
      const matchesRes = await fetch(`/api/matches?userId=${session?.user?.id}`)
      const matches = await matchesRes.json()

      if (Array.isArray(matches)) {
        const now = new Date()
        const upcoming = matches
          .filter((m: Match) => m.status === 'scheduled' && new Date(m.scheduledAt) > now)
          .slice(0, 5)
        const recent = matches
          .filter((m: Match) => m.status === 'completed')
          .slice(0, 5)

        setUpcomingMatches(upcoming)
        setRecentMatches(recent)
      }

      // Fetch stats
      const statsRes = await fetch(`/api/users/${session?.user?.id}/stats`)
      const statsData = await statsRes.json()
      setStats(statsData)

      // Fetch rankings
      const rankingsRes = await fetch('/api/rankings')
      const rankingsData = await rankingsRes.json()
      if (Array.isArray(rankingsData)) {
        setRankings(rankingsData)
      }

      // Fetch pair rankings
      const pairRankingsRes = await fetch('/api/rankings/pairs')
      const pairRankingsData = await pairRankingsRes.json()
      if (Array.isArray(pairRankingsData)) {
        setPairRankings(pairRankingsData)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700 dark:text-gray-300">Učitavanje...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Pozdrav, {session.user?.name || 'Igrače'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Pregled tvojih matcheva i statistike</p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          <Link
            href="/matches/new"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            + Novi match
          </Link>
          <Link
            href="/matches"
            className="bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-semibold border border-blue-600 dark:border-blue-400 text-sm"
          >
            Svi matchevi
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 mb-8 overflow-hidden">
          {/* Regularni matchevi */}
          <div className="flex items-center gap-4 px-4 py-3 md:px-6 md:py-4 border-b dark:border-gray-700">
            <div className="w-32 md:w-40 shrink-0">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Regularni</div>
              <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.regularStats?.matches ?? 0}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">matcheva</span>
              </div>
            </div>
            <div className="flex gap-3 md:gap-6 flex-1">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">W</div>
                <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">{stats?.regularStats?.wins ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">D</div>
                <div className="text-lg md:text-2xl font-bold text-gray-500 dark:text-gray-400">{stats?.regularStats?.draws ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">L</div>
                <div className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">{stats?.regularStats?.losses ?? 0}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Win%</div>
              <div className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.regularStats?.winRate ?? 0}%</div>
            </div>
          </div>
          {/* Rotacijski matchevi */}
          <div className="flex items-center gap-4 px-4 py-3 md:px-6 md:py-4">
            <div className="w-32 md:w-40 shrink-0">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rotacijski</div>
              <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.rotationStats?.totalSets ?? 0}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">setova</span>
              </div>
            </div>
            <div className="flex gap-3 md:gap-6 flex-1">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">W</div>
                <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">{stats?.rotationStats?.setsWon ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">D</div>
                <div className="text-lg md:text-2xl font-bold text-gray-500 dark:text-gray-400">{stats?.rotationStats?.setsDrawn ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">L</div>
                <div className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">{stats?.rotationStats?.setsLost ?? 0}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Win%</div>
              <div className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.rotationStats?.winRate ?? 0}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Matches */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nadolazeći matchevi</h2>
            </div>
            <div className="p-6">
              {upcomingMatches.length === 0 ? (
                <p className="text-gray-700 dark:text-gray-300">Nemaš zakazanih matcheva</p>
              ) : (
                <div className="space-y-4">
                  {upcomingMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {match.location?.name || 'Lokacija nije određena'}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                          Zakazan
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Matches */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nedavni matchevi</h2>
            </div>
            <div className="p-6">
              {recentMatches.length === 0 ? (
                <p className="text-gray-700 dark:text-gray-300">Nemaš odigranih matcheva</p>
              ) : (
                <div className="space-y-4">
                  {recentMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {match.location?.name || 'Lokacija nije određena'}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          Završeno
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rankings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Player Rankings */}
          {rankings.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
              <div className="p-6 border-b dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Top 10 igrača</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Igrač</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">W/D/L</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((player, idx) => (
                      <tr
                        key={player.userId}
                        className={`border-b dark:border-gray-700 last:border-0 ${
                          player.userId === session?.user?.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                          {idx + 1}.
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <Link
                            href={`/stats?userId=${player.userId}`}
                            className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline"
                          >
                            {player.name}
                          </Link>
                          {player.userId === session?.user?.id && (
                            <span className="ml-1 text-xs text-blue-600 dark:text-blue-400 font-normal">(ti)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                          <span className="text-green-700 dark:text-green-400 font-semibold">{player.wins}</span>
                          <span className="text-gray-400 mx-0.5">/</span>
                          <span className="text-gray-500 dark:text-gray-400 font-semibold">{player.draws}</span>
                          <span className="text-gray-400 mx-0.5">/</span>
                          <span className="text-red-700 dark:text-red-400 font-semibold">{player.losses}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${
                            player.winRate >= 60
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : player.winRate >= 40
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            {player.winRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pair Rankings */}
          {pairRankings.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
              <div className="p-6 border-b dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Top 10 parova</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Par</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">W/D/L</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairRankings.map((pair, idx) => {
                      const isUserInPair = pair.player1Id === session?.user?.id || pair.player2Id === session?.user?.id
                      return (
                        <tr
                          key={pair.pairKey}
                          className={`border-b dark:border-gray-700 last:border-0 ${
                            isUserInPair ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                            {idx + 1}.
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>
                                {pair.player1Name}
                                {pair.player1Id === session?.user?.id && (
                                  <span className="ml-1 text-xs text-blue-600 dark:text-blue-400 font-normal">(ti)</span>
                                )}
                              </span>
                              <span>
                                {pair.player2Name}
                                {pair.player2Id === session?.user?.id && (
                                  <span className="ml-1 text-xs text-blue-600 dark:text-blue-400 font-normal">(ti)</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                            <span className="text-green-700 dark:text-green-400 font-semibold">{pair.wins}</span>
                            <span className="text-gray-400 mx-0.5">/</span>
                            <span className="text-gray-500 dark:text-gray-400 font-semibold">{pair.draws}</span>
                            <span className="text-gray-400 mx-0.5">/</span>
                            <span className="text-red-700 dark:text-red-400 font-semibold">{pair.losses}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${
                              pair.winRate >= 60
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : pair.winRate >= 40
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            }`}>
                              {pair.winRate}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
