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
        location: {
          select: { id: true, name: true, address: true, city: true },
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
      { error: 'Greška pri dohvaćanju rasporeda' },
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
        { error: 'Samo administrator može generirati raspored' },
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
      { error: 'Greška pri generiranju rasporeda' },
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
        { error: 'Samo administrator može ažurirati raspored' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { matchupId, scheduledAt, locationId } = body

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

    // If locationId provided, verify it exists
    if (locationId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId },
      })
      if (!location) {
        return NextResponse.json(
          { error: 'Lokacija nije pronadjena' },
          { status: 404 }
        )
      }
    }

    // If scheduledAt is provided and no match exists yet, create the match automatically
    let matchId = matchup.matchId
    if (scheduledAt && !matchup.matchId) {
      // Get team players
      const matchupWithTeams = await prisma.leagueMatchup.findUnique({
        where: { id: matchupId },
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

      if (matchupWithTeams) {
        const homePlayers = matchupWithTeams.homeTeam.players.map((p) => ({
          userId: p.user.id,
          team: 1,
        }))
        const awayPlayers = matchupWithTeams.awayTeam.players.map((p) => ({
          userId: p.user.id,
          team: 2,
        }))
        const allPlayers = [...homePlayers, ...awayPlayers]

        if (allPlayers.length === 4) {
          const newMatch = await prisma.match.create({
            data: {
              creatorId: user.id,
              leagueId,
              locationId: locationId || null,
              scheduledAt: new Date(scheduledAt),
              status: 'scheduled',
              setsToWin: 2,
              scoringType: 'golden_point',
              players: {
                create: allPlayers,
              },
            },
          })
          matchId = newMatch.id
        }
      }
    }

    const updated = await prisma.leagueMatchup.update({
      where: { id: matchupId },
      data: {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        locationId: locationId || null,
        status: scheduledAt ? 'scheduled' : 'pending',
        matchId: matchId,
      },
      include: {
        location: {
          select: { id: true, name: true, address: true, city: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating matchup:', error)
    return NextResponse.json(
      { error: 'Greška pri ažuriranju matchupa' },
      { status: 500 }
    )
  }
}
