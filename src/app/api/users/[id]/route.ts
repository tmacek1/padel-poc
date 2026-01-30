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
        { error: 'Korisnik nije pronađen' },
        { status: 404 }
      )
    }

    // Cannot delete yourself
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: 'Ne možete obrisati vlastiti račun' },
        { status: 400 }
      )
    }

    // Cannot delete superadmin
    if (targetUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Ne možete obrisati superadmina' },
        { status: 403 }
      )
    }

    // Only superadmin can delete admins
    if (targetUser.isAdmin && !currentUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Samo superadmin može brisati admine' },
        { status: 403 }
      )
    }

    // Soft delete - označimo korisnika kao obrisanog ali ga ne brišemo
    // Tako se čuvaju statistike matcheva
    await prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        // Anonimiziraj osobne podatke
        name: 'Obrisani korisnik',
        email: `deleted_${id}@deleted.local`,
        image: null,
        password: null,
        // Ukloni admin prava
        isAdmin: false,
        isSuperAdmin: false,
      },
    })

    // Obriši sessions i accounts (za sigurnost)
    await prisma.session.deleteMany({ where: { userId: id } })
    await prisma.account.deleteMany({ where: { userId: id } })

    return NextResponse.json({ success: true, message: 'Korisnik obrisan' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju korisnika' },
      { status: 500 }
    )
  }
}
