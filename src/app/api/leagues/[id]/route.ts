import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getCurrentUserWithAdmin } from '@/lib/session'

// GET /api/leagues/[id] - Get single league
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        season: {
          select: { id: true, name: true, status: true },
        },
        teams: {
          include: {
            players: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    })

    if (!league) {
      return NextResponse.json({ error: 'Liga nije pronađena' }, { status: 404 })
    }

    return NextResponse.json(league)
  } catch (error) {
    console.error('Error fetching league:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju lige' },
      { status: 500 }
    )
  }
}

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

// DELETE /api/leagues/[id] - Delete league
// - Kreator lige može obrisati svoju ligu
// - Superadmin može obrisati bilo koju ligu
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const user = await getCurrentUserWithAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, creatorId: true },
    })

    if (!league) {
      return NextResponse.json(
        { error: 'Liga nije pronađena' },
        { status: 404 }
      )
    }

    // Check permissions: superadmin can delete any, creator can delete their own
    const isSuperAdmin = user.isSuperAdmin === true
    const isCreator = league.creatorId === user.id

    if (!isSuperAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Samo kreator lige ili superadmin može obrisati ligu' },
        { status: 403 }
      )
    }

    // Delete league (cascade will handle related records)
    await prisma.league.delete({
      where: { id: leagueId },
    })

    return NextResponse.json({ success: true, message: 'Liga obrisana' })
  } catch (error) {
    console.error('Error deleting league:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju lige' },
      { status: 500 }
    )
  }
}
