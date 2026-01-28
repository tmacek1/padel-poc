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
              select: { id: true, name: true, city: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Korisnik nije pronaden' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju profila' },
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
    const { name, clubId, locationIds } = body

    // Update user
    await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(clubId !== undefined ? { clubId } : {}),
      },
    })

    // Update locations if provided
    if (locationIds !== undefined) {
      // Remove existing locations
      await prisma.userLocation.deleteMany({
        where: { userId: id },
      })

      // Add new locations
      if (locationIds.length > 0) {
        await prisma.userLocation.createMany({
          data: locationIds.map((locationId: string, index: number) => ({
            userId: id,
            locationId,
            isPrimary: index === 0,
          })),
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
        club: {
          select: { id: true, name: true },
        },
        locations: {
          include: {
            location: {
              select: { id: true, name: true, city: true },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Greska pri azuriranju profila' },
      { status: 500 }
    )
  }
}
