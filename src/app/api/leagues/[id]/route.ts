import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// PATCH /api/leagues/[id] - Toggle league active status (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator može mijenjati status lige' },
        { status: 403 }
      )
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    })

    if (!league) {
      return NextResponse.json(
        { error: 'Liga nije pronađena' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive mora biti boolean' },
        { status: 400 }
      )
    }

    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: { isActive },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating league:', error)
    return NextResponse.json(
      { error: 'Greška pri ažuriranju lige' },
      { status: 500 }
    )
  }
}
