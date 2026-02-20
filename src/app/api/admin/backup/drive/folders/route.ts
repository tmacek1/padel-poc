import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listAppFolders, createDriveFolder } from '@/lib/googleDrive'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Neautorizirano' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Samo administratori' }, { status: 403 })
  }

  try {
    const folders = await listAppFolders(session.user.id)
    return NextResponse.json({ folders })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NO_GOOGLE_ACCOUNT') {
      return NextResponse.json(
        { error: 'Nema povezanog Google računa s Drive pristupom.', code: 'NO_GOOGLE_ACCOUNT' },
        { status: 400 }
      )
    }
    console.error('Drive folders error:', error)
    return NextResponse.json({ error: 'Greška pri dohvatu foldera' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Neautorizirano' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Samo administratori' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const folderName = body.name?.trim()
    if (!folderName) {
      return NextResponse.json({ error: 'Naziv foldera je obavezan' }, { status: 400 })
    }

    const folder = await createDriveFolder(session.user.id, folderName)
    return NextResponse.json({ folder })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NO_GOOGLE_ACCOUNT') {
      return NextResponse.json(
        { error: 'Nema povezanog Google računa s Drive pristupom.', code: 'NO_GOOGLE_ACCOUNT' },
        { status: 400 }
      )
    }
    console.error('Drive create folder error:', error)
    return NextResponse.json({ error: 'Greška pri kreiranju foldera' }, { status: 500 })
  }
}
