import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { checkAllPlayersConflicts } from '@/lib/matchConflicts'
import { generatePairRotationSchedule } from '@/lib/pairRotation'

// GET /api/matches - Get all matches (with optional filters)
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    const matches = await prisma.match.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId
          ? {
              players: {
                some: { userId },
              },
            }
          : {}),
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true, isGuest: true },
        },
        location: true,
        league: {
          select: { id: true, name: true, tier: true },
        },
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true, isGuest: true },
            },
          },
        },
        sets: {
          orderBy: { setNumber: 'asc' },
          include: {
            setPlayers: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    })

    return NextResponse.json(matches)
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju matcheva' },
      { status: 500 }
    )
  }
}

// POST /api/matches - Create a new match
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { locationId, scheduledAt, players, notes, ignoreConflicts, scoringType, durationMinutes, isSingles, isLookingForPlayers, pairRotation } = body

    // Validate players based on match type and mode
    const expectedPlayerCount = isSingles ? 2 : 4

    if (isLookingForPlayers) {
      // Za "tražim igrače" treba barem 1 igrač
      if (!players || players.length === 0) {
        return NextResponse.json(
          { error: 'Potreban je barem jedan igrač' },
          { status: 400 }
        )
      }
    } else {
      // Standardna validacija - svi igrači potrebni
      if (!players || players.length !== expectedPlayerCount) {
        return NextResponse.json(
          { error: isSingles ? 'Singles meč zahtijeva točno 2 igrača' : 'Padel meč zahtijeva točno 4 igrača' },
          { status: 400 }
        )
      }
    }

    // Set duration: use provided value for regular matches, default 90 for league matches
    const matchDuration = durationMinutes || 90

    // Check for conflicts for all players
    const scheduledDate = new Date(scheduledAt)
    const playerIds = players.map((p: { userId: string }) => p.userId)
    const conflictsMap = await checkAllPlayersConflicts(playerIds, scheduledDate, matchDuration)

    // Check for critical conflicts (same time)
    const criticalConflicts: { userId: string; conflicts: unknown[] }[] = []
    const warnings: { userId: string; conflicts: unknown[] }[] = []

    conflictsMap.forEach((conflicts, odUserId) => {
      const critical = conflicts.filter((c) => c.type === 'same_time')
      const warning = conflicts.filter((c) => c.type === 'same_day')

      if (critical.length > 0) {
        criticalConflicts.push({ userId: odUserId, conflicts: critical })
      }
      if (warning.length > 0) {
        warnings.push({ userId: odUserId, conflicts: warning })
      }
    })

    // If there are critical conflicts, reject unless ignoreConflicts is true
    if (criticalConflicts.length > 0 && !ignoreConflicts) {
      return NextResponse.json(
        {
          error: 'Postoje konflikti u rasporedu',
          criticalConflicts,
          warnings,
        },
        { status: 409 }
      )
    }

    // Determine match status based on whether we're looking for players
    const matchStatus = isLookingForPlayers ? 'looking_for_players' : 'scheduled'

    // Generate rotation schedule if pairRotation is enabled and we have 4 players
    let pairRotationScheduleJson: string | null = null
    if (pairRotation && !isSingles && players.length === 4) {
      // Get user details for schedule
      const playerUserIds = players.map((p: { userId: string }) => p.userId)
      const playerUsers = await prisma.user.findMany({
        where: { id: { in: playerUserIds } },
        select: { id: true, name: true, email: true },
      })

      // Sort players: team1 first, then team2
      const sortedPlayers = [
        ...players.filter((p: { team: number }) => p.team === 1),
        ...players.filter((p: { team: number }) => p.team === 2),
      ]

      const schedule = generatePairRotationSchedule()
      const pairRotationSchedule = schedule.map(config => ({
        setNumber: config.setNumber,
        team1: config.team1.map(idx => {
          const player = sortedPlayers[idx]
          const user = playerUsers.find(u => u.id === player?.userId)
          return {
            odUserId: player?.userId || '',
            name: user?.name || user?.email || 'Nepoznato',
          }
        }),
        team2: config.team2.map(idx => {
          const player = sortedPlayers[idx]
          const user = playerUsers.find(u => u.id === player?.userId)
          return {
            odUserId: player?.userId || '',
            name: user?.name || user?.email || 'Nepoznato',
          }
        }),
      }))
      pairRotationScheduleJson = JSON.stringify(pairRotationSchedule)
    }

    // If there are warnings, return them but allow creation
    const match = await prisma.match.create({
      data: {
        creatorId: user.id,
        locationId: locationId || null,
        scheduledAt: scheduledDate,
        notes,
        status: matchStatus,
        scoringType: scoringType || 'golden_point',
        setsToWin: 2,
        durationMinutes: matchDuration,
        isSingles: isSingles || false,
        pairRotation: pairRotation || false,
        pairRotationSchedule: pairRotationScheduleJson,
        players: {
          create: players.map((p: { userId: string; team: number }) => ({
            userId: p.userId,
            team: p.team,
          })),
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true, isGuest: true },
        },
        location: true,
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true, isGuest: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      match,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  } catch (error) {
    console.error('Error creating match:', error)
    return NextResponse.json(
      { error: 'Greška pri kreiranju meča' },
      { status: 500 }
    )
  }
}
