import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/rankings/pairs - Get pair rankings split by regular and rotation matches
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

    const getPairKey = (a: string, b: string) => [a, b].sort().join('_')

    for (const match of matches) {
      if (match.pairRotation) {
        for (const set of match.sets) {
          if (set.team1Score < 6 && set.team2Score < 6) continue
          if (!set.setPlayers || set.setPlayers.length < 4) continue

          const team1 = set.setPlayers.filter(sp => sp.team === 1).map(sp => sp.userId)
          const team2 = set.setPlayers.filter(sp => sp.team === 2).map(sp => sp.userId)
          if (team1.length !== 2 || team2.length !== 2) continue

          const k1 = getPairKey(team1[0], team1[1])
          const k2 = getPairKey(team2[0], team2[1])

          if (!rotationStats[k1]) rotationStats[k1] = { wins: 0, losses: 0, draws: 0 }
          if (!rotationStats[k2]) rotationStats[k2] = { wins: 0, losses: 0, draws: 0 }

          if (set.team1Score > set.team2Score) { rotationStats[k1].wins++; rotationStats[k2].losses++ }
          else if (set.team2Score > set.team1Score) { rotationStats[k2].wins++; rotationStats[k1].losses++ }
          else { rotationStats[k1].draws++; rotationStats[k2].draws++ }
        }
      } else {
        const team1 = match.players.filter(p => p.team === 1 && p.userId).map(p => p.userId!)
        const team2 = match.players.filter(p => p.team === 2 && p.userId).map(p => p.userId!)
        if (team1.length !== 2 || team2.length !== 2) continue

        const k1 = getPairKey(team1[0], team1[1])
        const k2 = getPairKey(team2[0], team2[1])

        if (!regularStats[k1]) regularStats[k1] = { wins: 0, losses: 0, draws: 0 }
        if (!regularStats[k2]) regularStats[k2] = { wins: 0, losses: 0, draws: 0 }

        let t1Sets = 0, t2Sets = 0
        for (const set of match.sets) {
          if (set.team1Score < 6 && set.team2Score < 6) continue
          if (set.team1Score > set.team2Score) t1Sets++
          else if (set.team2Score > set.team1Score) t2Sets++
        }

        if (t1Sets > t2Sets) { regularStats[k1].wins++; regularStats[k2].losses++ }
        else if (t2Sets > t1Sets) { regularStats[k2].wins++; regularStats[k1].losses++ }
        else { regularStats[k1].draws++; regularStats[k2].draws++ }
      }
    }

    const allUserIds = new Set<string>()
    ;[...Object.keys(regularStats), ...Object.keys(rotationStats)].forEach(key => {
      const [id1, id2] = key.split('_')
      allUserIds.add(id1)
      allUserIds.add(id2)
    })

    if (allUserIds.size === 0) {
      return NextResponse.json({ regular: [], rotation: [] })
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true },
    })
    const userMap = new Map(users.map(u => [u.id, u.name || 'Nepoznato']))

    const buildRanking = (stats: Record<string, { wins: number; losses: number; draws: number }>) =>
      Object.entries(stats)
        .map(([pairKey, s]) => {
          const [id1, id2] = pairKey.split('_')
          const total = s.wins + s.losses + s.draws
          const winRate = total > 0 ? Math.round((s.wins / total) * 1000) / 10 : 0
          return {
            pairKey, player1Id: id1, player2Id: id2,
            player1Name: userMap.get(id1) || 'Nepoznato',
            player2Name: userMap.get(id2) || 'Nepoznato',
            wins: s.wins, losses: s.losses, draws: s.draws, totalMatches: total, winRate,
          }
        })
        .filter(r => r.totalMatches >= 5)
        .sort((a, b) => b.winRate !== a.winRate ? b.winRate - a.winRate : b.wins - a.wins)
        .slice(0, 10)

    return NextResponse.json({
      regular: buildRanking(regularStats),
      rotation: buildRanking(rotationStats),
    })
  } catch (error) {
    console.error('Error fetching pair rankings:', error)
    return NextResponse.json({ error: 'Greska pri dohvacanju rankinga parova' }, { status: 500 })
  }
}
