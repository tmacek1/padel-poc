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
  winRate: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
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
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700">Ucitavanje...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Pozdrav, {session.user?.name || 'Igrace'}!
          </h1>
          <p className="text-gray-600">Pregled tvojih matcheva i statistike</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-700 font-medium">Ukupno matcheva</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats?.totalMatches || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-700 font-medium">Pobjede</div>
            <div className="text-3xl font-bold text-green-600">
              {stats?.wins || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-700 font-medium">Porazi</div>
            <div className="text-3xl font-bold text-red-600">
              {stats?.losses || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-700 font-medium">Postotak pobjeda</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats?.winRate || 0}%
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          <Link
            href="/matches/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Novi match
          </Link>
          <Link
            href="/matches"
            className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-50 transition font-semibold border border-blue-600"
          >
            Svi matchevi
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Matches */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Nadolazeci matchevi</h2>
            </div>
            <div className="p-6">
              {upcomingMatches.length === 0 ? (
                <p className="text-gray-700">Nemas zakazanih matcheva</p>
              ) : (
                <div className="space-y-4">
                  {upcomingMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-sm text-gray-700">
                            {match.location?.name || 'Lokacija nije odredena'}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
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
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Nedavni matchevi</h2>
            </div>
            <div className="p-6">
              {recentMatches.length === 0 ? (
                <p className="text-gray-700">Nemas odigranih matcheva</p>
              ) : (
                <div className="space-y-4">
                  {recentMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-sm text-gray-700">
                            {match.location?.name || 'Lokacija nije odredena'}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Zavrseno
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
