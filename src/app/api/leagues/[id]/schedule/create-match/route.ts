import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// POST /api/leagues/[id]/schedule/create-match - Create a Match from a LeagueMatchup
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator može kreirati meč iz rasporeda' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { matchupId } = body

    if (!matchupId) {
      return NextResponse.json(
        { error: 'matchupId je obavezan' },
        { status: 400 }
      )
    }

    // Get matchup with team players
    const matchup = await prisma.leagueMatchup.findFirst({
      where: { id: matchupId, leagueId },
      include: {
        homeTeam: {
          include: {
            players: {
              include: { user: { select: { id: true } } },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              include: { user: { select: { id: true } } },
            },
          },
        },
      },
    })

    if (!matchup) {
      return NextResponse.json(
        { error: 'Matchup nije pronadjen u ovoj ligi' },
        { status: 404 }
      )
    }

    if (matchup.matchId) {
      return NextResponse.json(
        { error: 'Meč je već kreiran za ovaj matchup' },
        { status: 400 }
      )
    }

    // Build player list: homeTeam = team 1, awayTeam = team 2
    const homePlayers = matchup.homeTeam.players.map((p) => ({
      userId: p.user.id,
      team: 1,
    }))
    const awayPlayers = matchup.awayTeam.players.map((p) => ({
      userId: p.user.id,
      team: 2,
    }))
    const allPlayers = [...homePlayers, ...awayPlayers]

    if (allPlayers.length !== 4) {
      return NextResponse.json(
        { error: 'Svaki tim mora imati tocno 2 igraca' },
        { status: 400 }
      )
    }

    // Create match
    const match = await prisma.match.create({
      data: {
        creatorId: user.id,
        leagueId,
        scheduledAt: matchup.scheduledAt || null,
        status: 'scheduled',
        setsToWin: 2,
        scoringType: 'golden_point',
        players: {
          create: allPlayers,
        },
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    // Link match to matchup
    await prisma.leagueMatchup.update({
      where: { id: matchupId },
      data: {
        matchId: match.id,
        status: 'scheduled',
      },
    })

    return NextResponse.json(match)
  } catch (error) {
    console.error('Error creating match from matchup:', error)
    return NextResponse.json(
      { error: 'Greška pri kreiranju meča' },
      { status: 500 }
    )
  }
}
