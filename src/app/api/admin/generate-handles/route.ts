import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { generateHandlesForExistingUsers } from '@/lib/handleGenerator'

// POST /api/admin/generate-handles - Generate handles for existing users
export async function POST() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only superadmin can run this
    if (!currentUser.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updatedCount = await generateHandlesForExistingUsers()

    return NextResponse.json({
      success: true,
      message: `Generirano ${updatedCount} handleova za postojeće korisnike`,
      updatedCount,
    })
  } catch (error) {
    console.error('Error generating handles:', error)
    return NextResponse.json(
      { error: 'Greška pri generiranju handleova' },
      { status: 500 }
    )
  }
}
