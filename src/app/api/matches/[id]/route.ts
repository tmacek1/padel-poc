import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// GET /api/matches/[id] - Get a single match
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const match = await prisma.match.findUnique({
      where: { id },
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
        sets: {
          orderBy: { setNumber: 'asc' },
          include: {
            playerPositions: true,
            setPlayers: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        league: {
          select: { id: true, name: true },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match nije pronađen' }, { status: 404 })
    }

    // Check if user is a participant
    const isParticipant = match.players.some(p => p.user.id === user.id)

    // Check if match is completed and has results
    const isCompletedWithResults = match.status === 'completed' && match.sets.length > 0

    // Edit permissions:
    // - If match is completed with results: only admin can edit
    // - Otherwise: any participant can edit (to enter results)
    const canEdit = isCompletedWithResults
      ? user.isAdmin === true
      : isParticipant || user.isAdmin === true

    return NextResponse.json({ ...match, canEdit, isParticipant })
  } catch (error) {
    console.error('Error fetching match:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju matcha' },
      { status: 500 }
    )
  }
}

// PUT /api/matches/[id] - Update a match (creator or admin can update)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check match and user permissions
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        players: { select: { userId: true } },
        sets: { select: { id: true } },
      },
    })

    if (!existingMatch) {
      return NextResponse.json({ error: 'Match nije pronađen' }, { status: 404 })
    }

    const isParticipant = existingMatch.players.some(p => p.userId === user.id)
    const isCompletedWithResults = existingMatch.status === 'completed' && existingMatch.sets.length > 0

    // Permission check:
    // - If match is completed with results: only admin can edit
    // - Otherwise: any participant can edit
    if (isCompletedWithResults) {
      if (!user.isAdmin) {
        return NextResponse.json(
          { error: 'Završeni meč s upisanim rezultatom može mijenjati samo administrator' },
          { status: 403 }
        )
      }
    } else {
      if (!isParticipant && !user.isAdmin) {
        return NextResponse.json(
          { error: 'Samo sudionici meča ili admin mogu upisati rezultat' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { locationId, scheduledAt, playedAt, status, notes, sets } = body

    // Update match
    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(locationId !== undefined ? { locationId } : {}),
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(playedAt ? { playedAt: new Date(playedAt) } : {}),
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
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
        sets: {
          orderBy: { setNumber: 'asc' },
        },
      },
    })

    // Update sets if provided
    if (sets && Array.isArray(sets)) {
      // Delete existing sets and recreate
      await prisma.matchSet.deleteMany({ where: { matchId: id } })

      for (const set of sets) {
        const createdSet = await prisma.matchSet.create({
          data: {
            matchId: id,
            setNumber: set.setNumber,
            team1Score: set.team1Score,
            team2Score: set.team2Score,
            team1Tiebreak: set.team1Tiebreak || null,
            team2Tiebreak: set.team2Tiebreak || null,
          },
        })

        // Create set players if provided (for classic matches with different players per set)
        if (set.setPlayers && Array.isArray(set.setPlayers)) {
          for (const sp of set.setPlayers) {
            await prisma.setPlayer.create({
              data: {
                matchSetId: createdSet.id,
                userId: sp.userId,
                team: sp.team,
              },
            })
          }
        }
      }
    }

    // Fetch updated match with sets
    const updatedMatch = await prisma.match.findUnique({
      where: { id },
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
        sets: {
          orderBy: { setNumber: 'asc' },
          include: {
            setPlayers: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedMatch)
  } catch (error) {
    console.error('Error updating match:', error)
    return NextResponse.json(
      { error: 'Greska pri azuriranju meca' },
      { status: 500 }
    )
  }
}

// DELETE /api/matches/[id] - Delete a match (creator or admin can delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the creator or admin
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { creatorId: true },
    })

    if (!existingMatch) {
      return NextResponse.json({ error: 'Match nije pronađen' }, { status: 404 })
    }

    if (existingMatch.creatorId !== user.id && !user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo kreator matcha ili admin može obrisati match' },
        { status: 403 }
      )
    }

    await prisma.match.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting match:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju matcha' },
      { status: 500 }
    )
  }
}
