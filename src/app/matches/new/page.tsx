'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import PlayerSearch from '@/components/PlayerSearch'

interface User {
  id: string
  name: string | null
  email: string
}

interface Location {
  id: string
  name: string
  address?: string
  city?: string
}

interface ConflictWarning {
  userId: string
  conflicts: {
    type: string
    message: string
  }[]
}

export default function NewMatchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<ConflictWarning[]>([])
  const [showWarningModal, setShowWarningModal] = useState(false)

  // Form state
  const [scheduledAt, setScheduledAt] = useState('')
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [team1Player1, setTeam1Player1] = useState('')
  const [team1Player2, setTeam1Player2] = useState('')
  const [team2Player1, setTeam2Player1] = useState('')
  const [team2Player2, setTeam2Player2] = useState('')
  const [scoringType, setScoringType] = useState('golden_point')
  const [isLeagueMatch, setIsLeagueMatch] = useState(false)
  const [isSingles, setIsSingles] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(90)
  const [isLookingForPlayers, setIsLookingForPlayers] = useState(false)
  const [pairRotation, setPairRotation] = useState(false)

  // New location form
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationAddress, setNewLocationAddress] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  // Auto-select current user as first player
  useEffect(() => {
    if (session?.user?.id && !team1Player1) {
      setTeam1Player1(session.user.id)
    }
  }, [session?.user?.id])

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

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleSaveNewLocation = async () => {
    if (!newLocationName.trim()) {
      setError('Naziv lokacije je obavezan')
      return
    }
    if (!newLocationAddress.trim()) {
      setError('Adresa je obavezna')
      return
    }
    if (!newLocationCity.trim()) {
      setError('Grad je obavezan')
      return
    }

    setSavingLocation(true)
    setError('')

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocationName.trim(),
          address: newLocationAddress.trim(),
          city: newLocationCity.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Add to locations and select it
        setLocations([...locations, data])
        setLocationId(data.id)
        setShowNewLocation(false)
        setNewLocationName('')
        setNewLocationAddress('')
        setNewLocationCity('')
      } else {
        setError(data.error || 'Greška pri kreiranju lokacije')
      }
    } catch {
      setError('Greška pri kreiranju lokacije')
    } finally {
      setSavingLocation(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent | null, ignoreConflicts = false) => {
    e?.preventDefault()
    setError('')
    setLoading(true)

    // Build players array - filter out empty selections
    const playersData: { userId: string; team: number }[] = []

    if (isSingles) {
      if (team1Player1) playersData.push({ userId: team1Player1, team: 1 })
      if (team2Player1) playersData.push({ userId: team2Player1, team: 2 })
    } else {
      if (team1Player1) playersData.push({ userId: team1Player1, team: 1 })
      if (team1Player2) playersData.push({ userId: team1Player2, team: 1 })
      if (team2Player1) playersData.push({ userId: team2Player1, team: 2 })
      if (team2Player2) playersData.push({ userId: team2Player2, team: 2 })
    }

    // Validate based on mode
    if (isLookingForPlayers) {
      // Za "tražim igrače" treba barem 1 igrač
      if (playersData.length === 0) {
        setError('Molimo odaberi barem jednog igrača')
        setLoading(false)
        return
      }
    } else {
      // Standardna validacija - svi igrači potrebni
      if (isSingles) {
        if (!team1Player1 || !team2Player1) {
          setError('Molimo odaberi oba igrača')
          setLoading(false)
          return
        }
        if (team1Player1 === team2Player1) {
          setError('Igrači moraju biti različiti')
          setLoading(false)
          return
        }
      } else {
        const players = [team1Player1, team1Player2, team2Player1, team2Player2]
        if (players.some((p) => !p)) {
          setError('Molimo odaberi sva 4 igrača')
          setLoading(false)
          return
        }
        // Check for duplicates
        const uniquePlayers = new Set(players)
        if (uniquePlayers.size !== 4) {
          setError('Svaki igrač može biti odabran samo jednom')
          setLoading(false)
          return
        }
      }
    }

    // Check for duplicates in selected players
    const selectedIds = playersData.map(p => p.userId)
    if (new Set(selectedIds).size !== selectedIds.length) {
      setError('Svaki igrač može biti odabran samo jednom')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Konvertiraj lokalno vrijeme u ISO string s timezone info
          scheduledAt: new Date(scheduledAt).toISOString(),
          locationId: locationId || null,
          notes,
          ignoreConflicts,
          scoringType: isLeagueMatch ? 'golden_point' : scoringType,
          durationMinutes: isLeagueMatch ? 90 : durationMinutes,
          isSingles,
          isLookingForPlayers,
          pairRotation: !isSingles && !isLeagueMatch && pairRotation,
          players: playersData,
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        // Conflict detected
        setWarnings([
          ...(data.criticalConflicts || []),
          ...(data.warnings || []),
        ])
        setShowWarningModal(true)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Greška pri kreiranju matcha')
        setLoading(false)
        return
      }

      // Success - check for warnings
      if (data.warnings && data.warnings.length > 0) {
        console.log('Match created with warnings:', data.warnings)
      }

      router.push(`/matches/${data.match?.id || data.id}`)
    } catch {
      setError('Greška pri kreiranju matcha')
      setLoading(false)
    }
  }

  // Get selected player IDs for exclusion
  const selectedPlayerIds = isSingles
    ? [team1Player1, team2Player1].filter(Boolean)
    : [team1Player1, team1Player2, team2Player1, team2Player2].filter(Boolean)

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return 'Nepoznato'
    // Check for same name disambiguation
    const sameName = users.filter(
      (u) => u.name && user.name && u.name.toLowerCase() === user.name.toLowerCase() && u.id !== user.id
    )
    if (sameName.length > 0 && user.name) {
      const emailPrefix = user.email.split('@')[0]
      return `${user.name} (${emailPrefix})`
    }
    return user.name || user.email
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Učitavanje...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Novi match</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date and Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datum i vrijeme</h2>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            />
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Lokacija</h2>
              <button
                type="button"
                onClick={() => setShowNewLocation(!showNewLocation)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showNewLocation ? 'Otkaži' : '+ Nova lokacija'}
              </button>
            </div>

            {showNewLocation ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Naziv padel centra *
                  </label>
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="npr. Padel Zagreb"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresa *
                  </label>
                  <input
                    type="text"
                    value={newLocationAddress}
                    onChange={(e) => setNewLocationAddress(e.target.value)}
                    placeholder="npr. Ulica grada Vukovara 123"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grad *
                  </label>
                  <input
                    type="text"
                    value={newLocationCity}
                    onChange={(e) => setNewLocationCity(e.target.value)}
                    placeholder="npr. Zagreb"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveNewLocation}
                  disabled={savingLocation}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
                >
                  {savingLocation ? 'Spremanje...' : 'Spremi lokaciju'}
                </button>
              </div>
            ) : (
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">-- Odaberi lokaciju --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.city ? `(${loc.city})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Match Type & Scoring */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tip matcha</h2>

            <div className="space-y-4">
              {/* Match type radio buttons */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    checked={!isLeagueMatch}
                    onChange={() => setIsLeagueMatch(false)}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-800 font-medium">Regularan match</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    checked={isLeagueMatch}
                    onChange={() => setIsLeagueMatch(true)}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-800 font-medium">Ligaški match</span>
                </label>
              </div>
              {isLeagueMatch && (
                <p className="text-sm text-gray-600 ml-1">Golden Point, 2 seta za pobjedu</p>
              )}

              {/* Scoring type and duration - only for non-league matches */}
              {!isLeagueMatch && (
                <>
                  {/* Looking for players toggle */}
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="lookingForPlayers"
                      checked={isLookingForPlayers}
                      onChange={(e) => {
                        setIsLookingForPlayers(e.target.checked)
                        // Reset pair rotation when enabling "looking for players"
                        if (e.target.checked) {
                          setPairRotation(false)
                        }
                      }}
                      className="w-5 h-5 text-yellow-600 focus:ring-yellow-500 rounded"
                    />
                    <label htmlFor="lookingForPlayers" className="cursor-pointer">
                      <span className="font-medium text-gray-800">Tražim igrače</span>
                      <p className="text-xs text-gray-600">Kreiraj match s manjim brojem igrača - drugi se mogu prijaviti</p>
                    </label>
                  </div>

                  {/* Singles/Doubles toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Format igre
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gameFormat"
                          checked={!isSingles}
                          onChange={() => {
                            setIsSingles(false)
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-800">Parovi (2v2)</span>
                          <p className="text-xs text-gray-600">Standardni padel format</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gameFormat"
                          checked={isSingles}
                          onChange={() => {
                            setIsSingles(true)
                            // Clear second players when switching to singles
                            setTeam1Player2('')
                            setTeam2Player2('')
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-800">Pojedinačno (1v1)</span>
                          <p className="text-xs text-gray-600">Jedan igrač protiv jednog</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Način bodovanja
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scoringType"
                          value="golden_point"
                          checked={scoringType === 'golden_point'}
                          onChange={(e) => setScoringType(e.target.value)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-800">Golden Point</span>
                          <p className="text-xs text-gray-600">Na 40-40 odlučuje jedan poen</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scoringType"
                          value="classic"
                          checked={scoringType === 'classic'}
                          onChange={(e) => setScoringType(e.target.value)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-800">Klasično</span>
                          <p className="text-xs text-gray-600">Deuce/Advantage sustav</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trajanje meča
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <input
                          type="range"
                          min="60"
                          max="120"
                          step="30"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1 px-0.5">
                          <span>60 min</span>
                          <span>90 min</span>
                          <span>120 min</span>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 min-w-[80px] text-center">
                        {durationMinutes} min
                      </span>
                    </div>
                  </div>

                  {/* Pair rotation - only for 2v2 matches when not looking for players */}
                  {!isSingles && !isLookingForPlayers && (
                    <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="pairRotation"
                        checked={pairRotation}
                        onChange={(e) => setPairRotation(e.target.checked)}
                        className="w-5 h-5 text-purple-600 focus:ring-purple-500 rounded"
                      />
                      <label htmlFor="pairRotation" className="cursor-pointer">
                        <span className="font-medium text-gray-800">Rotacija parova po setu</span>
                        <p className="text-xs text-gray-600">Svaki igrač igra s svakim - generira se raspored za 5 setova</p>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Players */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Igrači</h2>
            <p className="text-sm text-gray-600 mb-4">
              Započni tipkati ime ili email za pretraživanje igrača.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team 1 / Player 1 */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold mb-3 text-blue-700">
                  {isSingles ? 'Igrač 1' : 'Tim 1'}
                </h3>
                <div className="space-y-3">
                  <PlayerSearch
                    users={users}
                    selectedUserId={team1Player1}
                    onSelect={setTeam1Player1}
                    excludeIds={selectedPlayerIds.filter(id => id !== team1Player1)}
                    label={isSingles ? 'Igrač' : 'Igrač 1'}
                    placeholder="Pretraži igrača..."
                  />
                  {!isSingles && (
                    <PlayerSearch
                      users={users}
                      selectedUserId={team1Player2}
                      onSelect={setTeam1Player2}
                      excludeIds={selectedPlayerIds.filter(id => id !== team1Player2)}
                      label="Igrač 2"
                      placeholder="Pretraži igrača..."
                    />
                  )}
                </div>
              </div>

              {/* Team 2 / Player 2 */}
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h3 className="font-semibold mb-3 text-red-700">
                  {isSingles ? 'Igrač 2' : 'Tim 2'}
                </h3>
                <div className="space-y-3">
                  <PlayerSearch
                    users={users}
                    selectedUserId={team2Player1}
                    onSelect={setTeam2Player1}
                    excludeIds={selectedPlayerIds.filter(id => id !== team2Player1)}
                    label={isSingles ? 'Igrač' : 'Igrač 1'}
                    placeholder="Pretraži igrača..."
                  />
                  {!isSingles && (
                    <PlayerSearch
                      users={users}
                      selectedUserId={team2Player2}
                      onSelect={setTeam2Player2}
                      excludeIds={selectedPlayerIds.filter(id => id !== team2Player2)}
                      label="Igrač 2"
                      placeholder="Pretraži igrača..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Napomena (opcionalno)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              rows={3}
              placeholder="Dodatne napomene o matchu..."
            />
          </div>

          {/* Error message - visible near submit button */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj match'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Odustani
            </button>
          </div>
        </form>
      </main>

      {/* Warning Modal - Inline overlay */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
            onClick={() => setShowWarningModal(false)}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
              {/* Warning icon */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Konflikt u rasporedu
                </h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Neki igrači već imaju zakazan meč u isto vrijeme ili na isti dan:
              </p>

              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {warnings.map((warning, idx) => (
                  <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="font-medium text-gray-900">{getUserName(warning.userId)}</div>
                    {warning.conflicts.map((conflict, cidx) => (
                      <div key={cidx} className="text-sm text-gray-700 mt-1">
                        {conflict.message}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWarningModal(false)
                    handleSubmit(null, true)
                  }}
                  className="flex-1 bg-yellow-500 text-white py-2.5 rounded-lg hover:bg-yellow-600 transition font-medium"
                >
                  Svejedno kreiraj
                </button>
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Odustani
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
