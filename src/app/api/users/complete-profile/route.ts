import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, gender, dominantHand, preferredCourtSide } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Ime i prezime su obavezni' },
        { status: 400 }
      )
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        gender: gender || null,
        dominantHand: dominantHand || null,
        preferredCourtSide: preferredCourtSide || null,
        profileCompleted: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        gender: true,
        dominantHand: true,
        preferredCourtSide: true,
        profileCompleted: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error completing profile:', error)
    return NextResponse.json(
      { error: 'Greska pri spremanju profila' },
      { status: 500 }
    )
  }
}
