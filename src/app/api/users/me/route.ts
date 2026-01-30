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

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: currentUser.id },
    })

    return NextResponse.json({ success: true, message: 'Račun uspješno obrisan' })
  } catch (error) {
    console.error('Error deleting own account:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju računa' },
      { status: 500 }
    )
  }
}
