import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/clubs - Get all clubs
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clubs = await prisma.club.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    })

    return NextResponse.json(clubs)
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju klubova' },
      { status: 500 }
    )
  }
}
