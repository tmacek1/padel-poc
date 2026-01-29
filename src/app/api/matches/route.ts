import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { checkAllPlayersConflicts } from '@/lib/matchConflicts'

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
          select: { id: true, name: true, email: true, image: true },
        },
        location: true,
        league: {
          select: { id: true, name: true, tier: true },
        },
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        sets: {
          orderBy: { setNumber: 'asc' },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    })

    return NextResponse.json(matches)
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju meceva' },
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
    const { locationId, scheduledAt, players, notes, ignoreConflicts, scoringType, durationMinutes } = body

    // Validate players (padel is 2v2, so we need 4 players)
    if (!players || players.length !== 4) {
      return NextResponse.json(
        { error: 'Padel mec zahtijeva tocno 4 igraca' },
        { status: 400 }
      )
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

    // If there are warnings, return them but allow creation
    const match = await prisma.match.create({
      data: {
        creatorId: user.id,
        locationId: locationId || null,
        scheduledAt: scheduledDate,
        notes,
        status: 'scheduled',
        scoringType: scoringType || 'golden_point',
        setsToWin: 2,
        durationMinutes: matchDuration,
        players: {
          create: players.map((p: { userId: string; team: number }) => ({
            userId: p.userId,
            team: p.team,
          })),
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        location: true,
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
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
      { error: 'Greska pri kreiranju meca' },
      { status: 500 }
    )
  }
}
