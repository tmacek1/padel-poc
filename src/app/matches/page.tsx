'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

interface RotationPlayer {
  odUserId: string
  name: string
}

interface RotationSet {
  setNumber: number
  team1: RotationPlayer[]
  team2: RotationPlayer[]
}

interface Match {
  id: string
  scheduledAt: string
  playedAt: string | null
  status: string
  creatorId: string
  leagueId: string | null
  durationMinutes: number | null
  pairRotation: boolean
  pairRotationSchedule: RotationSet[] | string | null
  league?: { id: string; name: string; tier: string } | null
  location?: { name: string }
  players: {
    team: number
    user: { id: string; name: string; email: string } | null
  }[]
  sets: {
    setNumber: number
    team1Score: number
    team2Score: number
  }[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 10

// Helper to get available years/months from matches
const getAvailableYearsAndMonths = (matches: Match[]) => {
  const yearsSet = new Set<number>()
  const monthsMap = new Map<number, Set<number>>()

  matches.forEach(match => {
    const date = new Date(match.scheduledAt)
    const year = date.getFullYear()
    const month = date.getMonth()

    yearsSet.add(year)
    if (!monthsMap.has(year)) {
      monthsMap.set(year, new Set())
    }
    monthsMap.get(year)!.add(month)
  })

  const years = Array.from(yearsSet).sort((a, b) => b - a) // descending
  const monthsByYear: Record<number, number[]> = {}
  monthsMap.forEach((months, year) => {
    monthsByYear[year] = Array.from(months).sort((a, b) => b - a) // descending
  })

  return { years, monthsByYear }
}

const MONTH_NAMES = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
]

export default function MatchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all')
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')

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

  // Reset to page 1 when filter or page size changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, pageSize, selectedYear, selectedMonth])

  // Reset month when year changes
  useEffect(() => {
    setSelectedMonth('all')
  }, [selectedYear])

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

  // Get available years and months from all matches
  const { years: availableYears, monthsByYear } = getAvailableYearsAndMonths(matches)

  const filteredMatches = matches.filter((match) => {
    // Status filter
    if (filter !== 'all' && match.status !== filter) return false

    // Year filter
    if (selectedYear !== 'all') {
      const matchYear = new Date(match.scheduledAt).getFullYear()
      if (matchYear !== selectedYear) return false
    }

    // Month filter
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      const matchMonth = new Date(match.scheduledAt).getMonth()
      if (matchMonth !== selectedMonth) return false
    }

    return true
  })

  // Calculate pagination
  const totalMatches = filteredMatches.length
  const totalPages = Math.ceil(totalMatches / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedMatches = filteredMatches.slice(startIndex, endIndex)

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
      .filter((p) => p.team === team && p.user)
      .map((p) => p.user!.name || p.user!.email)
      .join(' / ')
  }

  // Parse rotation schedule from JSON string if needed
  const parseRotationSchedule = (match: Match): RotationSet[] | null => {
    if (!match.pairRotation) return null
    if (!match.pairRotationSchedule) return null
    if (Array.isArray(match.pairRotationSchedule)) return match.pairRotationSchedule
    if (typeof match.pairRotationSchedule === 'string') {
      try {
        return JSON.parse(match.pairRotationSchedule)
      } catch {
        return null
      }
    }
    return null
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

        {/* Filters and Page Size */}
        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
          <div className="flex gap-2">
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

          {/* Year/Month filters */}
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Sve godine</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {selectedYear !== 'all' && monthsByYear[selectedYear] && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Svi mjeseci</option>
                {monthsByYear[selectedYear].map((month) => (
                  <option key={month} value={month}>
                    {MONTH_NAMES[month]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Prikaži:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} matcheva
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results summary */}
        <div className="text-sm text-gray-600 mb-4">
          Prikazano {startIndex + 1}-{Math.min(endIndex, totalMatches)} od {totalMatches} matcheva
        </div>

        {/* Matches List */}
        {paginatedMatches.length === 0 ? (
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
            {paginatedMatches.map((match) => (
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
                      {/* Rotacija badge */}
                      {match.pairRotation && (
                        <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 border border-indigo-300 rounded font-medium">
                          Rotacija
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
                            : match.status === 'looking_for_players'
                            ? 'bg-orange-100 text-orange-800'
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
                          : match.status === 'looking_for_players'
                          ? 'Traži igrače'
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

                  {/* Rotation Schedule with Results */}
                  {parseRotationSchedule(match) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm font-medium text-indigo-700 mb-2">
                        Raspored rotacije parova:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {parseRotationSchedule(match)!.map((setConfig) => {
                          const setResult = match.sets.find(s => s.setNumber === setConfig.setNumber)
                          const hasResult = setResult && (setResult.team1Score > 0 || setResult.team2Score > 0)
                          const team1Won = setResult && setResult.team1Score > setResult.team2Score
                          const team2Won = setResult && setResult.team2Score > setResult.team1Score

                          return (
                            <div
                              key={setConfig.setNumber}
                              className={`rounded-lg p-2 text-center ${hasResult ? 'bg-white border border-indigo-200' : 'bg-indigo-50'}`}
                            >
                              <div className="text-xs font-bold text-indigo-800 mb-1">
                                Set {setConfig.setNumber}
                                {hasResult && (
                                  <span className="ml-1 text-gray-900">
                                    ({setResult.team1Score}:{setResult.team2Score})
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs ${team1Won ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                <span className="font-medium">{setConfig.team1.map(p => p.name.split(' ')[0]).join(' / ')}</span>
                                {team1Won && ' ✓'}
                              </div>
                              <div className="text-xs text-gray-500 my-0.5">vs</div>
                              <div className={`text-xs ${team2Won ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                <span className="font-medium">{setConfig.team2.map(p => p.name.split(' ')[0]).join(' / ')}</span>
                                {team2Won && ' ✓'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Stranica {currentPage} od {totalPages}
            </div>
            <div className="flex items-center gap-2">
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ← Prethodna
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    // Show first page, last page, current page, and pages around current
                    if (page === 1 || page === totalPages) return true
                    if (Math.abs(page - currentPage) <= 1) return true
                    return false
                  })
                  .map((page, index, arr) => {
                    // Add ellipsis if there's a gap
                    const prevPage = arr[index - 1]
                    const showEllipsis = prevPage && page - prevPage > 1

                    return (
                      <span key={page} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium ${
                            page === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    )
                  })}
              </div>

              {/* Next button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Sljedeća →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
