import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/matches/[id] - Get a single match
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
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
        },
        league: {
          select: { id: true, name: true },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Mec nije pronaden' }, { status: 404 })
    }

    // Add flag to indicate if current user can edit
    const canEdit = match.creatorId === user.id

    return NextResponse.json({ ...match, canEdit })
  } catch (error) {
    console.error('Error fetching match:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju meca' },
      { status: 500 }
    )
  }
}

// PUT /api/matches/[id] - Update a match (only creator can update)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the creator
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { creatorId: true },
    })

    if (!existingMatch) {
      return NextResponse.json({ error: 'Mec nije pronaden' }, { status: 404 })
    }

    if (existingMatch.creatorId !== user.id) {
      return NextResponse.json(
        { error: 'Samo kreator meca moze mijenjati podatke' },
        { status: 403 }
      )
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
        await prisma.matchSet.create({
          data: {
            matchId: id,
            setNumber: set.setNumber,
            team1Score: set.team1Score,
            team2Score: set.team2Score,
            team1Tiebreak: set.team1Tiebreak || null,
            team2Tiebreak: set.team2Tiebreak || null,
          },
        })
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

// DELETE /api/matches/[id] - Delete a match (only creator can delete)
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

    // Check if user is the creator
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { creatorId: true },
    })

    if (!existingMatch) {
      return NextResponse.json({ error: 'Mec nije pronaden' }, { status: 404 })
    }

    if (existingMatch.creatorId !== user.id) {
      return NextResponse.json(
        { error: 'Samo kreator meca moze obrisati mec' },
        { status: 403 }
      )
    }

    await prisma.match.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting match:', error)
    return NextResponse.json(
      { error: 'Greska pri brisanju meca' },
      { status: 500 }
    )
  }
}
