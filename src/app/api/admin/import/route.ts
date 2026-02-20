import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ImportRow {
  datum: string
  igrac1_tim1: string
  igrac2_tim1: string
  igrac1_tim2: string
  igrac2_tim2: string
  set1_tim1: string
  set1_tim2: string
  set2_tim1: string
  set2_tim2: string
  set3_tim1: string
  set3_tim2: string
  lokacija: string
  napomena: string
}

interface ImportResult {
  row: number
  success: boolean
  error?: string
  matchId?: string
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

  const body = await req.json()
  const rows: ImportRow[] = body.rows

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Nema podataka za uvoz' }, { status: 400 })
  }

  const results: ImportResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    try {
      // Validate date
      const date = new Date(row.datum)
      if (isNaN(date.getTime())) {
        results.push({ row: rowNum, success: false, error: `Neispravan datum: "${row.datum}"` })
        continue
      }

      // Find players by email
      const emails = [row.igrac1_tim1, row.igrac2_tim1, row.igrac1_tim2, row.igrac2_tim2]
      const players = await prisma.user.findMany({
        where: { email: { in: emails }, isDeleted: false },
        select: { id: true, email: true },
      })

      const emailToId: Record<string, string> = {}
      players.forEach((p) => {
        emailToId[p.email!] = p.id
      })

      // Check all players exist
      const missingEmails = emails.filter((e) => e && !emailToId[e])
      if (missingEmails.length > 0) {
        results.push({
          row: rowNum,
          success: false,
          error: `Igrači nisu pronađeni: ${missingEmails.join(', ')}`,
        })
        continue
      }

      // Validate set scores
      const sets: { setNumber: number; team1Score: number; team2Score: number }[] = []

      const s1t1 = parseInt(row.set1_tim1)
      const s1t2 = parseInt(row.set1_tim2)
      if (!isNaN(s1t1) && !isNaN(s1t2) && (s1t1 > 0 || s1t2 > 0)) {
        sets.push({ setNumber: 1, team1Score: s1t1, team2Score: s1t2 })
      }

      const s2t1 = parseInt(row.set2_tim1)
      const s2t2 = parseInt(row.set2_tim2)
      if (!isNaN(s2t1) && !isNaN(s2t2) && (s2t1 > 0 || s2t2 > 0)) {
        sets.push({ setNumber: 2, team1Score: s2t1, team2Score: s2t2 })
      }

      const s3t1 = parseInt(row.set3_tim1)
      const s3t2 = parseInt(row.set3_tim2)
      if (!isNaN(s3t1) && !isNaN(s3t2) && (s3t1 > 0 || s3t2 > 0)) {
        sets.push({ setNumber: 3, team1Score: s3t1, team2Score: s3t2 })
      }

      if (sets.length === 0) {
        results.push({ row: rowNum, success: false, error: 'Nema validnih setova' })
        continue
      }

      // Find or skip location
      let locationId: string | null = null
      if (row.lokacija && row.lokacija.trim()) {
        const location = await prisma.location.findFirst({
          where: { name: { contains: row.lokacija.trim(), mode: 'insensitive' } },
        })
        if (location) {
          locationId = location.id
        }
      }

      // Create match with sets and players
      const match = await prisma.match.create({
        data: {
          scheduledAt: date,
          playedAt: date,
          status: 'completed',
          creatorId: session.user.id,
          locationId,
          notes: row.napomena?.trim() || null,
          scoringType: 'golden_point',
          setsToWin: 2,
          players: {
            create: [
              { userId: emailToId[row.igrac1_tim1], team: 1 },
              { userId: emailToId[row.igrac2_tim1], team: 1 },
              { userId: emailToId[row.igrac1_tim2], team: 2 },
              { userId: emailToId[row.igrac2_tim2], team: 2 },
            ],
          },
          sets: {
            create: sets,
          },
        },
      })

      results.push({ row: rowNum, success: true, matchId: match.id })
    } catch (err) {
      results.push({
        row: rowNum,
        success: false,
        error: err instanceof Error ? err.message : 'Nepoznata greška',
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  const errorCount = results.filter((r) => !r.success).length

  return NextResponse.json({
    total: rows.length,
    success: successCount,
    errors: errorCount,
    results,
  })
}
