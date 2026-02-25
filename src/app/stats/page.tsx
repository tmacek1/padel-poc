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
  drawn: number
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700 dark:text-gray-300">Učitavanje...</div>
        </div>
      </div>
    }>
      <StatsPageContent />
    </Suspense>
  )
}

function WinBar({ rate, className }: { rate: number; className?: string }) {
  return (
    <div className={`relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className || ''}`}>
      <div
        className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
        style={{ width: `${rate}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-900 dark:text-white">
        {rate}%
      </div>
    </div>
  )
}

function StatRow({ label, won, lost, drawn, rate }: { label: string; won: number; lost: number; drawn?: number; rate: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-20 md:w-28 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">{label}</div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-green-600 dark:text-green-400">{won}</span>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-bold text-red-600 dark:text-red-400">{lost}</span>
        {drawn !== undefined && drawn > 0 && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{drawn}</span>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <WinBar rate={rate} />
      </div>
    </div>
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

  const userId = session?.user?.id
  const queryUserId = searchParams.get('userId')

  useEffect(() => {
    if (userId) {
      fetchUsers()
      if (queryUserId && queryUserId !== userId) {
        setViewingUserId(queryUserId)
        fetchStats(queryUserId)
      } else {
        fetchStats(userId)
      }
    }
  }, [userId, queryUserId])

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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700 dark:text-gray-300">Učitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {viewingUserId ? `Statistika: ${viewingUserName}` : 'Moja statistika'}
          </h1>
          {viewingUserId && (
            <button
              onClick={handleBackToMyStats}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm shrink-0"
            >
              &larr; Moja statistika
            </button>
          )}
        </div>

        {/* Player Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-3 md:p-4 mb-4">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
            <p className="text-gray-700 dark:text-gray-300">
              {viewingUserId
                ? 'Ovaj igrač nema još odigranih matcheva.'
                : 'Nemaš još odigranih matcheva. Statistika će se prikazati nakon prvog završenog matcha.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hero Stats - compact 4-col grid */}
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-3 md:p-5 text-center">
                <div className="text-xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalMatches}</div>
                <div className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400">Matchevi</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-3 md:p-5 text-center">
                <div className="text-xl md:text-3xl font-bold text-green-600 dark:text-green-400">{stats.wins}</div>
                <div className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400">Pobjede</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-3 md:p-5 text-center">
                <div className="text-xl md:text-3xl font-bold text-red-600 dark:text-red-400">{stats.losses}</div>
                <div className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400">Porazi</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-3 md:p-5 text-center">
                <div className="text-xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.winRate}%</div>
                <div className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400">Win%</div>
              </div>
            </div>

            {/* Breakdown: Regular + Rotation + Sets + Games in one card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3">Detaljna statistika</h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {stats.regularStats && stats.regularStats.matches > 0 && (
                  <StatRow
                    label="Regularni"
                    won={stats.regularStats.wins}
                    lost={stats.regularStats.losses}
                    drawn={stats.regularStats.draws}
                    rate={stats.regularStats.winRate}
                  />
                )}
                {stats.rotationStats && stats.rotationStats.totalSets > 0 && (
                  <StatRow
                    label="Rotacijski"
                    won={stats.rotationStats.setsWon}
                    lost={stats.rotationStats.setsLost}
                    drawn={stats.rotationStats.setsDrawn}
                    rate={stats.rotationStats.winRate}
                  />
                )}
                <StatRow
                  label="Setovi"
                  won={stats.totalSetsWon}
                  lost={stats.totalSetsLost}
                  rate={stats.setWinRate}
                />
                <StatRow
                  label="Gemovi"
                  won={stats.totalGamesWon}
                  lost={stats.totalGamesLost}
                  rate={stats.gameWinRate}
                />
              </div>
            </div>

            {/* Set Number Stats - compact horizontal */}
            {stats.setNumberStats && stats.setNumberStats.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3">Po broju seta</h2>
                <div className="grid grid-cols-5 gap-2">
                  {stats.setNumberStats.map((setStat) => (
                    <div
                      key={setStat.setNumber}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 md:p-3 text-center"
                    >
                      <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{setStat.setNumber}. set</div>
                      <div className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">{setStat.winRate}%</div>
                      <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                        {setStat.won}W {setStat.lost}L
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Court Side Stats - compact */}
            {stats.courtSideStats && (
              (stats.courtSideStats.left.setsPlayed > 0 ||
                stats.courtSideStats.right.setsPlayed > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3">Strana terena</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 md:p-4 text-center">
                      <div className="text-xs md:text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Lijeva (Reves)</div>
                      <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.courtSideStats.left.winRate}%
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">
                        {stats.courtSideStats.left.setsWon}/{stats.courtSideStats.left.setsPlayed} setova
                      </div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 md:p-4 text-center">
                      <div className="text-xs md:text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">Desna (Drive)</div>
                      <div className="text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {stats.courtSideStats.right.winRate}%
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">
                        {stats.courtSideStats.right.setsWon}/{stats.courtSideStats.right.setsPlayed} setova
                      </div>
                    </div>
                  </div>
                  {stats.courtSideStats.left.setsPlayed === 0 &&
                    stats.courtSideStats.right.setsPlayed === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        Označi poziciju u svakom setu na stranici matcha za prikaz.
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
