import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/users/[id]/admin - Toggle admin status (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user is admin
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { isAdmin } = body

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'isAdmin mora biti boolean' },
        { status: 400 }
      )
    }

    // Prevent admin from removing their own admin status
    if (currentUser.id === id && !isAdmin) {
      return NextResponse.json(
        { error: 'Ne mozete sami sebi maknuti admin status' },
        { status: 400 }
      )
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Korisnik nije pronaden' },
        { status: 404 }
      )
    }

    // Update admin status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isAdmin },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating admin status:', error)
    return NextResponse.json(
      { error: 'Greska pri azuriranju admin statusa' },
      { status: 500 }
    )
  }
}
