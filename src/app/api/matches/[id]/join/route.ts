import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// POST /api/matches/[id]/join - Join a match that's looking for players
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { team } = body // 1 or 2

    if (!team || (team !== 1 && team !== 2)) {
      return NextResponse.json(
        { error: 'Neispravan tim. Mora biti 1 ili 2.' },
        { status: 400 }
      )
    }

    // Get match
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        players: true,
      },
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Meč nije pronađen' },
        { status: 404 }
      )
    }

    // Check if match is looking for players
    if (match.status !== 'looking_for_players') {
      return NextResponse.json(
        { error: 'Ovaj meč ne traži igrače' },
        { status: 400 }
      )
    }

    // Check if user is already in the match
    const alreadyJoined = match.players.some((p) => p.userId === user.id)
    if (alreadyJoined) {
      return NextResponse.json(
        { error: 'Već si prijavljen na ovaj meč' },
        { status: 400 }
      )
    }

    // Check if team has space
    const maxPlayersPerTeam = match.isSingles ? 1 : 2
    const teamPlayers = match.players.filter((p) => p.team === team)
    if (teamPlayers.length >= maxPlayersPerTeam) {
      return NextResponse.json(
        { error: 'Odabrani tim je već popunjen' },
        { status: 400 }
      )
    }

    // Add player to match
    await prisma.matchPlayer.create({
      data: {
        matchId: id,
        userId: user.id,
        team,
      },
    })

    // Check if match is now full
    const updatedMatch = await prisma.match.findUnique({
      where: { id },
      include: { players: true },
    })

    const requiredPlayers = match.isSingles ? 2 : 4
    if (updatedMatch && updatedMatch.players.length >= requiredPlayers) {
      // Match is full, change status to scheduled
      await prisma.match.update({
        where: { id },
        data: { status: 'scheduled' },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Uspješno si se prijavio na meč',
    })
  } catch (error) {
    console.error('Error joining match:', error)
    return NextResponse.json(
      { error: 'Greška pri prijavi na meč' },
      { status: 500 }
    )
  }
}

// DELETE /api/matches/[id]/join - Leave a match
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get match
    const match = await prisma.match.findUnique({
      where: { id },
      include: { players: true },
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Meč nije pronađen' },
        { status: 404 }
      )
    }

    // Check if match is still looking for players or scheduled (not started/completed)
    if (!['looking_for_players', 'scheduled'].includes(match.status)) {
      return NextResponse.json(
        { error: 'Ne možeš napustiti meč koji je u tijeku ili završen' },
        { status: 400 }
      )
    }

    // Check if user is the creator - creator can't leave
    if (match.creatorId === user.id) {
      return NextResponse.json(
        { error: 'Kreator meča ne može napustiti meč. Obriši meč ako ga želiš otkazati.' },
        { status: 400 }
      )
    }

    // Find player entry
    const playerEntry = match.players.find((p) => p.userId === user.id)
    if (!playerEntry) {
      return NextResponse.json(
        { error: 'Nisi prijavljen na ovaj meč' },
        { status: 400 }
      )
    }

    // Remove player
    await prisma.matchPlayer.delete({
      where: { id: playerEntry.id },
    })

    // If match was scheduled, change back to looking_for_players
    if (match.status === 'scheduled') {
      await prisma.match.update({
        where: { id },
        data: { status: 'looking_for_players' },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Uspješno si napustio meč',
    })
  } catch (error) {
    console.error('Error leaving match:', error)
    return NextResponse.json(
      { error: 'Greška pri napuštanju meča' },
      { status: 500 }
    )
  }
}
