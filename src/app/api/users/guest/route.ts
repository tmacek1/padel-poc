import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// POST /api/users/guest - Kreiranje ghost korisnika
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: 'Ime i prezime su obavezni' },
        { status: 400 }
      )
    }

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()

    // Generiraj unique placeholder email
    const uniqueId = crypto.randomUUID().slice(0, 8)
    const placeholderEmail = `guest_${uniqueId}@guest.padel`

    const guestUser = await prisma.user.create({
      data: {
        name: `${trimmedFirst} ${trimmedLast}`,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: placeholderEmail,
        isGuest: true,
        profileCompleted: false,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        isGuest: true,
      },
    })

    return NextResponse.json(guestUser)
  } catch (error) {
    console.error('Error creating guest user:', error)
    return NextResponse.json(
      { error: 'Greška pri kreiranju gost korisnika' },
      { status: 500 }
    )
  }
}
