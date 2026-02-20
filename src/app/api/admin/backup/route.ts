import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Neautorizirano' }, { status: 401 })
  }

  // Check admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Samo administratori' }, { status: 403 })
  }

  const type = req.nextUrl.searchParams.get('type') || 'matches'
  const wb = XLSX.utils.book_new()

  // --- Matchevi sheet ---
  const matches = await prisma.match.findMany({
    include: {
      location: true,
      creator: { select: { name: true, email: true } },
      players: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      sets: { orderBy: { setNumber: 'asc' } },
      league: { select: { name: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  })

  const matchRows = matches.map((m) => {
    const team1 = m.players
      .filter((p) => p.team === 1)
      .map((p) => p.user?.name || p.user?.email || '-')
      .join(' / ')
    const team2 = m.players
      .filter((p) => p.team === 2)
      .map((p) => p.user?.name || p.user?.email || '-')
      .join(' / ')

    const setsStr = m.sets
      .map((s) => {
        let score = `${s.team1Score}-${s.team2Score}`
        if (s.team1Tiebreak != null && s.team2Tiebreak != null) {
          score += ` (${s.team1Tiebreak}-${s.team2Tiebreak})`
        }
        return score
      })
      .join(', ')

    let team1Sets = 0
    let team2Sets = 0
    m.sets.forEach((s) => {
      if (s.team1Score > s.team2Score) team1Sets++
      else if (s.team2Score > s.team1Score) team2Sets++
    })

    return {
      ID: m.id,
      Datum: m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString('hr-HR') : '',
      Vrijeme: m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '',
      Status: m.status,
      'Tim 1': team1,
      'Tim 2': team2,
      'Rezultat (setovi)': `${team1Sets} - ${team2Sets}`,
      'Detalji setova': setsStr,
      Lokacija: m.location?.name || '',
      Liga: m.league?.name || '',
      Kreator: m.creator?.name || m.creator?.email || '',
      'Tip bodovanja': m.scoringType || '',
      'Rotacija parova': m.pairRotation ? 'Da' : 'Ne',
      'Trajanje (min)': m.durationMinutes || '',
      Napomena: m.notes || '',
    }
  })

  const wsMatches = XLSX.utils.json_to_sheet(matchRows)
  XLSX.utils.book_append_sheet(wb, wsMatches, 'Matchevi')

  if (type === 'all') {
    // --- Igrači sheet ---
    const users = await prisma.user.findMany({
      where: { isDeleted: false, isGuest: false },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        handle: true,
        gender: true,
        dominantHand: true,
        preferredCourtSide: true,
        isAdmin: true,
        createdAt: true,
        club: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const userRows = users.map((u) => ({
      ID: u.id,
      Ime: u.firstName || '',
      Prezime: u.lastName || '',
      'Puno ime': u.name || '',
      Email: u.email || '',
      Handle: u.handle || '',
      Spol: u.gender === 'male' ? 'M' : u.gender === 'female' ? 'Ž' : '',
      'Dominantna ruka': u.dominantHand === 'right' ? 'Desna' : u.dominantHand === 'left' ? 'Lijeva' : '',
      'Strana terena': u.preferredCourtSide === 'right' ? 'Desna' : u.preferredCourtSide === 'left' ? 'Lijeva' : '',
      Klub: u.club?.name || '',
      Admin: u.isAdmin ? 'Da' : 'Ne',
      'Datum registracije': u.createdAt ? new Date(u.createdAt).toLocaleDateString('hr-HR') : '',
    }))

    const wsUsers = XLSX.utils.json_to_sheet(userRows)
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Igrači')

    // --- Lige sheet ---
    const leagues = await prisma.league.findMany({
      include: {
        season: { select: { name: true } },
        teams: {
          include: {
            players: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const leagueRows = leagues.map((l) => ({
      ID: l.id,
      Naziv: l.name,
      Opis: l.description || '',
      Tier: l.tier,
      Aktivna: l.isActive ? 'Da' : 'Ne',
      Sezona: l.season?.name || '',
      'Broj timova': l.teams.length,
      Timovi: l.teams
        .map((t) => t.players.map((p) => p.user.name).join(' / '))
        .join('; '),
    }))

    const wsLeagues = XLSX.utils.json_to_sheet(leagueRows)
    XLSX.utils.book_append_sheet(wb, wsLeagues, 'Lige')

    // --- Statistika (Standings) sheet ---
    const standings = await prisma.seasonStanding.findMany({
      include: {
        user: { select: { name: true, email: true } },
        season: { select: { name: true } },
        leagueTeam: {
          include: {
            players: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { points: 'desc' },
    })

    const standingRows = standings.map((s) => ({
      Sezona: s.season?.name || '',
      Igrač: s.user?.name || s.user?.email || '',
      Par: s.leagueTeam?.players.map((p) => p.user.name).join(' / ') || '',
      Bodovi: s.points,
      'Odigrani matchevi': s.matchesPlayed,
      Pobjede: s.wins,
      Porazi: s.losses,
      'Izgubljeni tiebreakovi': s.tiebreakLosses,
    }))

    const wsStandings = XLSX.utils.json_to_sheet(standingRows)
    XLSX.utils.book_append_sheet(wb, wsStandings, 'Statistika')
  }

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const now = new Date().toISOString().slice(0, 10)
  const filename = `padel-backup-${type}-${now}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
