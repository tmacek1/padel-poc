'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface League {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  teamCount: number
  teams: {
    id: string
    name: string | null
    players: {
      user: { id: string; name: string; email: string }
    }[]
  }[]
}

export default function LeaguesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchLeagues()
    }
  }, [session])

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/leagues')
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lige</h1>
        </div>

        {leagues.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Trenutno nema aktivnih liga.</p>
            <p className="text-sm text-gray-400 mt-2">
              Samo administrator sustava moze kreirati nove lige.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leagues.map((league) => (
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

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">{league.teamCount}</span> / 5
                      parova
                      {!league.isActive && league.teamCount < 5 && (
                        <span className="ml-2 text-yellow-600">
                          (potrebno jos {5 - league.teamCount} za aktivaciju)
                        </span>
                      )}
                    </div>
                    {league.startDate && (
                      <div>
                        Pocetak:{' '}
                        {new Date(league.startDate).toLocaleDateString('hr-HR')}
                      </div>
                    )}
                  </div>

                  {/* Teams */}
                  {league.teams.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Parovi:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {league.teams.map((team) => (
                          <div
                            key={team.id}
                            className="bg-gray-50 rounded px-3 py-2 text-sm"
                          >
                            {team.players
                              .map((p) => p.user.name || p.user.email)
                              .join(' / ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
