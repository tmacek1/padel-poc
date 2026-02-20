import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listDriveFolders } from '@/lib/googleDrive'

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

  const parentId = req.nextUrl.searchParams.get('parentId') || undefined

  try {
    const folders = await listDriveFolders(session.user.id, parentId)
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
