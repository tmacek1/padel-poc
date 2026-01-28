import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { getTierName } from '@/lib/leagueTiers'

// GET /api/leagues - Get all leagues
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    const leagues = await prisma.league.findMany({
      where: seasonId ? { seasonId } : {},
      include: {
        season: {
          select: { id: true, name: true, status: true },
        },
        teams: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
          },
        },
        standings: {
          orderBy: { points: 'desc' },
          include: {
            leagueTeam: {
              include: {
                players: {
                  include: {
                    user: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { teams: true, matches: true },
        },
      },
      orderBy: [{ tierOrder: 'desc' }, { createdAt: 'desc' }],
    })

    // Add computed fields
    const leaguesWithStatus = leagues.map((league) => ({
      ...league,
      tierName: getTierName(league.tier),
      isActive: league.isActive,
      teamCount: league.teams.length,
    }))

    return NextResponse.json(leaguesWithStatus)
  } catch (error) {
    console.error('Error fetching leagues:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju liga' },
      { status: 500 }
    )
  }
}

// POST /api/leagues - Create a new league (admin only)
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
        { error: 'Samo administrator moze kreirati lige' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, tier, seasonId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Naziv lige je obavezan' },
        { status: 400 }
      )
    }

    // Get tier order
    const tierOrders: Record<string, number> = {
      bronze: 1,
      silver: 2,
      gold: 3,
      platinum: 4,
      diamond: 5,
    }

    const league = await prisma.league.create({
      data: {
        name,
        description,
        tier: tier || 'bronze',
        tierOrder: tierOrders[tier] || 1,
        seasonId: seasonId || null,
        isActive: false,
      },
    })

    return NextResponse.json(league)
  } catch (error) {
    console.error('Error creating league:', error)
    return NextResponse.json(
      { error: 'Greska pri kreiranju lige' },
      { status: 500 }
    )
  }
}
