'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface Stats {
  userId: string
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  totalSetsWon: number
  totalSetsLost: number
  setWinRate: number
  totalGamesWon: number
  totalGamesLost: number
  gameWinRate: number
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/users/${session?.user?.id}/stats`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Moja statistika</h1>

        {!stats || stats.totalMatches === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              Nemas jos odigranih matcheva. Statistika ce se prikazati nakon prvog zavrsenog matcha.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Pregled</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">
                    {stats.totalMatches}
                  </div>
                  <div className="text-gray-500">Ukupno matcheva</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {stats.wins}
                  </div>
                  <div className="text-gray-500">Pobjede</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-red-600">
                    {stats.losses}
                  </div>
                  <div className="text-gray-500">Porazi</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    {stats.winRate}%
                  </div>
                  <div className="text-gray-500">Uspjesnost</div>
                </div>
              </div>
            </div>

            {/* Win Rate Visual */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Postotak pobjeda</h2>
              <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${stats.winRate}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                  {stats.winRate}%
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>{stats.wins} pobjeda</span>
                <span>{stats.losses} poraza</span>
              </div>
            </div>

            {/* Set Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Statistika setova</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.totalSetsWon}
                  </div>
                  <div className="text-gray-500">Dobiveni setovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.totalSetsLost}
                  </div>
                  <div className="text-gray-500">Izgubljeni setovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.setWinRate}%
                  </div>
                  <div className="text-gray-500">Uspjesnost</div>
                </div>
              </div>
            </div>

            {/* Game Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Statistika gemova</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.totalGamesWon}
                  </div>
                  <div className="text-gray-500">Dobiveni gemovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.totalGamesLost}
                  </div>
                  <div className="text-gray-500">Izgubljeni gemovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.gameWinRate}%
                  </div>
                  <div className="text-gray-500">Uspjesnost</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
