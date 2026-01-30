import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { generatePairRotationSchedule } from '@/lib/pairRotation'

// POST /api/matches/[id]/rotation - Enable pair rotation and generate schedule
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

    // Get match
    const match = await prisma.match.findUnique({
      where: { id },
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

    if (!match) {
      return NextResponse.json({ error: 'Meč nije pronađen' }, { status: 404 })
    }

    // Check permissions - only creator or admin
    const isCreator = match.creatorId === user.id
    if (!isCreator && !user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo kreator meča ili admin može omogućiti rotaciju' },
        { status: 403 }
      )
    }

    // Check if match hasn't started
    if (match.status !== 'scheduled' && match.status !== 'looking_for_players') {
      return NextResponse.json(
        { error: 'Rotacija se može omogućiti samo za matcheve koji još nisu počeli' },
        { status: 400 }
      )
    }

    // Check if it's not a singles match
    if (match.isSingles) {
      return NextResponse.json(
        { error: 'Rotacija parova nije dostupna za 1v1 matcheve' },
        { status: 400 }
      )
    }

    // Check if it's not a league match
    if (match.leagueId) {
      return NextResponse.json(
        { error: 'Rotacija parova nije dostupna za ligaške matcheve' },
        { status: 400 }
      )
    }

    // Check if we have exactly 4 players
    const activePlayers = match.players.filter(p => p.userId !== null)
    if (activePlayers.length !== 4) {
      return NextResponse.json(
        { error: 'Za rotaciju parova potrebna su točno 4 igrača' },
        { status: 400 }
      )
    }

    // Generate rotation schedule
    const schedule = generatePairRotationSchedule()

    // Get players in order (team1 first, then team2)
    const playersList = [
      ...activePlayers.filter(p => p.team === 1),
      ...activePlayers.filter(p => p.team === 2),
    ]

    // Map schedule to actual players
    const pairRotationSchedule = schedule.map(config => ({
      setNumber: config.setNumber,
      team1: config.team1.map(idx => ({
        odUserId: playersList[idx]?.userId || '',
        name: playersList[idx]?.user?.name || playersList[idx]?.user?.email || 'Nepoznato',
      })),
      team2: config.team2.map(idx => ({
        odUserId: playersList[idx]?.userId || '',
        name: playersList[idx]?.user?.name || playersList[idx]?.user?.email || 'Nepoznato',
      })),
    }))

    // Update match with rotation enabled and schedule
    await prisma.match.update({
      where: { id },
      data: {
        pairRotation: true,
        pairRotationSchedule: JSON.stringify(pairRotationSchedule),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Rotacija parova omogućena',
      schedule: pairRotationSchedule,
    })
  } catch (error) {
    console.error('Error enabling rotation:', error)
    return NextResponse.json(
      { error: 'Greška pri omogućavanju rotacije' },
      { status: 500 }
    )
  }
}
