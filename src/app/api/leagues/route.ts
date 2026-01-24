import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/leagues - Get all leagues
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leagues = await prisma.league.findMany({
      include: {
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
        _count: {
          select: { teams: true, matches: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Add isActive status based on team count
    const leaguesWithStatus = leagues.map((league) => ({
      ...league,
      isActive: league.teams.length >= 5,
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
    const { name, description, startDate, endDate } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Naziv lige je obavezan' },
        { status: 400 }
      )
    }

    const league = await prisma.league.create({
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: false, // Will become active when 5+ teams join
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
