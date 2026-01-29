import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/users - Get all users (for player selection)
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const sortBy = searchParams.get('sortBy') // 'name' or 'createdAt'

    const isAdminOrSuper = user.isAdmin === true || user.isSuperAdmin === true

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        ...(isAdminOrSuper ? { isAdmin: true, isSuperAdmin: true } : {}),
        club: {
          select: { id: true, name: true },
        },
      },
      orderBy: sortBy === 'createdAt' ? { createdAt: 'desc' } : { name: 'asc' },
      take: limit ? parseInt(limit) : 50,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju korisnika' },
      { status: 500 }
    )
  }
}
