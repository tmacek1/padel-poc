import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// DELETE /api/users/me - Delete own account
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from DB to check superadmin status
    const dbUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { isSuperAdmin: true },
    })

    // Superadmin cannot delete themselves (protection)
    if (dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Superadmin ne može obrisati vlastiti račun' },
        { status: 403 }
      )
    }

    // Soft delete - označimo korisnika kao obrisanog ali ga ne brišemo
    // Tako se čuvaju statistike matcheva
    const odUserId = currentUser.id
    await prisma.user.update({
      where: { id: odUserId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        // Anonimiziraj osobne podatke
        name: 'Obrisani korisnik',
        email: `deleted_${odUserId}@deleted.local`,
        image: null,
        password: null,
        // Ukloni admin prava
        isAdmin: false,
        isSuperAdmin: false,
      },
    })

    // Obriši sessions i accounts (za sigurnost)
    await prisma.session.deleteMany({ where: { userId: odUserId } })
    await prisma.account.deleteMany({ where: { userId: odUserId } })

    return NextResponse.json({ success: true, message: 'Račun uspješno obrisan' })
  } catch (error) {
    console.error('Error deleting own account:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju računa' },
      { status: 500 }
    )
  }
}
