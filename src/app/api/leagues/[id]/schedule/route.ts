import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'
import { generateRoundRobin } from '@/lib/roundRobin'

// GET /api/leagues/[id]/schedule - Get league schedule
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchups = await prisma.leagueMatchup.findMany({
      where: { leagueId },
      include: {
        homeTeam: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        match: {
          select: {
            id: true,
            status: true,
            playedAt: true,
            sets: {
              select: {
                setNumber: true,
                team1Score: true,
                team2Score: true,
              },
              orderBy: { setNumber: 'asc' },
            },
          },
        },
      },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(matchups)
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju rasporeda' },
      { status: 500 }
    )
  }
}

// POST /api/leagues/[id]/schedule - Generate round-robin schedule (admin only)
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
        { error: 'Samo administrator moze generirati raspored' },
        { status: 403 }
      )
    }

    // Check league exists and is active
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        teams: { orderBy: { createdAt: 'asc' } },
        matchups: true,
      },
    })

    if (!league) {
      return NextResponse.json(
        { error: 'Liga nije pronadjena' },
        { status: 404 }
      )
    }

    if (!league.isActive) {
      return NextResponse.json(
        { error: 'Liga mora biti aktivna za generiranje rasporeda' },
        { status: 400 }
      )
    }

    if (league.teams.length < 2) {
      return NextResponse.json(
        { error: 'Potrebna su barem 2 tima za raspored' },
        { status: 400 }
      )
    }

    // Delete existing schedule if any
    if (league.matchups.length > 0) {
      await prisma.leagueMatchup.deleteMany({
        where: { leagueId },
      })
    }

    // Generate round-robin
    const roundRobinMatchups = generateRoundRobin(league.teams.length)

    // Map indices to team IDs
    const teamIds = league.teams.map((t) => t.id)

    const data = roundRobinMatchups.map((m) => ({
      leagueId,
      round: m.round,
      homeTeamId: teamIds[m.homeIndex],
      awayTeamId: teamIds[m.awayIndex],
      status: 'pending',
    }))

    await prisma.leagueMatchup.createMany({ data })

    // Fetch created matchups with relations
    const created = await prisma.leagueMatchup.findMany({
      where: { leagueId },
      include: {
        homeTeam: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(created)
  } catch (error) {
    console.error('Error generating schedule:', error)
    return NextResponse.json(
      { error: 'Greska pri generiranju rasporeda' },
      { status: 500 }
    )
  }
}

// PATCH /api/leagues/[id]/schedule - Update matchup (set date/time) (admin only)
export async function PATCH(
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
        { error: 'Samo administrator moze azurirati raspored' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { matchupId, scheduledAt } = body

    if (!matchupId) {
      return NextResponse.json(
        { error: 'matchupId je obavezan' },
        { status: 400 }
      )
    }

    // Verify matchup belongs to this league
    const matchup = await prisma.leagueMatchup.findFirst({
      where: { id: matchupId, leagueId },
    })

    if (!matchup) {
      return NextResponse.json(
        { error: 'Matchup nije pronadjen u ovoj ligi' },
        { status: 404 }
      )
    }

    const updated = await prisma.leagueMatchup.update({
      where: { id: matchupId },
      data: {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'scheduled' : 'pending',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating matchup:', error)
    return NextResponse.json(
      { error: 'Greska pri azuriranju matchupa' },
      { status: 500 }
    )
  }
}
