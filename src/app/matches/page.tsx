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
            className={`px-4 py-2 rounded-lg ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Svi
          </button>
          <button
            onClick={() => setFilter('scheduled')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'scheduled'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Zakazani
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Zavrseni
          </button>
        </div>

        {/* Matches List */}
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Nema matcheva za prikaz</p>
            <Link
              href="/matches/new"
              className="text-blue-600 hover:underline"
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
                      <div className="text-lg font-semibold">
                        {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-gray-500">
                        {match.location?.name || 'Lokacija nije odredena'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {match.creatorId === session?.user?.id && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Tvoj mec
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded ${
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

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{getTeamPlayers(match, 1)}</div>
                    </div>
                    <div className="px-6 text-center">
                      {match.status === 'completed' ? (
                        <div className="text-2xl font-bold">
                          {getMatchScore(match)}
                        </div>
                      ) : (
                        <div className="text-gray-400">vs</div>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-medium">{getTeamPlayers(match, 2)}</div>
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
