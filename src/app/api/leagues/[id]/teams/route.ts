import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// GET /api/leagues/[id]/teams - Get teams in a league
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

    const teams = await prisma.leagueTeam.findMany({
      where: { leagueId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    })

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Error fetching league teams:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju timova' },
      { status: 500 }
    )
  }
}

// POST /api/leagues/[id]/teams - Add a team to a league (admin only)
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

    // Check if user is admin
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator može dodavati timove u ligu' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { player1Id, player2Id, teamName } = body

    if (!player1Id || !player2Id) {
      return NextResponse.json(
        { error: 'Oba igrača su obavezna' },
        { status: 400 }
      )
    }

    if (player1Id === player2Id) {
      return NextResponse.json(
        { error: 'Igrači moraju biti različiti' },
        { status: 400 }
      )
    }

    // Check if league exists
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    })

    if (!league) {
      return NextResponse.json(
        { error: 'Liga nije pronađena' },
        { status: 404 }
      )
    }

    // Check if either player is already in a team in this league
    const existingTeamPlayers = await prisma.leagueTeamPlayer.findMany({
      where: {
        userId: { in: [player1Id, player2Id] },
        leagueTeam: { leagueId },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (existingTeamPlayers.length > 0) {
      const playerNames = existingTeamPlayers
        .map((p) => p.user.name || p.user.email)
        .join(', ')
      return NextResponse.json(
        { error: `Igrač(i) ${playerNames} već su u timu u ovoj ligi` },
        { status: 400 }
      )
    }

    // Create team with players
    const team = await prisma.leagueTeam.create({
      data: {
        leagueId,
        name: teamName || null,
        players: {
          create: [
            { userId: player1Id },
            { userId: player2Id },
          ],
        },
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    })

    // Check if league should become active (2+ teams)
    const teamCount = await prisma.leagueTeam.count({
      where: { leagueId },
    })

    if (teamCount >= 2 && !league.isActive) {
      await prisma.league.update({
        where: { id: leagueId },
        data: { isActive: true },
      })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error('Error adding team to league:', error)
    return NextResponse.json(
      { error: 'Greška pri dodavanju tima' },
      { status: 500 }
    )
  }
}

// DELETE /api/leagues/[id]/teams - Remove a team from a league (admin only)
export async function DELETE(
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
        { error: 'Samo administrator može brisati timove iz lige' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId je obavezan' },
        { status: 400 }
      )
    }

    // Check if team exists and belongs to this league
    const team = await prisma.leagueTeam.findFirst({
      where: { id: teamId, leagueId },
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Tim nije pronađen u ovoj ligi' },
        { status: 404 }
      )
    }

    // Delete team (cascade will delete LeagueTeamPlayer entries)
    await prisma.leagueTeam.delete({
      where: { id: teamId },
    })

    // Check if league should become inactive (less than 2 teams)
    const teamCount = await prisma.leagueTeam.count({
      where: { leagueId },
    })

    if (teamCount < 2) {
      await prisma.league.update({
        where: { id: leagueId },
        data: { isActive: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing team from league:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju tima' },
      { status: 500 }
    )
  }
}
