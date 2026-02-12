'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface PlayerPosition {
  id: string
  matchSetId: string
  userId: string
  courtSide: string
}

interface SetPlayer {
  id: string
  matchSetId: string
  userId: string
  team: number
  user: { id: string; name: string; email: string }
}

interface EditSetPlayer {
  userId: string
  team: number
}

interface MatchSet {
  id?: string
  setNumber: number
  team1Score: number
  team2Score: number
  team1Tiebreak?: number | null
  team2Tiebreak?: number | null
  playerPositions?: PlayerPosition[]
  setPlayers?: SetPlayer[] | EditSetPlayer[]
}

interface PairRotationSchedule {
  setNumber: number
  team1: { odUserId: string; name: string }[]
  team2: { odUserId: string; name: string }[]
}

interface Match {
  id: string
  scheduledAt: string
  playedAt: string | null
  status: string
  scoringType: string
  notes: string | null
  videoUrls: string[]
  creatorId: string
  canEdit: boolean
  isParticipant: boolean
  isSingles: boolean
  pairRotation: boolean
  pairRotationSchedule?: PairRotationSchedule[] | string
  location?: { id: string; name: string }
  creator: { id: string; name: string; email: string }
  players: {
    id: string
    team: number
    odUserId: string | null
    user: { id: string; name: string; email: string; image?: string; isGuest?: boolean } | null
  }[]
  sets: MatchSet[]
  league?: { id: string; name: string }
}

// Check if a set score is valid (allows unfinished sets like 5-3)
function isValidSetScore(team1: number, team2: number): string | null {
  // Basic validation
  if (team1 < 0 || team2 < 0) return 'Rezultat ne može biti negativan'
  if (team1 > 7 || team2 > 7) return 'Maksimalan broj gemova u setu je 7'

  // Invalid finished scores (e.g., 6-6 without tiebreak, 7-0, etc.)
  if (team1 === 7 && team2 < 5) return 'Ako je 7, protivnik mora imati barem 5 ili 6'
  if (team2 === 7 && team1 < 5) return 'Ako je 7, protivnik mora imati barem 5 ili 6'

  // 6-6 is only valid as in-progress (tie), but if finished it should be 7-6
  // Allow it as "in progress" score

  return null // Valid
}

// Check if this is a finished set that went to tiebreak
function isTiebreakScore(team1: number, team2: number): boolean {
  return (team1 === 7 && team2 === 6) || (team1 === 6 && team2 === 7)
}

function isValidTiebreakScore(winner: number, loser: number): boolean {
  // Tiebreak rules:
  // - Minimum 7 points to win
  // - Must win by exactly 2 points
  if (winner < 7) return false
  if (loser < 0) return false

  // If loser has less than 6 points, winner must have exactly 7
  if (loser < 6) {
    return winner === 7
  }

  // If loser has 6 or more, winner must be exactly loser + 2
  return winner === loser + 2
}

// Check if score represents a finished set
function isFinishedSetScore(team1: number, team2: number): boolean {
  // Standard finished scores: 6-0, 6-1, 6-2, 6-3, 6-4
  if ((team1 === 6 && team2 <= 4) || (team2 === 6 && team1 <= 4)) return true
  // Extended finished scores: 7-5, 7-6
  if ((team1 === 7 && (team2 === 5 || team2 === 6)) ||
      (team2 === 7 && (team1 === 5 || team1 === 6))) return true
  return false
}

export default function MatchDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPosition, setSavingPosition] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Edit form state
  const [editStatus, setEditStatus] = useState('')
  const [editSets, setEditSets] = useState<MatchSet[]>([])
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [enablingRotation, setEnablingRotation] = useState(false)
  const [joiningMatch, setJoiningMatch] = useState(false)
  const [leavingMatch, setLeavingMatch] = useState(false)
  const [draggedSetIndex, setDraggedSetIndex] = useState<number | null>(null)
  const [editingVideo, setEditingVideo] = useState(false)
  const [editVideoUrls, setEditVideoUrls] = useState<string[]>([])
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [savingVideo, setSavingVideo] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session && matchId) {
      fetchMatch()
    }
  }, [session, matchId])

  const fetchMatch = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`)
      const data = await res.json()

      if (res.ok) {
        setMatch(data)
        setEditStatus(data.status)

        // Parse rotation schedule if available
        let rotationSchedule: PairRotationSchedule[] | null = null
        if (data.pairRotation && data.pairRotationSchedule) {
          if (Array.isArray(data.pairRotationSchedule)) {
            rotationSchedule = data.pairRotationSchedule
          } else if (typeof data.pairRotationSchedule === 'string') {
            try {
              rotationSchedule = JSON.parse(data.pairRotationSchedule)
            } catch {
              // Ignore parse errors
            }
          }
        }

        // Initialize edit sets with setPlayers data
        if (data.sets.length > 0) {
          const setsWithPlayers = data.sets.map((set: MatchSet) => {
            // If set already has setPlayers, convert them to EditSetPlayer format
            if (set.setPlayers && set.setPlayers.length > 0) {
              return {
                ...set,
                setPlayers: set.setPlayers.map((sp: SetPlayer | EditSetPlayer) => ({
                  userId: 'userId' in sp ? sp.userId : (sp as SetPlayer).user?.id || '',
                  team: sp.team,
                })),
              }
            }
            // For rotation matches, use the rotation schedule
            if (rotationSchedule) {
              const setConfig = rotationSchedule.find(s => s.setNumber === set.setNumber)
              if (setConfig) {
                const team1Players = setConfig.team1.map(p => ({ userId: p.odUserId, team: 1 }))
                const team2Players = setConfig.team2.map(p => ({ userId: p.odUserId, team: 2 }))
                return {
                  ...set,
                  setPlayers: [...team1Players, ...team2Players],
                }
              }
            }
            // Otherwise use original match players
            return {
              ...set,
              setPlayers: data.players
                .filter((p: { user: { id: string } | null }) => p.user)
                .map((p: { user: { id: string }; team: number }) => ({ userId: p.user.id, team: p.team })),
            }
          })
          setEditSets(setsWithPlayers)
        } else {
          // Initialize with default players - use rotation schedule for first set if available
          let defaultPlayers: EditSetPlayer[]

          if (rotationSchedule && rotationSchedule[0]) {
            // Use rotation schedule for first set
            const setConfig = rotationSchedule[0]
            defaultPlayers = [
              ...setConfig.team1.map(p => ({ userId: p.odUserId, team: 1 })),
              ...setConfig.team2.map(p => ({ userId: p.odUserId, team: 2 })),
            ]
          } else {
            // Use original match players
            defaultPlayers = data.players
              .filter((p: { user: { id: string } | null }) => p.user)
              .map((p: { user: { id: string }; team: number }) => ({ userId: p.user.id, team: p.team }))
          }
          setEditSets([{ setNumber: 1, team1Score: 0, team2Score: 0, setPlayers: defaultPlayers }])
        }
        // Format date for datetime-local input (lokalno vrijeme)
        if (data.scheduledAt) {
          const date = new Date(data.scheduledAt)
          // Formatiraj kao YYYY-MM-DDTHH:mm u lokalnom vremenu
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          setEditScheduledAt(`${year}-${month}-${day}T${hours}:${minutes}`)
        }
      } else {
        setError(data.error || 'Match nije pronađen')
      }
    } catch (error) {
      console.error('Error fetching match:', error)
      setError('Greška pri učitavanju matcha')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (!editScheduledAt) {
      setError('Molimo unesite datum i vrijeme')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: new Date(editScheduledAt).toISOString() }),
      })

      if (res.ok) {
        await fetchMatch()
        setEditingSchedule(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri spremanju')
      }
    } catch {
      setError('Greška pri spremanju termina')
    } finally {
      setSaving(false)
    }
  }

  const handleEnableRotation = async () => {
    if (!confirm('Želiš li omogućiti rotaciju parova po setu? Generirat će se raspored za 5 setova.')) {
      return
    }

    setEnablingRotation(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}/rotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        await fetchMatch()
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri omogućavanju rotacije')
      }
    } catch {
      setError('Greška pri omogućavanju rotacije')
    } finally {
      setEnablingRotation(false)
    }
  }

  const handleJoinMatch = async (team: number) => {
    setJoiningMatch(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team }),
      })

      const data = await res.json()

      if (res.ok) {
        await fetchMatch()
      } else {
        setError(data.error || 'Greška pri pridruživanju')
      }
    } catch {
      setError('Greška pri pridruživanju')
    } finally {
      setJoiningMatch(false)
    }
  }

  const handleLeaveMatch = async () => {
    if (!confirm('Jesi li siguran da želiš napustiti ovaj meč?')) return

    setLeavingMatch(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}/join`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok) {
        await fetchMatch()
      } else {
        setError(data.error || 'Greška pri napuštanju')
      }
    } catch {
      setError('Greška pri napuštanju')
    } finally {
      setLeavingMatch(false)
    }
  }

  // Pretvori Google Drive URL u embed URL za iframe
  const getEmbedUrl = (url: string): string | null => {
    // Google Drive: /file/d/FILE_ID/view... → /file/d/FILE_ID/preview
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    }
    // YouTube: razne varijante
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/)
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`
    }
    return null
  }

  const handleSaveVideoUrls = async (urls: string[]) => {
    setSavingVideo(true)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrls: urls }),
      })

      if (res.ok) {
        await fetchMatch()
        setEditingVideo(false)
        setNewVideoUrl('')
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri spremanju video linka')
      }
    } catch {
      setError('Greška pri spremanju video linka')
    } finally {
      setSavingVideo(false)
    }
  }

  const handleAddVideoUrl = () => {
    const url = newVideoUrl.trim()
    if (!url) return
    const updated = [...editVideoUrls, url]
    setEditVideoUrls(updated)
    setNewVideoUrl('')
  }

  const handleRemoveVideoUrl = (index: number) => {
    setEditVideoUrls(editVideoUrls.filter((_, i) => i !== index))
  }

  const validateSets = (): string | null => {
    const filledSets = editSets.filter(s => s.team1Score > 0 || s.team2Score > 0)

    for (const set of filledSets) {
      const validationError = isValidSetScore(set.team1Score, set.team2Score)
      if (validationError) {
        return `Set ${set.setNumber}: ${validationError}`
      }
      // Validate tiebreak if it's a 7-6 score
      if (isTiebreakScore(set.team1Score, set.team2Score)) {
        const tb1 = set.team1Tiebreak ?? 0
        const tb2 = set.team2Tiebreak ?? 0
        if (tb1 === 0 && tb2 === 0) {
          return `Set ${set.setNumber} završio je 7-6, molimo unesite rezultat tiebreaka.`
        }

        // The team that won the set (has 7 games) must also have won the tiebreak
        const team1WonSet = set.team1Score === 7
        const team1WonTiebreak = tb1 > tb2

        if (team1WonSet !== team1WonTiebreak) {
          return `Neispravan tiebreak rezultat u setu ${set.setNumber}. Tim koji je osvojio set (7 gemova) mora imati više bodova u tiebreaku.`
        }

        const winner = Math.max(tb1, tb2)
        const loser = Math.min(tb1, tb2)
        if (!isValidTiebreakScore(winner, loser)) {
          return `Neispravan tiebreak rezultat u setu ${set.setNumber}. Pobjednik mora imati min. 7 bodova i 2 boda prednosti (npr. 7-5, 8-6, 10-8).`
        }
      }
    }

    return null
  }

  const addSet = () => {
    const newSetNumber = editSets.length + 1
    // Get default team composition from rotation schedule or original players
    let defaultSetPlayers: EditSetPlayer[] | undefined

    const rotationSchedule = getParsedRotationSchedule()
    if (rotationSchedule && rotationSchedule[newSetNumber - 1]) {
      const setConfig = rotationSchedule[newSetNumber - 1]
      defaultSetPlayers = [
        ...setConfig.team1.map(p => ({ odUserId: p.odUserId, team: 1 })),
        ...setConfig.team2.map(p => ({ odUserId: p.odUserId, team: 2 })),
      ].map(p => ({ userId: p.odUserId, team: p.team }))
    } else if (match?.players) {
      defaultSetPlayers = match.players.filter(p => p.user).map(p => ({ userId: p.user!.id, team: p.team }))
    }

    setEditSets([...editSets, {
      setNumber: newSetNumber,
      team1Score: 0,
      team2Score: 0,
      setPlayers: defaultSetPlayers,
    }])
  }

  // Update set players for a specific set
  const updateSetPlayers = (setIndex: number, team1PlayerIds: string[], team2PlayerIds: string[]) => {
    const newSets = [...editSets]
    newSets[setIndex] = {
      ...newSets[setIndex],
      setPlayers: [
        ...team1PlayerIds.map(userId => ({ userId, team: 1 })),
        ...team2PlayerIds.map(userId => ({ userId, team: 2 })),
      ],
    }
    setEditSets(newSets)
  }

  // Get current team composition for a set
  const getSetTeamPlayers = (set: MatchSet, team: number): string[] => {
    if (set.setPlayers && Array.isArray(set.setPlayers)) {
      return set.setPlayers
        .filter(sp => sp.team === team)
        .map(sp => 'userId' in sp ? sp.userId : '')
        .filter(id => id)
    }
    return []
  }

  // Toggle a player between teams for a specific set
  const togglePlayerTeam = (setIndex: number, odUserId: string) => {
    const set = editSets[setIndex]
    const currentSetPlayers = set.setPlayers as EditSetPlayer[] || []

    const playerInSet = currentSetPlayers.find(sp => sp.userId === odUserId)
    if (playerInSet) {
      // Toggle team
      const newTeam = playerInSet.team === 1 ? 2 : 1
      const updatedSetPlayers = currentSetPlayers.map(sp =>
        sp.userId === odUserId ? { ...sp, team: newTeam } : sp
      )

      // Ensure teams are balanced (2 players each for doubles)
      const team1Count = updatedSetPlayers.filter(sp => sp.team === 1).length
      const team2Count = updatedSetPlayers.filter(sp => sp.team === 2).length

      if (team1Count <= 2 && team2Count <= 2) {
        const newSets = [...editSets]
        newSets[setIndex] = { ...set, setPlayers: updatedSetPlayers }
        setEditSets(newSets)
      }
    }
  }

  const removeSet = (index: number) => {
    if (editSets.length <= 1) return
    const newSets = editSets.filter((_, i) => i !== index)
    // Renumber sets
    const renumbered = newSets.map((s, i) => ({ ...s, setNumber: i + 1 }))
    setEditSets(renumbered)
  }

  const handleSave = async () => {
    // Validate scores
    const validationError = validateSets()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      // Prepare sets with setPlayers data
      const setsToSave = editSets
        .filter((s) => s.team1Score > 0 || s.team2Score > 0)
        .map(s => ({
          setNumber: s.setNumber,
          team1Score: s.team1Score,
          team2Score: s.team2Score,
          team1Tiebreak: s.team1Tiebreak,
          team2Tiebreak: s.team2Tiebreak,
          setPlayers: s.setPlayers || [],
        }))

      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          sets: setsToSave,
          playedAt: editStatus === 'completed' ? new Date().toISOString() : null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMatch({ ...data, canEdit: match?.canEdit })
        setEditing(false)
      } else {
        setError(data.error || 'Greška pri spremanju')
      }
    } catch {
      setError('Greška pri spremanju')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Jesi li siguran da želiš obrisati ovaj match?')) return

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/matches')
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri brisanju')
      }
    } catch {
      setError('Greška pri brisanju')
    }
  }

  const handleSetCourtSide = async (setId: string, courtSide: string) => {
    setSavingPosition(setId)
    setError('')

    try {
      const res = await fetch(`/api/matches/${matchId}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId, courtSide }),
      })

      if (res.ok) {
        // Refresh match data to show updated positions
        await fetchMatch()
      } else {
        const data = await res.json()
        setError(data.error || 'Greška pri postavljanju pozicije')
      }
    } catch {
      setError('Greška pri postavljanju pozicije')
    } finally {
      setSavingPosition(null)
    }
  }

  const getMyPositionForSet = (set: MatchSet): string | null => {
    if (!set.playerPositions || !session?.user?.id) return null
    const pos = set.playerPositions.find(p => p.userId === session.user.id)
    return pos?.courtSide || null
  }

  const getPlayerPositionsForSet = (set: MatchSet) => {
    if (!set.playerPositions || !match) return { left: [], right: [] }

    const left: string[] = []
    const right: string[] = []

    set.playerPositions.forEach(pos => {
      const player = match.players.find(p => p.user?.id === pos.userId)
      const name = player?.user?.name || player?.user?.email || 'Nepoznato'
      if (pos.courtSide === 'left') left.push(name)
      else if (pos.courtSide === 'right') right.push(name)
    })

    return { left, right }
  }

  const updateSetScore = (setIndex: number, scoreString: string) => {
    const [t1, t2] = scoreString.split('-').map(s => parseInt(s.trim()))
    const newSets = [...editSets]
    const isTiebreak = isTiebreakScore(t1, t2)
    newSets[setIndex] = {
      ...newSets[setIndex],
      team1Score: t1 || 0,
      team2Score: t2 || 0,
      // Clear tiebreak if not a 7-6 score
      team1Tiebreak: isTiebreak ? newSets[setIndex].team1Tiebreak : null,
      team2Tiebreak: isTiebreak ? newSets[setIndex].team2Tiebreak : null,
    }
    setEditSets(newSets)
  }

  const updateTiebreakScore = (setIndex: number, team: 1 | 2, value: string) => {
    const numValue = parseInt(value) || 0
    const newSets = [...editSets]
    if (team === 1) {
      newSets[setIndex] = { ...newSets[setIndex], team1Tiebreak: numValue }
    } else {
      newSets[setIndex] = { ...newSets[setIndex], team2Tiebreak: numValue }
    }
    setEditSets(newSets)
  }

  const updateSetPlayer = (setIndex: number, team: number, playerIndex: number, userId: string) => {
    const newSets = [...editSets]
    const currentSetPlayers = (newSets[setIndex].setPlayers || []) as EditSetPlayer[]

    // Find existing players for this team
    const teamPlayers = currentSetPlayers.filter(sp => sp.team === team)
    const otherTeamPlayers = currentSetPlayers.filter(sp => sp.team !== team)

    // Update or add player
    if (teamPlayers[playerIndex]) {
      teamPlayers[playerIndex] = { userId, team }
    } else {
      teamPlayers.push({ userId, team })
    }

    newSets[setIndex] = {
      ...newSets[setIndex],
      setPlayers: [...otherTeamPlayers, ...teamPlayers],
    }
    setEditSets(newSets)
  }

  const getSetPlayersForTeam = (set: MatchSet, team: number): string[] => {
    if (!set.setPlayers) return []
    return (set.setPlayers as Array<SetPlayer | EditSetPlayer>)
      .filter(sp => sp.team === team)
      .map(sp => sp.userId)
  }

  const getTeamPlayers = (team: number) => {
    return match?.players
      .filter((p) => p.team === team && p.user)
      .map((p) => {
        const name = p.user?.name || p.user?.email || 'Nepoznato'
        return p.user?.isGuest ? `${name} (gost)` : name
      })
      .join(' / ')
  }

  const getMatchScore = () => {
    if (!match || match.sets.length === 0) return null
    let team1Sets = 0
    let team2Sets = 0
    match.sets.forEach((set) => {
      if (set.team1Score > set.team2Score) team1Sets++
      else if (set.team2Score > set.team1Score) team2Sets++
    })
    return { team1Sets, team2Sets }
  }

  // Parse rotation schedule from JSON string if needed
  const getParsedRotationSchedule = (): PairRotationSchedule[] | null => {
    if (!match?.pairRotation || !match?.pairRotationSchedule) return null
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Učitavanje...</div>
        </div>
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    )
  }

  if (!match) return null

  const score = getMatchScore()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                {editingSchedule ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Novi termin
                    </label>
                    <input
                      type="datetime-local"
                      value={editScheduledAt}
                      onChange={(e) => setEditScheduledAt(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSchedule}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        {saving ? 'Spremanje...' : 'Spremi'}
                      </button>
                      <button
                        onClick={() => setEditingSchedule(false)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Odustani
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {new Date(match.scheduledAt).toLocaleDateString('hr-HR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </h1>
                    <div className="text-gray-600 flex items-center gap-2">
                      <span>
                        {new Date(match.scheduledAt).toLocaleTimeString('hr-HR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {match.location && ` - ${match.location.name}`}
                      </span>
                      {match.canEdit && (match.status === 'scheduled' || match.status === 'looking_for_players') && (
                        <button
                          onClick={() => setEditingSchedule(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Promijeni termin"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                      : 'bg-gray-200 text-gray-700'
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

            {/* Creator info */}
            <div className="text-sm text-gray-600">
              Kreirao: {match.creator.name || match.creator.email}
              {match.canEdit && ' (možeš uređivati)'}
            </div>
          </div>
        </div>

        {/* Score Display */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              {/* Team 1 */}
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-blue-600 mb-2">Tim 1</div>
                <div className="text-xl text-gray-800">{getTeamPlayers(1)}</div>
                {score && !match.pairRotation && (
                  <div className="text-4xl font-bold mt-4 text-gray-900">{score.team1Sets}</div>
                )}
              </div>

              {/* VS */}
              <div className="px-8">
                <div className="text-2xl text-gray-600">vs</div>
              </div>

              {/* Team 2 */}
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-red-600 mb-2">Tim 2</div>
                <div className="text-xl text-gray-800">{getTeamPlayers(2)}</div>
                {score && !match.pairRotation && (
                  <div className="text-4xl font-bold mt-4 text-gray-900">{score.team2Sets}</div>
                )}
              </div>
            </div>

            {/* Set scores */}
            {match.sets.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-center text-gray-600 mb-3">
                  Setovi
                  {match.pairRotation && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      Rotacija
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto">
                  {match.sets.map((set) => {
                    const positions = getPlayerPositionsForSet(set)

                    // Za rotaciju: dohvati parove iz setPlayers ili rotation schedule
                    const rotationSchedule = getParsedRotationSchedule()
                    const setConfig = rotationSchedule?.find(s => s.setNumber === set.setNumber)
                    const setPlayersData = (set.setPlayers || []) as SetPlayer[]
                    const hasSetPlayers = setPlayersData.length > 0

                    const team1Names = hasSetPlayers
                      ? setPlayersData.filter(sp => sp.team === 1).map(sp => sp.user?.name?.split(' ')[0] || '?').join(' / ')
                      : setConfig
                        ? setConfig.team1.map(p => p.name.split(' ')[0]).join(' / ')
                        : null
                    const team2Names = hasSetPlayers
                      ? setPlayersData.filter(sp => sp.team === 2).map(sp => sp.user?.name?.split(' ')[0] || '?').join(' / ')
                      : setConfig
                        ? setConfig.team2.map(p => p.name.split(' ')[0]).join(' / ')
                        : null

                    return (
                      <div
                        key={set.setNumber}
                        className="bg-gray-100 rounded-lg px-2 py-2 sm:px-3 text-center"
                      >
                        <div className="text-xs text-gray-600">Set {set.setNumber}</div>
                        <div className="font-semibold text-gray-900">
                          {set.team1Score} - {set.team2Score}
                          {(set.team1Tiebreak !== null && set.team1Tiebreak !== undefined) &&
                           (set.team2Tiebreak !== null && set.team2Tiebreak !== undefined) && (
                            <span className="text-xs font-normal text-gray-600 ml-1">
                              ({set.team1Tiebreak}-{set.team2Tiebreak})
                            </span>
                          )}
                        </div>
                        {/* Parovi za rotaciju */}
                        {(team1Names || team2Names) && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-200 text-xs">
                            <div className="text-blue-700 font-medium">{team1Names}</div>
                            <div className="text-gray-400 text-[10px]">vs</div>
                            <div className="text-red-700 font-medium">{team2Names}</div>
                          </div>
                        )}
                        {/* Pozicije na terenu */}
                        {(positions.left.length > 0 || positions.right.length > 0) && (
                          <div className="mt-1.5 text-xs text-gray-600 border-t border-gray-200 pt-1.5">
                            {positions.left.length > 0 && (
                              <div><span className="font-medium">L:</span> {positions.left.join(', ')}</div>
                            )}
                            {positions.right.length > 0 && (
                              <div><span className="font-medium">D:</span> {positions.right.join(', ')}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Join Match Section - for looking_for_players matches */}
        {match.status === 'looking_for_players' && !match.isParticipant && (
          <div className="bg-white rounded-lg shadow mb-6 border-2 border-orange-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Pridruži se meču</h2>
                  <p className="text-sm text-gray-600">Ovaj meč traži još igrača. Odaberi tim kojem se želiš pridružiti.</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Tim 1 */}
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h3 className="font-semibold text-blue-700 mb-2">Tim 1</h3>
                  <div className="text-sm text-gray-700 mb-3">
                    {getTeamPlayers(1) || <span className="text-gray-400 italic">Nema igrača</span>}
                  </div>
                  {(() => {
                    const maxPlayers = match.isSingles ? 1 : 2
                    const currentPlayers = match.players.filter(p => p.team === 1).length
                    const hasSpace = currentPlayers < maxPlayers
                    return hasSpace ? (
                      <button
                        onClick={() => handleJoinMatch(1)}
                        disabled={joiningMatch}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {joiningMatch ? 'Prijava...' : `Pridruži se (${currentPlayers}/${maxPlayers})`}
                      </button>
                    ) : (
                      <div className="text-center py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
                        Tim je pun ({currentPlayers}/{maxPlayers})
                      </div>
                    )
                  })()}
                </div>

                {/* Tim 2 */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-red-700 mb-2">Tim 2</h3>
                  <div className="text-sm text-gray-700 mb-3">
                    {getTeamPlayers(2) || <span className="text-gray-400 italic">Nema igrača</span>}
                  </div>
                  {(() => {
                    const maxPlayers = match.isSingles ? 1 : 2
                    const currentPlayers = match.players.filter(p => p.team === 2).length
                    const hasSpace = currentPlayers < maxPlayers
                    return hasSpace ? (
                      <button
                        onClick={() => handleJoinMatch(2)}
                        disabled={joiningMatch}
                        className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                      >
                        {joiningMatch ? 'Prijava...' : `Pridruži se (${currentPlayers}/${maxPlayers})`}
                      </button>
                    ) : (
                      <div className="text-center py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
                        Tim je pun ({currentPlayers}/{maxPlayers})
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leave Match Button - for participants who are not the creator */}
        {match.status === 'looking_for_players' && match.isParticipant && match.creatorId !== session?.user?.id && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Prijavljen si na ovaj meč</h3>
                  <p className="text-sm text-gray-600">Možeš napustiti meč dok se još traže igrači.</p>
                </div>
                <button
                  onClick={handleLeaveMatch}
                  disabled={leavingMatch}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
                >
                  {leavingMatch ? 'Napuštanje...' : 'Napusti meč'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rotation Schedule - only show for sets not yet played (no results) */}
        {getParsedRotationSchedule() && (() => {
          const rotationSchedule = getParsedRotationSchedule()!
          const unplayedSets = rotationSchedule.filter(setConfig => {
            const setResult = match.sets.find(s => s.setNumber === setConfig.setNumber)
            return !setResult || (setResult.team1Score === 0 && setResult.team2Score === 0)
          })
          if (unplayedSets.length === 0) return null
          return (
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Preostali setovi</h2>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    Rotacija
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto">
                  {unplayedSets.map((setConfig) => (
                    <div key={setConfig.setNumber} className="border rounded-lg p-2 sm:p-3 bg-white border-gray-200 text-center">
                      <div className="text-xs font-semibold text-gray-700 mb-1">Set {setConfig.setNumber}</div>
                      <div className="text-xs">
                        <div className="text-blue-700 font-medium">{setConfig.team1.map(p => p.name.split(' ')[0]).join(' / ')}</div>
                        <div className="text-gray-400 text-[10px]">vs</div>
                        <div className="text-red-700 font-medium">{setConfig.team2.map(p => p.name.split(' ')[0]).join(' / ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Enable Rotation Button - for regular 2v2 matches that are scheduled (not looking for players) */}
        {match.canEdit &&
         !match.pairRotation &&
         !match.isSingles &&
         !match.league &&
         match.status === 'scheduled' &&
         match.players.filter(p => p.user).length === 4 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Rotacija parova</h3>
                  <p className="text-sm text-gray-600">
                    Omogući rotaciju parova po setu - svaki igrač igra s svakim
                  </p>
                </div>
                <button
                  onClick={handleEnableRotation}
                  disabled={enablingRotation}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                  {enablingRotation ? 'Omogućavanje...' : 'Omogući rotaciju'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Court Side Section (for participants) */}
        {match.isParticipant && match.sets.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tvoja pozicija na terenu</h2>
              <p className="text-sm text-gray-600 mb-4">
                Odaberi na kojoj si strani terena igrao u svakom setu (lijeva/desna).
              </p>
              {error && !editing && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                {match.sets.map((set) => {
                  const myPosition = getMyPositionForSet(set)
                  const isSaving = savingPosition === set.id
                  return (
                    <div key={set.id || set.setNumber} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="font-medium text-gray-800">
                        Set {set.setNumber} ({set.team1Score} - {set.team2Score}{set.team1Tiebreak != null && set.team2Tiebreak != null ? `, tb ${set.team1Tiebreak}-${set.team2Tiebreak}` : ''})
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => set.id && handleSetCourtSide(set.id, 'left')}
                          disabled={isSaving || !set.id}
                          className={`px-4 py-2 rounded text-sm font-medium transition ${
                            myPosition === 'left'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          } ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? '...' : 'Lijeva'}
                        </button>
                        <button
                          onClick={() => set.id && handleSetCourtSide(set.id, 'right')}
                          disabled={isSaving || !set.id}
                          className={`px-4 py-2 rounded text-sm font-medium transition ${
                            myPosition === 'right'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          } ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? '...' : 'Desna'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit Section (for creator or admin) */}
        {match.canEdit && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Upravljanje matchom</h2>
                {!editing && match.status !== 'looking_for_players' && (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Uredi rezultat
                  </button>
                )}
              </div>

              {/* Info message when looking for players */}
              {match.status === 'looking_for_players' && !editing && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Meč još traži igrače</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Rezultati se mogu unositi tek kada se svi igrači pridruže i meč prijeđe u status &quot;Zakazan&quot;.
                  </p>
                </div>
              )}

              {editing && (
                <div className="space-y-6">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status matcha
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="scheduled">Zakazan</option>
                      <option value="in_progress">U tijeku</option>
                      <option value="completed">Završeno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  </div>

                  {/* Set Scores with dropdown */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Rezultat po setovima (teniski format)
                      </label>
                      <button
                        type="button"
                        onClick={addSet}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + Dodaj set
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Povuci i ispusti setove za promjenu redoslijeda. Za nezavršene setove unesite trenutni rezultat.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {editSets.map((set, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={() => setDraggedSetIndex(idx)}
                          onDragEnd={() => setDraggedSetIndex(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedSetIndex !== null && draggedSetIndex !== idx) {
                              const newSets = [...editSets]
                              const [draggedSet] = newSets.splice(draggedSetIndex, 1)
                              newSets.splice(idx, 0, draggedSet)
                              // Renumber sets
                              const renumbered = newSets.map((s, i) => ({ ...s, setNumber: i + 1 }))
                              setEditSets(renumbered)
                            }
                            setDraggedSetIndex(null)
                          }}
                          className={`border-2 rounded-lg p-3 bg-white cursor-move transition-all ${
                            draggedSetIndex === idx
                              ? 'border-blue-500 shadow-lg scale-105 opacity-70'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow'
                          }`}
                        >
                          {/* Set Header */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-700">Set {set.setNumber}</span>
                            {editSets.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeSet(idx)
                                }}
                                className="text-red-400 hover:text-red-600 p-0.5"
                                title="Ukloni set"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Score Inputs - Vertical */}
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="7"
                              value={set.team1Score}
                              onChange={(e) => {
                                const newSets = [...editSets]
                                const newScore = parseInt(e.target.value) || 0
                                newSets[idx] = { ...newSets[idx], team1Score: newScore }
                                if (!isTiebreakScore(newScore, newSets[idx].team2Score)) {
                                  newSets[idx].team1Tiebreak = null
                                  newSets[idx].team2Tiebreak = null
                                }
                                setEditSets(newSets)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 px-2 py-2 border border-gray-300 rounded text-center text-lg font-bold text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-400 font-bold text-lg">:</span>
                            <input
                              type="number"
                              min="0"
                              max="7"
                              value={set.team2Score}
                              onChange={(e) => {
                                const newSets = [...editSets]
                                const newScore = parseInt(e.target.value) || 0
                                newSets[idx] = { ...newSets[idx], team2Score: newScore }
                                if (!isTiebreakScore(newSets[idx].team1Score, newScore)) {
                                  newSets[idx].team1Tiebreak = null
                                  newSets[idx].team2Tiebreak = null
                                }
                                setEditSets(newSets)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 px-2 py-2 border border-gray-300 rounded text-center text-lg font-bold text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Tiebreak input for 7-6 scores */}
                          {isTiebreakScore(set.team1Score, set.team2Score) && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <label className="block text-xs text-gray-500 mb-1 text-center">Tiebreak</label>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={set.team1Tiebreak ?? ''}
                                  onChange={(e) => updateTiebreakScore(idx, 1, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 bg-white"
                                  placeholder="0"
                                />
                                <span className="text-gray-400 text-sm">-</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={set.team2Tiebreak ?? ''}
                                  onChange={(e) => updateTiebreakScore(idx, 2, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 bg-white"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          )}

                          {/* Set players - compact view */}
                          {!match.isSingles && match.players.filter(p => p.user).length === 4 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              {(() => {
                                const setPlayers = set.setPlayers as EditSetPlayer[] || []
                                const team1 = setPlayers.filter(sp => sp.team === 1)
                                const team2 = setPlayers.filter(sp => sp.team === 2)
                                const getPlayerName = (odUserId: string) => {
                                  const p = match.players.find(pl => pl.user?.id === odUserId)
                                  return p?.user?.name?.split(' ')[0] || '?'
                                }
                                return (
                                  <div className="text-xs text-center space-y-1">
                                    <div className="text-blue-700 font-medium">
                                      {team1.map(sp => getPlayerName(sp.userId)).join(' / ')}
                                    </div>
                                    <div className="text-gray-400">vs</div>
                                    <div className="text-red-700 font-medium">
                                      {team2.map(sp => getPlayerName(sp.userId)).join(' / ')}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Team composition editor - expandable */}
                    {!match.isSingles && match.players.filter(p => p.user).length === 4 && editSets.some(s => s.team1Score > 0 || s.team2Score > 0) && (
                      <details className="mt-4 border border-gray-200 rounded-lg">
                        <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-t-lg">
                          Uredi parove po setovima (klikni za proširiti)
                        </summary>
                        <div className="p-4 space-y-4">
                          {editSets.filter(s => s.team1Score > 0 || s.team2Score > 0).map((set, idx) => {
                            const actualIdx = editSets.findIndex(s => s.setNumber === set.setNumber)
                            const setPlayers = set.setPlayers as EditSetPlayer[] || []
                            return (
                              <div key={set.setNumber} className="border border-gray-200 rounded-lg p-3">
                                <div className="text-sm font-semibold text-gray-700 mb-2">
                                  Set {set.setNumber} ({set.team1Score}:{set.team2Score})
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Team 1 */}
                                  <div className="bg-blue-50 rounded-lg p-2">
                                    <p className="text-xs font-semibold text-blue-700 mb-1">Tim 1:</p>
                                    {setPlayers.filter(sp => sp.team === 1).map((sp) => {
                                      const player = match.players.find(p => p.user?.id === sp.userId)
                                      if (!player?.user) return null
                                      return (
                                        <button
                                          key={sp.userId}
                                          type="button"
                                          onClick={() => {
                                            const updated = setPlayers.map(s =>
                                              s.userId === sp.userId ? { ...s, team: 2 } : s
                                            )
                                            const newSets = [...editSets]
                                            newSets[actualIdx] = { ...set, setPlayers: updated }
                                            setEditSets(newSets)
                                          }}
                                          className="w-full flex items-center justify-between p-1.5 rounded bg-blue-200 hover:bg-blue-300 mb-1 text-left"
                                        >
                                          <span className="text-xs font-medium">{player.user.name?.split(' ')[0]}</span>
                                          <span className="text-xs text-blue-600">→</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {/* Team 2 */}
                                  <div className="bg-red-50 rounded-lg p-2">
                                    <p className="text-xs font-semibold text-red-700 mb-1">Tim 2:</p>
                                    {setPlayers.filter(sp => sp.team === 2).map((sp) => {
                                      const player = match.players.find(p => p.user?.id === sp.userId)
                                      if (!player?.user) return null
                                      return (
                                        <button
                                          key={sp.userId}
                                          type="button"
                                          onClick={() => {
                                            const updated = setPlayers.map(s =>
                                              s.userId === sp.userId ? { ...s, team: 1 } : s
                                            )
                                            const newSets = [...editSets]
                                            newSets[actualIdx] = { ...set, setPlayers: updated }
                                            setEditSets(newSets)
                                          }}
                                          className="w-full flex items-center justify-between p-1.5 rounded bg-red-200 hover:bg-red-300 mb-1 text-left"
                                        >
                                          <span className="text-xs font-medium">{player.user.name?.split(' ')[0]}</span>
                                          <span className="text-xs text-red-600">→</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  {/* Save/Cancel buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {saving ? 'Spremanje...' : 'Spremi'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setError('')
                      }}
                      className="border border-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-50 transition"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}

              {!editing && (
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Obriši match
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video Section */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Video snimka
                {match.videoUrls.length > 1 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({match.videoUrls.length} dijela)</span>
                )}
              </h2>
              {(match.isParticipant || match.canEdit) && !editingVideo && (
                <button
                  onClick={() => {
                    setEditVideoUrls([...match.videoUrls])
                    setNewVideoUrl('')
                    setEditingVideo(true)
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {match.videoUrls.length > 0 ? 'Uredi videe' : '+ Dodaj video'}
                </button>
              )}
            </div>

            {editingVideo ? (
              <div className="space-y-3">
                {/* Existing URLs list */}
                {editVideoUrls.length > 0 && (
                  <div className="space-y-2">
                    {editVideoUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <span className="text-xs font-medium text-gray-500 min-w-[50px]">Dio {idx + 1}</span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVideoUrl(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new URL */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVideoUrl() } }}
                    placeholder="Zalijepi link na video (Google Drive, YouTube...)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddVideoUrl}
                    disabled={!newVideoUrl.trim()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
                  >
                    + Dodaj
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Podržani: Google Drive, YouTube. Možeš dodati više dijelova ako je video razbijen.
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSaveVideoUrls(editVideoUrls)}
                    disabled={savingVideo}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {savingVideo ? 'Spremanje...' : 'Spremi'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingVideo(false)
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Odustani
                  </button>
                </div>
              </div>
            ) : match.videoUrls.length > 0 ? (
              <div className="space-y-4">
                {match.videoUrls.map((url, idx) => (
                  <div key={idx}>
                    {match.videoUrls.length > 1 && (
                      <div className="text-sm font-medium text-gray-600 mb-2">Dio {idx + 1}</div>
                    )}
                    {getEmbedUrl(url) ? (
                      <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          src={getEmbedUrl(url)!}
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          title={`Match video${match.videoUrls.length > 1 ? ` - dio ${idx + 1}` : ''}`}
                        />
                      </div>
                    ) : (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pogledaj video{match.videoUrls.length > 1 ? ` (dio ${idx + 1})` : ''}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nema dodane video snimke.</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {match.notes && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Napomena</h2>
              <p className="text-gray-700">{match.notes}</p>
            </div>
          </div>
        )}

        {/* League info */}
        {match.league && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Liga</h2>
              <p className="text-gray-700">{match.league.name}</p>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="mt-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline font-medium"
          >
            &larr; Natrag
          </button>
        </div>
      </main>
    </div>
  )
}
