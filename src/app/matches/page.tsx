'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

interface Match {
  id: string
  scheduledAt: string
  playedAt: string | null
  status: string
  creatorId: string
  leagueId: string | null
  durationMinutes: number | null
  league?: { id: string; name: string; tier: string } | null
  location?: { name: string }
  players: {
    team: number
    user: { id: string; name: string; email: string }
  }[]
  sets: {
    setNumber: number
    team1Score: number
    team2Score: number
  }[]
}

export default function MatchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchMatches()
    }
  }, [session])

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches')
      const data = await res.json()
      if (Array.isArray(data)) {
        setMatches(data)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = matches.filter((match) => {
    if (filter === 'all') return true
    return match.status === filter
  })

  const getMatchScore = (match: Match) => {
    if (match.sets.length === 0) return null
    let team1Sets = 0
    let team2Sets = 0
    match.sets.forEach((set) => {
      if (set.team1Score > set.team2Score) team1Sets++
      else if (set.team2Score > set.team1Score) team2Sets++
    })
    return `${team1Sets} - ${team2Sets}`
  }

  const getTeamPlayers = (match: Match, team: number) => {
    return match.players
      .filter((p) => p.team === team)
      .map((p) => p.user.name || p.user.email)
      .join(' / ')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700">Učitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Matchevi</h1>
          <Link
            href="/matches/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Novi match
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Svi
          </button>
          <button
            onClick={() => setFilter('scheduled')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'scheduled'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Zakazani
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Završeni
          </button>
        </div>

        {/* Matches List */}
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700 mb-4">Nema matcheva za prikaz</p>
            <Link
              href="/matches/new"
              className="text-blue-600 hover:underline font-medium"
            >
              Kreiraj novi match
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-gray-700 flex items-center gap-3">
                        <span>{match.location?.name || 'Lokacija nije određena'}</span>
                        {match.durationMinutes && (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {match.durationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Liga badge */}
                      {match.leagueId ? (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 border border-orange-300 rounded font-medium">
                          Liga
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-teal-100 text-teal-800 border border-teal-300 rounded font-medium">
                          Regular
                        </span>
                      )}
                      {match.creatorId === session?.user?.id && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded font-medium">
                          Tvoj match
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          match.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : match.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : match.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : match.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {match.status === 'scheduled'
                          ? 'Zakazan'
                          : match.status === 'in_progress'
                          ? 'U tijeku'
                          : match.status === 'completed'
                          ? 'Završeno'
                          : match.status === 'cancelled'
                          ? 'Otkazano'
                          : match.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{getTeamPlayers(match, 1)}</div>
                    </div>
                    <div className="px-6 text-center">
                      {match.status === 'completed' ? (
                        <div className="text-2xl font-bold text-gray-900">
                          {getMatchScore(match)}
                        </div>
                      ) : (
                        <div className="text-gray-600 font-medium">vs</div>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-semibold text-gray-900">{getTeamPlayers(match, 2)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
