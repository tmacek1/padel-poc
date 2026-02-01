'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import PlayerSearch from '@/components/PlayerSearch'

interface User {
  id: string
  name: string | null
  email: string
}

interface SetNumberStat {
  setNumber: number
  won: number
  lost: number
  total: number
  winRate: number
}

interface CourtSideStat {
  setsPlayed: number
  setsWon: number
  winRate: number
}

interface RegularStats {
  matches: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

interface RotationStats {
  setsWon: number
  setsLost: number
  setsDrawn: number
  totalSets: number
  winRate: number
}

interface Stats {
  userId: string
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  regularStats?: RegularStats
  rotationStats?: RotationStats
  totalSetsWon: number
  totalSetsLost: number
  setWinRate: number
  totalGamesWon: number
  totalGamesLost: number
  gameWinRate: number
  setNumberStats?: SetNumberStat[]
  courtSideStats?: {
    left: CourtSideStat
    right: CourtSideStat
  }
}

export default function StatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700">Učitavanje...</div>
        </div>
      </div>
    }>
      <StatsPageContent />
    </Suspense>
  )
}

function StatsPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [viewingUserId, setViewingUserId] = useState('')
  const [viewingUserName, setViewingUserName] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  // Use session.user.id as dependency to avoid re-fetching when session object changes
  const userId = session?.user?.id
  const queryUserId = searchParams.get('userId')

  useEffect(() => {
    if (userId) {
      fetchUsers()
      if (queryUserId && queryUserId !== userId) {
        // Load stats for the player from URL param
        setViewingUserId(queryUserId)
        fetchStats(queryUserId)
      } else {
        fetchStats(userId)
      }
    }
  }, [userId, queryUserId])

  // Set viewing user name once users are loaded and we have a queryUserId
  useEffect(() => {
    if (queryUserId && users.length > 0 && viewingUserId === queryUserId) {
      const user = users.find(u => u.id === queryUserId)
      setViewingUserName(user?.name || user?.email || '')
    }
  }, [users, queryUserId, viewingUserId])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchStats = async (userId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/users/${userId}/stats`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlayer = (userId: string) => {
    setViewingUserId(userId)
    if (userId) {
      const user = users.find(u => u.id === userId)
      setViewingUserName(user?.name || user?.email || '')
      fetchStats(userId)
    } else {
      // Reset to own stats
      if (session?.user?.id) {
        setViewingUserName('')
        fetchStats(session.user.id)
      }
    }
  }

  const handleBackToMyStats = () => {
    setViewingUserId('')
    setViewingUserName('')
    if (session?.user?.id) {
      fetchStats(session.user.id)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700">Učitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {viewingUserId ? `Statistika: ${viewingUserName}` : 'Moja statistika'}
          </h1>
          {viewingUserId && (
            <button
              onClick={handleBackToMyStats}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              &larr; Natrag na moju statistiku
            </button>
          )}
        </div>

        {/* Player Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="max-w-md">
            <PlayerSearch
              users={users}
              selectedUserId={viewingUserId}
              onSelect={handleSelectPlayer}
              placeholder="Pretraži igrača za prikaz njegove statistike..."
              label="Pregledaj statistiku drugog igrača"
            />
          </div>
        </div>

        {!stats || stats.totalMatches === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700">
              {viewingUserId
                ? 'Ovaj igrač nema još odigranih matcheva.'
                : 'Nemaš još odigranih matcheva. Statistika će se prikazati nakon prvog završenog matcha.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Regular Matches Stats */}
            {stats.regularStats && stats.regularStats.matches > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Regularni matchevi
                  <span className="ml-2 text-sm font-normal text-gray-500">(pobjeda/poraz po meču)</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {stats.regularStats.matches}
                    </div>
                    <div className="text-gray-700">Matchevi</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {stats.regularStats.wins}
                    </div>
                    <div className="text-gray-700">Pobjede</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {stats.regularStats.losses}
                    </div>
                    <div className="text-gray-700">Porazi</div>
                  </div>
                  {stats.regularStats.draws > 0 && (
                    <div className="text-center">
                      <div className="text-4xl font-bold text-yellow-600">
                        {stats.regularStats.draws}
                      </div>
                      <div className="text-gray-700">Neriješeno</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600">
                      {stats.regularStats.winRate}%
                    </div>
                    <div className="text-gray-700">Uspješnost</div>
                  </div>
                </div>
                {/* Win Rate Visual for Regular */}
                <div className="mt-4">
                  <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${stats.regularStats.winRate}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                      {stats.regularStats.winRate}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rotation Matches Stats */}
            {stats.rotationStats && stats.rotationStats.totalSets > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Rotacijski matchevi
                  <span className="ml-2 text-sm font-normal text-gray-500">(pobjeda/poraz/neriješeno po setu)</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {stats.rotationStats.totalSets}
                    </div>
                    <div className="text-gray-700">Ukupno setova</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {stats.rotationStats.setsWon}
                    </div>
                    <div className="text-gray-700">Dobiveni</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {stats.rotationStats.setsLost}
                    </div>
                    <div className="text-gray-700">Izgubljeni</div>
                  </div>
                  {stats.rotationStats.setsDrawn > 0 && (
                    <div className="text-center">
                      <div className="text-4xl font-bold text-yellow-600">
                        {stats.rotationStats.setsDrawn}
                      </div>
                      <div className="text-gray-700">Neriješeni</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600">
                      {stats.rotationStats.winRate}%
                    </div>
                    <div className="text-gray-700">Uspješnost</div>
                  </div>
                </div>
                {/* Win Rate Visual for Rotation */}
                <div className="mt-4">
                  <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${stats.rotationStats.winRate}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                      {stats.rotationStats.winRate}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Combined Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Ukupna statistika
                <span className="ml-2 text-sm font-normal text-gray-500">(svi matchevi zajedno)</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.wins}
                  </div>
                  <div className="text-gray-700">Pobjede</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.losses}
                  </div>
                  <div className="text-gray-700">Porazi</div>
                </div>
                {stats.draws > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {stats.draws}
                    </div>
                    <div className="text-gray-700">Neriješeno</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.winRate}%
                  </div>
                  <div className="text-gray-700">Uspješnost</div>
                </div>
              </div>
            </div>

            {/* Set Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistika setova</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.totalSetsWon}
                  </div>
                  <div className="text-gray-700">Dobiveni setovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.totalSetsLost}
                  </div>
                  <div className="text-gray-700">Izgubljeni setovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.setWinRate}%
                  </div>
                  <div className="text-gray-700">Uspješnost</div>
                </div>
              </div>
            </div>

            {/* Game Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistika gemova</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.totalGamesWon}
                  </div>
                  <div className="text-gray-700">Dobiveni gemovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.totalGamesLost}
                  </div>
                  <div className="text-gray-700">Izgubljeni gemovi</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.gameWinRate}%
                  </div>
                  <div className="text-gray-700">Uspješnost</div>
                </div>
              </div>
            </div>

            {/* Set Number Statistics */}
            {stats.setNumberStats && stats.setNumberStats.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Uspješnost po broju seta</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Kako igraš u prvom, drugom, trećem setu...
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.setNumberStats.map((setStat) => (
                    <div
                      key={setStat.setNumber}
                      className="bg-gray-50 rounded-lg p-4 text-center"
                    >
                      <div className="text-sm text-gray-600 mb-2">
                        {setStat.setNumber}. set
                      </div>
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {setStat.winRate}%
                      </div>
                      <div className="text-xs text-gray-700">
                        {setStat.won}W / {setStat.lost}L ({setStat.total} ukupno)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Court Side Statistics */}
            {stats.courtSideStats && (
              (stats.courtSideStats.left.setsPlayed > 0 ||
                stats.courtSideStats.right.setsPlayed > 0) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Uspješnost po strani terena</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Usporedi kako igraš na lijevoj (reves) i desnoj (drive) strani
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left side */}
                    <div className="bg-purple-50 rounded-lg p-6 text-center">
                      <div className="text-lg font-medium text-purple-800 mb-2">
                        Lijeva strana (Reves)
                      </div>
                      <div className="text-4xl font-bold text-purple-600 mb-2">
                        {stats.courtSideStats.left.winRate}%
                      </div>
                      <div className="text-sm text-gray-700">
                        {stats.courtSideStats.left.setsWon} dobivenih od{' '}
                        {stats.courtSideStats.left.setsPlayed} odigranih setova
                      </div>
                      {stats.courtSideStats.left.setsPlayed === 0 && (
                        <div className="text-xs text-gray-600 mt-2">
                          Nemas podataka za ovu stranu
                        </div>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="bg-orange-50 rounded-lg p-6 text-center">
                      <div className="text-lg font-medium text-orange-800 mb-2">
                        Desna strana (Drive)
                      </div>
                      <div className="text-4xl font-bold text-orange-600 mb-2">
                        {stats.courtSideStats.right.winRate}%
                      </div>
                      <div className="text-sm text-gray-700">
                        {stats.courtSideStats.right.setsWon} dobivenih od{' '}
                        {stats.courtSideStats.right.setsPlayed} odigranih setova
                      </div>
                      {stats.courtSideStats.right.setsPlayed === 0 && (
                        <div className="text-xs text-gray-600 mt-2">
                          Nemas podataka za ovu stranu
                        </div>
                      )}
                    </div>
                  </div>
                  {stats.courtSideStats.left.setsPlayed === 0 &&
                    stats.courtSideStats.right.setsPlayed === 0 && (
                      <p className="text-sm text-gray-600 mt-4 text-center">
                        Za prikaz statistike po strani terena, označi svoju poziciju u
                        svakom setu na stranici matcha.
                      </p>
                    )}
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  )
}
