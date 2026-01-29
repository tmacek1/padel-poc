import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/users/[id]/admin - Toggle admin status
// - Admin i superadmin mogu dati admin prava
// - Samo superadmin može maknuti admin prava s admina
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

    // Must be admin or superadmin
    if (!currentUser.isAdmin && !currentUser.isSuperAdmin) {
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

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isAdmin: true, isSuperAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Korisnik nije pronaden' },
        { status: 404 }
      )
    }

    // Cannot modify superadmin status through this endpoint
    if (targetUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Ne mozete mijenjati status superadmina' },
        { status: 403 }
      )
    }

    // Prevent removing own admin status
    if (currentUser.id === id && !isAdmin) {
      return NextResponse.json(
        { error: 'Ne mozete sami sebi maknuti admin status' },
        { status: 400 }
      )
    }

    // Only superadmin can remove admin rights from an admin
    if (targetUser.isAdmin && !isAdmin && !currentUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Samo superadmin moze maknuti admin prava s admina' },
        { status: 403 }
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
        isSuperAdmin: true,
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
