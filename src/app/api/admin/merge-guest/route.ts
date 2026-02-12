import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// GET /api/admin/merge-guest - Lista ghost korisnika
export async function GET() {
  try {
    const user = await getCurrentUserWithAdmin()
    if (!user?.isAdmin && !user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guestUsers = await prisma.user.findMany({
      where: {
        isGuest: true,
        mergedIntoId: null,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        _count: {
          select: {
            matchPlayers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = guestUsers.map((g) => ({
      id: g.id,
      name: g.name,
      firstName: g.firstName,
      lastName: g.lastName,
      createdAt: g.createdAt,
      matchCount: g._count.matchPlayers,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching guest users:', error)
    return NextResponse.json(
      { error: 'Greška pri dohvaćanju gost korisnika' },
      { status: 500 }
    )
  }
}

// POST /api/admin/merge-guest - Spoji gosta s registriranim korisnikom
export async function POST(request: Request) {
  try {
    const user = await getCurrentUserWithAdmin()
    if (!user?.isAdmin && !user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { guestUserId, targetUserId } = body

    if (!guestUserId || !targetUserId) {
      return NextResponse.json(
        { error: 'guestUserId i targetUserId su obavezni' },
        { status: 400 }
      )
    }

    if (guestUserId === targetUserId) {
      return NextResponse.json(
        { error: 'Ne možete spojiti korisnika sa samim sobom' },
        { status: 400 }
      )
    }

    // Provjeri da guest postoji i da je guest
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { id: true, isGuest: true, mergedIntoId: true },
    })

    if (!guestUser || !guestUser.isGuest) {
      return NextResponse.json(
        { error: 'Gost korisnik nije pronađen' },
        { status: 404 }
      )
    }

    if (guestUser.mergedIntoId) {
      return NextResponse.json(
        { error: 'Gost korisnik je već spojen' },
        { status: 400 }
      )
    }

    // Provjeri da target postoji i da NIJE guest
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isGuest: true, isDeleted: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Ciljni korisnik nije pronađen' },
        { status: 404 }
      )
    }

    if (targetUser.isGuest) {
      return NextResponse.json(
        { error: 'Ne možete spojiti gosta s drugim gostom' },
        { status: 400 }
      )
    }

    if (targetUser.isDeleted) {
      return NextResponse.json(
        { error: 'Ciljni korisnik je obrisan' },
        { status: 400 }
      )
    }

    // Izvrši merge u transakciji
    let mergedMatches = 0
    let skippedDuplicates = 0

    await prisma.$transaction(async (tx) => {
      // 1. MatchPlayer - transfer ili briši duplikate
      const guestMatchPlayers = await tx.matchPlayer.findMany({
        where: { userId: guestUserId },
      })

      for (const mp of guestMatchPlayers) {
        // Provjeri da li target već postoji u tom matchu
        const existing = await tx.matchPlayer.findUnique({
          where: {
            matchId_userId: {
              matchId: mp.matchId,
              userId: targetUserId,
            },
          },
        })

        if (existing) {
          // Target je već u matchu - obriši guest zapis
          await tx.matchPlayer.delete({ where: { id: mp.id } })
          skippedDuplicates++
        } else {
          // Prebaci na target
          await tx.matchPlayer.update({
            where: { id: mp.id },
            data: { userId: targetUserId },
          })
          mergedMatches++
        }
      }

      // 2. SetPlayer - transfer ili briši duplikate
      const guestSetPlayers = await tx.setPlayer.findMany({
        where: { userId: guestUserId },
      })

      for (const sp of guestSetPlayers) {
        const existing = await tx.setPlayer.findUnique({
          where: {
            matchSetId_userId: {
              matchSetId: sp.matchSetId,
              userId: targetUserId,
            },
          },
        })

        if (existing) {
          await tx.setPlayer.delete({ where: { id: sp.id } })
        } else {
          await tx.setPlayer.update({
            where: { id: sp.id },
            data: { userId: targetUserId },
          })
        }
      }

      // 3. SetPlayerPosition - transfer ili briši duplikate
      const guestPositions = await tx.setPlayerPosition.findMany({
        where: { userId: guestUserId },
      })

      for (const pos of guestPositions) {
        const existing = await tx.setPlayerPosition.findUnique({
          where: {
            matchSetId_userId: {
              matchSetId: pos.matchSetId,
              userId: targetUserId,
            },
          },
        })

        if (existing) {
          await tx.setPlayerPosition.delete({ where: { id: pos.id } })
        } else {
          await tx.setPlayerPosition.update({
            where: { id: pos.id },
            data: { userId: targetUserId },
          })
        }
      }

      // 4. Ghost User - označi kao spojen i soft delete
      await tx.user.update({
        where: { id: guestUserId },
        data: {
          mergedIntoId: targetUserId,
          isDeleted: true,
          deletedAt: new Date(),
        },
      })
    })

    return NextResponse.json({
      mergedMatches,
      skippedDuplicates,
    })
  } catch (error) {
    console.error('Error merging guest user:', error)
    return NextResponse.json(
      { error: 'Greška pri spajanju gost korisnika' },
      { status: 500 }
    )
  }
}
