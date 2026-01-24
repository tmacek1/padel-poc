import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/seasons - Get all seasons
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seasons = await prisma.season.findMany({
      include: {
        leagues: {
          select: {
            id: true,
            name: true,
            tier: true,
            tierOrder: true,
            _count: {
              select: { teams: true, matches: true },
            },
          },
          orderBy: { tierOrder: 'desc' },
        },
        _count: {
          select: { leagues: true, standings: true },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json(seasons)
  } catch (error) {
    console.error('Error fetching seasons:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju sezona' },
      { status: 500 }
    )
  }
}

// POST /api/seasons - Create a new season (admin only)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!dbUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator moze kreirati sezone' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      startDate,
      endDate,
      minMatches,
      promotionPercent,
      relegationPercent,
      pointsForWin,
      pointsForTiebreakLoss,
      pointsForLoss,
      createDefaultLeagues,
    } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Naziv, datum pocetka i datum kraja su obavezni' },
        { status: 400 }
      )
    }

    // Create season
    const season = await prisma.season.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'upcoming',
        minMatches: minMatches || 8,
        promotionPercent: promotionPercent || 25,
        relegationPercent: relegationPercent || 25,
        pointsForWin: pointsForWin || 3,
        pointsForTiebreakLoss: pointsForTiebreakLoss || 1,
        pointsForLoss: pointsForLoss || 0,
      },
    })

    // Optionally create default leagues for the season
    if (createDefaultLeagues) {
      const tiers = [
        { tier: 'bronze', name: 'Bronzana liga', order: 1 },
        { tier: 'silver', name: 'Srebrna liga', order: 2 },
        { tier: 'gold', name: 'Zlatna liga', order: 3 },
        { tier: 'platinum', name: 'Platinasta liga', order: 4 },
        { tier: 'diamond', name: 'Dijamantna liga', order: 5 },
      ]

      for (const t of tiers) {
        await prisma.league.create({
          data: {
            name: `${t.name} - ${name}`,
            tier: t.tier,
            tierOrder: t.order,
            seasonId: season.id,
            isActive: false,
          },
        })
      }
    }

    // Fetch season with leagues
    const seasonWithLeagues = await prisma.season.findUnique({
      where: { id: season.id },
      include: {
        leagues: {
          orderBy: { tierOrder: 'desc' },
        },
      },
    })

    return NextResponse.json(seasonWithLeagues)
  } catch (error) {
    console.error('Error creating season:', error)
    return NextResponse.json(
      { error: 'Greska pri kreiranju sezone' },
      { status: 500 }
    )
  }
}
