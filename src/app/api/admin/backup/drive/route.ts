import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBackupBuffer } from '@/lib/backup'
import { uploadToDrive } from '@/lib/googleDrive'

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

  const type = req.nextUrl.searchParams.get('type') || 'matches'
  const folderId = req.nextUrl.searchParams.get('folderId') || undefined

  try {
    const { buffer, filename } = await generateBackupBuffer(type)
    const result = await uploadToDrive(session.user.id, filename, buffer, folderId)

    return NextResponse.json({
      success: true,
      filename,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NO_GOOGLE_ACCOUNT') {
      return NextResponse.json(
        {
          error: 'Nema povezanog Google računa s Drive pristupom. Odjavite se i ponovo prijavite putem Googlea.',
          code: 'NO_GOOGLE_ACCOUNT',
        },
        { status: 400 }
      )
    }

    console.error('Drive upload error:', error)
    return NextResponse.json(
      { error: 'Greška pri uploadu na Google Drive' },
      { status: 500 }
    )
  }
}
