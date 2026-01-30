import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { sendWelcomeEmail } from '@/lib/email'

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

    // Check if this is the first time completing profile (for welcome email)
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileCompleted: true, email: true },
    })
    const isFirstTimeCompletion = !existingUser?.profileCompleted

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

    // Send welcome email for first-time profile completion (Google OAuth users)
    if (isFirstTimeCompletion && updatedUser.email) {
      sendWelcomeEmail(updatedUser.email, updatedUser.name).catch((err) => {
        console.error('Failed to send welcome email:', err)
      })
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error completing profile:', error)
    return NextResponse.json(
      { error: 'Greška pri spremanju profila' },
      { status: 500 }
    )
  }
}
