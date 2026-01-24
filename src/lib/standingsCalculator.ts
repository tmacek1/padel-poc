import { prisma } from './prisma'

interface MatchResult {
  matchId: string
  team1Wins: number
  team2Wins: number
  team1Games: number
  team2Games: number
  winnerTeam: number | null
  isTiebreakLoss: boolean
  tiebreakLossTeam: number | null
}

// Izracunaj rezultat meca iz setova
export function calculateMatchResult(sets: { team1Score: number; team2Score: number }[]): MatchResult {
  let team1Wins = 0
  let team2Wins = 0
  let team1Games = 0
  let team2Games = 0

  for (const set of sets) {
    team1Games += set.team1Score
    team2Games += set.team2Score

    if (set.team1Score > set.team2Score) {
      team1Wins++
    } else if (set.team2Score > set.team1Score) {
      team2Wins++
    }
  }

  let winnerTeam: number | null = null
  if (team1Wins > team2Wins) winnerTeam = 1
  else if (team2Wins > team1Wins) winnerTeam = 2

  // Provjeri je li tiebreak (3. set, blizak rezultat)
  const isTiebreakLoss = sets.length === 3 &&
    Math.abs(sets[2].team1Score - sets[2].team2Score) <= 2

  const tiebreakLossTeam = isTiebreakLoss ? (winnerTeam === 1 ? 2 : 1) : null

  return {
    matchId: '',
    team1Wins,
    team2Wins,
    team1Games,
    team2Games,
    winnerTeam,
    isTiebreakLoss,
    tiebreakLossTeam,
  }
}

// Azuriraj bodove tima nakon meca
export async function updateTeamStandings(
  seasonId: string,
  leagueId: string,
  leagueTeamId: string,
  matchResult: {
    isWinner: boolean
    isTiebreakLoss: boolean
    setsWon: number
    setsLost: number
    gamesWon: number
    gamesLost: number
  },
  season: {
    pointsForWin: number
    pointsForTiebreakLoss: number
    pointsForLoss: number
  }
) {
  // Izracunaj bodove
  let pointsEarned = 0
  if (matchResult.isWinner) {
    pointsEarned = season.pointsForWin
  } else if (matchResult.isTiebreakLoss) {
    pointsEarned = season.pointsForTiebreakLoss
  } else {
    pointsEarned = season.pointsForLoss
  }

  // Pronadi ili kreiraj standing
  const existing = await prisma.seasonStanding.findFirst({
    where: {
      seasonId,
      leagueId,
      leagueTeamId,
    },
  })

  if (existing) {
    await prisma.seasonStanding.update({
      where: { id: existing.id },
      data: {
        points: { increment: pointsEarned },
        matchesPlayed: { increment: 1 },
        wins: { increment: matchResult.isWinner ? 1 : 0 },
        losses: { increment: matchResult.isWinner ? 0 : 1 },
        tiebreakLosses: { increment: matchResult.isTiebreakLoss ? 1 : 0 },
        setsWon: { increment: matchResult.setsWon },
        setsLost: { increment: matchResult.setsLost },
        gamesWon: { increment: matchResult.gamesWon },
        gamesLost: { increment: matchResult.gamesLost },
      },
    })
  } else {
    await prisma.seasonStanding.create({
      data: {
        seasonId,
        leagueId,
        leagueTeamId,
        points: pointsEarned,
        matchesPlayed: 1,
        wins: matchResult.isWinner ? 1 : 0,
        losses: matchResult.isWinner ? 0 : 1,
        tiebreakLosses: matchResult.isTiebreakLoss ? 1 : 0,
        setsWon: matchResult.setsWon,
        setsLost: matchResult.setsLost,
        gamesWon: matchResult.gamesWon,
        gamesLost: matchResult.gamesLost,
      },
    })
  }
}

// Izracunaj promocije i ispadanja na kraju sezone
export async function calculatePromotionsAndRelegations(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      leagues: {
        orderBy: { tierOrder: 'asc' },
      },
    },
  })

  if (!season) return

  const promotionPercent = season.promotionPercent / 100
  const relegationPercent = season.relegationPercent / 100

  for (let i = 0; i < season.leagues.length; i++) {
    const league = season.leagues[i]
    const higherLeague = season.leagues[i + 1] // visa liga
    const lowerLeague = season.leagues[i - 1] // niza liga

    // Dohvati standings za ovu ligu
    const standings = await prisma.seasonStanding.findMany({
      where: {
        seasonId,
        leagueId: league.id,
        matchesPlayed: { gte: season.minMatches },
      },
      orderBy: { points: 'desc' },
    })

    const totalTeams = standings.length
    if (totalTeams === 0) continue

    const promotionCount = Math.floor(totalTeams * promotionPercent)
    const relegationCount = Math.floor(totalTeams * relegationPercent)

    // Oznaci promocije (top X%)
    for (let j = 0; j < promotionCount && higherLeague; j++) {
      await prisma.seasonStanding.update({
        where: { id: standings[j].id },
        data: {
          finalRank: j + 1,
          promotedToLeagueId: higherLeague.id,
        },
      })
    }

    // Oznaci ispadanja (bottom X%)
    for (let j = 0; j < relegationCount && lowerLeague; j++) {
      const idx = totalTeams - 1 - j
      await prisma.seasonStanding.update({
        where: { id: standings[idx].id },
        data: {
          finalRank: idx + 1,
          relegatedToLeagueId: lowerLeague.id,
        },
      })
    }

    // Oznaci ostale (ostaju u istoj ligi)
    for (let j = promotionCount; j < totalTeams - relegationCount; j++) {
      await prisma.seasonStanding.update({
        where: { id: standings[j].id },
        data: {
          finalRank: j + 1,
        },
      })
    }
  }
}
