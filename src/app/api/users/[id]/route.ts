import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// DELETE /api/users/[id] - Delete a user
// - Superadmin može brisati sve (admine i non-admine)
// - Admin može brisati samo non-admine
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Must be admin or superadmin to delete users
    if (!currentUser.isAdmin && !currentUser.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isAdmin: true, isSuperAdmin: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Korisnik nije pronaden' },
        { status: 404 }
      )
    }

    // Cannot delete yourself
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: 'Ne mozete obrisati vlastiti racun' },
        { status: 400 }
      )
    }

    // Cannot delete superadmin
    if (targetUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Ne mozete obrisati superadmina' },
        { status: 403 }
      )
    }

    // Only superadmin can delete admins
    if (targetUser.isAdmin && !currentUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Samo superadmin moze brisati admine' },
        { status: 403 }
      )
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Korisnik obrisan' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Greska pri brisanju korisnika' },
      { status: 500 }
    )
  }
}
