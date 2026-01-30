import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { generateUniqueHandle } from '@/lib/handleGenerator'

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email i lozinka su obavezni' },
        { status: 400 }
      )
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Ime i prezime su obavezni' },
        { status: 400 }
      )
    }

    // Kombinira ime i prezime za NextAuth kompatibilnost
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    // Generiraj jedinstveni handle
    const handle = await generateUniqueHandle(firstName.trim(), lastName.trim())

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Korisnik s ovim emailom već postoji' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if this is the superadmin email
    const superadminEmail = process.env.SUPERADMIN_EMAIL
    const isSuperAdmin = superadminEmail === email

    // Create user
    const user = await prisma.user.create({
      data: {
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        handle,
        email,
        password: hashedPassword,
        isSuperAdmin,
        isAdmin: isSuperAdmin, // superadmin is also admin
      },
    })

    // Send welcome email (don't wait, fire and forget)
    sendWelcomeEmail(email, fullName).catch((err) => {
      console.error('Failed to send welcome email:', err)
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Greška pri registraciji' },
      { status: 500 }
    )
  }
}
