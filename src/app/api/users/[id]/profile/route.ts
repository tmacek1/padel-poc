import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/users/[id]/profile - Get user profile
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        handle: true,
        email: true,
        image: true,
        createdAt: true,
        gender: true,
        dominantHand: true,
        preferredCourtSide: true,
        club: {
          select: { id: true, name: true },
        },
        locations: {
          include: {
            location: {
              select: { id: true, name: true, address: true, city: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Korisnik nije pronađen' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju profila' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id]/profile - Update user profile
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Users can only update their own profile
    if (currentUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { clubName, locationId, dominantHand, preferredCourtSide } = body

    // Resolve club by name: find existing or create new
    let clubId: string | null = null
    if (clubName !== undefined) {
      if (clubName) {
        const trimmed = clubName.trim()
        let club = await prisma.club.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        })
        if (!club) {
          club = await prisma.club.create({ data: { name: trimmed } })
        }
        clubId = club.id
      }
    }

    // Update user
    await prisma.user.update({
      where: { id },
      data: {
        ...(clubName !== undefined ? { clubId } : {}),
        ...(dominantHand !== undefined ? { dominantHand: dominantHand || null } : {}),
        ...(preferredCourtSide !== undefined ? { preferredCourtSide: preferredCourtSide || null } : {}),
      },
    })

    // Update location if provided (single location)
    if (locationId !== undefined) {
      // Remove existing locations
      await prisma.userLocation.deleteMany({
        where: { userId: id },
      })

      // Add new location
      if (locationId) {
        await prisma.userLocation.create({
          data: {
            userId: id,
            locationId,
            isPrimary: true,
          },
        })
      }
    }

    // Fetch updated profile
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        dominantHand: true,
        preferredCourtSide: true,
        club: {
          select: { id: true, name: true },
        },
        locations: {
          include: {
            location: {
              select: { id: true, name: true, address: true, city: true },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Greška pri ažuriranju profila' },
      { status: 500 }
    )
  }
}
