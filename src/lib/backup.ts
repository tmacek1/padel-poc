import { prisma } from './prisma'
import * as XLSX from 'xlsx'

export async function generateBackupBuffer(type: string): Promise<{ buffer: Buffer; filename: string }> {
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
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        handle: true,
        gender: true,
        isGuest: true,
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
      Gost: u.isGuest ? 'Da' : 'Ne',
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

    // --- Statistika po igračima sheet ---
    const allUsers = await prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const completedMatches = await prisma.match.findMany({
      where: { status: 'completed', leagueId: null },
      select: {
        id: true,
        pairRotation: true,
        players: true,
        sets: {
          include: { setPlayers: true },
        },
      },
    })

    const statsRows = allUsers.map((u) => {
      let regularWins = 0, regularLosses = 0, regularDraws = 0
      let rotationSetsWon = 0, rotationSetsLost = 0, rotationSetsDrawn = 0
      let totalSetsWon = 0, totalSetsLost = 0
      let totalGamesWon = 0, totalGamesLost = 0

      for (const match of completedMatches) {
        const userPlayer = match.players.find((p) => p.userId === u.id)
        if (!userPlayer) continue

        const defaultTeam = userPlayer.team
        let matchSetsWon = 0, matchSetsLost = 0, matchSetsDrawn = 0

        for (const set of match.sets) {
          const setPlayerRecord = set.setPlayers?.find((sp) => sp.userId === u.id)
          const userTeam = setPlayerRecord ? setPlayerRecord.team : defaultTeam

          if (userTeam === 1) {
            totalGamesWon += set.team1Score
            totalGamesLost += set.team2Score
          } else {
            totalGamesWon += set.team2Score
            totalGamesLost += set.team1Score
          }

          const wonSet = (userTeam === 1 && set.team1Score > set.team2Score) ||
                         (userTeam === 2 && set.team2Score > set.team1Score)
          const draw = set.team1Score === set.team2Score

          if (wonSet) { matchSetsWon++; totalSetsWon++ }
          else if (draw) { matchSetsDrawn++ }
          else { matchSetsLost++; totalSetsLost++ }
        }

        if (match.pairRotation) {
          rotationSetsWon += matchSetsWon
          rotationSetsLost += matchSetsLost
          rotationSetsDrawn += matchSetsDrawn
        } else {
          if (matchSetsWon > matchSetsLost) regularWins++
          else if (matchSetsLost > matchSetsWon) regularLosses++
          else regularDraws++
        }
      }

      const totalRegular = regularWins + regularLosses + regularDraws
      const totalRotation = rotationSetsWon + rotationSetsLost + rotationSetsDrawn
      const totalSets = totalSetsWon + totalSetsLost
      const totalGames = totalGamesWon + totalGamesLost

      return {
        'Igrač': u.name || u.email,
        'Reg. matchevi': totalRegular,
        'Reg. pobjede': regularWins,
        'Reg. porazi': regularLosses,
        'Reg. neriješeno': regularDraws,
        'Reg. win%': totalRegular > 0 ? Math.round((regularWins / totalRegular) * 1000) / 10 : 0,
        'Rot. setovi': totalRotation,
        'Rot. dobiveni': rotationSetsWon,
        'Rot. izgubljeni': rotationSetsLost,
        'Rot. neriješeni': rotationSetsDrawn,
        'Rot. win%': totalRotation > 0 ? Math.round((rotationSetsWon / totalRotation) * 1000) / 10 : 0,
        'Ukupno setovi W': totalSetsWon,
        'Ukupno setovi L': totalSetsLost,
        'Set win%': totalSets > 0 ? Math.round((totalSetsWon / totalSets) * 1000) / 10 : 0,
        'Ukupno gemovi W': totalGamesWon,
        'Ukupno gemovi L': totalGamesLost,
        'Gem win%': totalGames > 0 ? Math.round((totalGamesWon / totalGames) * 1000) / 10 : 0,
      }
    }).filter((row) => row['Reg. matchevi'] > 0 || row['Rot. setovi'] > 0)

    const wsStats = XLSX.utils.json_to_sheet(statsRows)
    XLSX.utils.book_append_sheet(wb, wsStats, 'Statistika')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const now = new Date().toISOString().slice(0, 10)
  const filename = `padel-backup-${type}-${now}.xlsx`

  return { buffer: buf, filename }
}
