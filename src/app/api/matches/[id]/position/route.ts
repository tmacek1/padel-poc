import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[id]/position - Set player court side for a set
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { setId, courtSide } = body

    // Validate court side
    if (!['left', 'right'].includes(courtSide)) {
      return NextResponse.json(
        { error: 'Strana mora biti "left" ili "right"' },
        { status: 400 }
      )
    }

    // Check if user is a participant in this match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: true,
        sets: true,
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match nije pronađen' }, { status: 404 })
    }

    const isParticipant = match.players.some(p => p.userId === session.user.id)
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Samo sudionici matcha mogu postaviti svoju poziciju' },
        { status: 403 }
      )
    }

    // Check if the set belongs to this match
    const matchSet = match.sets.find(s => s.id === setId)
    if (!matchSet) {
      return NextResponse.json(
        { error: 'Set nije pronađen u ovom matchu' },
        { status: 404 }
      )
    }

    // Upsert the player position
    const position = await prisma.setPlayerPosition.upsert({
      where: {
        matchSetId_userId: {
          matchSetId: setId,
          userId: session.user.id,
        },
      },
      update: {
        courtSide,
      },
      create: {
        matchSetId: setId,
        userId: session.user.id,
        courtSide,
      },
    })

    return NextResponse.json(position)
  } catch (error) {
    console.error('Error setting player position:', error)
    return NextResponse.json(
      { error: 'Greška pri postavljanju pozicije' },
      { status: 500 }
    )
  }
}
