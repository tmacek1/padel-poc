import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/users - Get all users (for player selection)
// Samo za internu upotrebu - ne može se pristupiti direktno preko URL-a
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Security: Provjeri da zahtjev dolazi iz aplikacije (AJAX request)
    // Browser direktni zahtjevi neće imati X-Requested-With header
    const isAjaxRequest = request.headers.get('x-requested-with') === 'XMLHttpRequest' ||
                          request.headers.get('accept')?.includes('application/json') ||
                          request.headers.get('sec-fetch-mode') === 'cors'

    // Provjeri referer - mora biti s iste domene
    const referer = request.headers.get('referer')
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    const isValidReferer = referer && host && (
      referer.includes(host) ||
      referer.includes('localhost') ||
      referer.includes('vercel.app')
    )

    const isValidOrigin = origin && host && (
      origin.includes(host) ||
      origin.includes('localhost') ||
      origin.includes('vercel.app')
    )

    // Ako nije AJAX request i nema valid referer/origin, odbij
    if (!isAjaxRequest && !isValidReferer && !isValidOrigin) {
      return NextResponse.json(
        { error: 'Direktan pristup nije dozvoljen' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const sortBy = searchParams.get('sortBy') // 'name' or 'createdAt'

    const isAdminOrSuper = user.isAdmin === true || user.isSuperAdmin === true

    // Za ne-admine pretražuj samo po imenu, admini mogu i po emailu
    const searchCondition = search
      ? isAdminOrSuper
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
      : {}

    const users = await prisma.user.findMany({
      where: {
        isDeleted: false, // Ne prikazuj obrisane korisnike
        ...searchCondition,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        handle: true,
        image: true,
        createdAt: true,
        isGuest: true,
        // Samo admini vide osjetljive podatke
        ...(isAdminOrSuper
          ? {
              email: true,
              isAdmin: true,
              isSuperAdmin: true,
            }
          : {}),
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
      { error: 'Greška pri dohvaćanju korisnika' },
      { status: 500 }
    )
  }
}
