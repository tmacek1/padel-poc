import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/rankings - Get player rankings split by regular and rotation matches
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matches = await prisma.match.findMany({
      where: { status: 'completed', leagueId: null },
      select: {
        id: true,
        pairRotation: true,
        players: true,
        sets: { include: { setPlayers: true } },
      },
    })

    const regularStats: Record<string, { wins: number; losses: number; draws: number }> = {}
    const rotationStats: Record<string, { wins: number; losses: number; draws: number }> = {}

    for (const match of matches) {
      for (const player of match.players) {
        if (!player.userId) continue

        const defaultTeam = player.team
        let setsWon = 0
        let setsLost = 0
        let setsDrawn = 0

        for (const set of match.sets) {
          if (set.team1Score < 6 && set.team2Score < 6) continue

          const setPlayerRecord = set.setPlayers?.find(sp => sp.userId === player.userId)
          const userTeam = setPlayerRecord ? setPlayerRecord.team : defaultTeam

          const won = (userTeam === 1 && set.team1Score > set.team2Score) || (userTeam === 2 && set.team2Score > set.team1Score)
          const lost = (userTeam === 1 && set.team2Score > set.team1Score) || (userTeam === 2 && set.team1Score > set.team2Score)

          if (won) setsWon++
          else if (lost) setsLost++
          else setsDrawn++
        }

        if (match.pairRotation) {
          if (!rotationStats[player.userId]) rotationStats[player.userId] = { wins: 0, losses: 0, draws: 0 }
          rotationStats[player.userId].wins += setsWon
          rotationStats[player.userId].losses += setsLost
          rotationStats[player.userId].draws += setsDrawn
        } else {
          if (!regularStats[player.userId]) regularStats[player.userId] = { wins: 0, losses: 0, draws: 0 }
          if (setsWon > setsLost) regularStats[player.userId].wins++
          else if (setsLost > setsWon) regularStats[player.userId].losses++
          else regularStats[player.userId].draws++
        }
      }
    }

    const allUserIds = new Set([...Object.keys(regularStats), ...Object.keys(rotationStats)])
    if (allUserIds.size === 0) {
      return NextResponse.json({ regular: [], rotation: [] })
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const buildRanking = (stats: Record<string, { wins: number; losses: number; draws: number }>) =>
      Object.entries(stats)
        .map(([userId, s]) => {
          const total = s.wins + s.losses + s.draws
          const winRate = total > 0 ? Math.round((s.wins / total) * 1000) / 10 : 0
          const u = userMap.get(userId)
          return { userId, name: u?.name || 'Nepoznato', wins: s.wins, losses: s.losses, draws: s.draws, totalMatches: total, winRate }
        })
        .filter(r => r.totalMatches >= 5)
        .sort((a, b) => b.winRate !== a.winRate ? b.winRate - a.winRate : b.wins - a.wins)
        .slice(0, 10)

    return NextResponse.json({
      regular: buildRanking(regularStats),
      rotation: buildRanking(rotationStats),
    })
  } catch (error) {
    console.error('Error fetching rankings:', error)
    return NextResponse.json({ error: 'Greska pri dohvacanju rankinga' }, { status: 500 })
  }
}
