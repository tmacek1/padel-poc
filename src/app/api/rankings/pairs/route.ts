import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/rankings/pairs - Get pair rankings (top pairs by win rate)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all completed non-league matches with players and sets
    const matches = await prisma.match.findMany({
      where: {
        status: 'completed',
        leagueId: null,
      },
      select: {
        id: true,
        pairRotation: true,
        players: true,
        sets: {
          include: {
            setPlayers: true,
          },
        },
      },
    })

    // Calculate stats per pair
    // Key format: "userId1_userId2" (sorted alphabetically)
    const pairStats: Record<string, { wins: number; losses: number; draws: number }> = {}

    const getPairKey = (player1Id: string, player2Id: string) => {
      return [player1Id, player2Id].sort().join('_')
    }

    for (const match of matches) {
      if (match.pairRotation) {
        // For rotation matches, check pairs per set
        for (const set of match.sets) {
          if (!set.setPlayers || set.setPlayers.length < 4) continue

          const team1Players = set.setPlayers.filter(sp => sp.team === 1).map(sp => sp.userId)
          const team2Players = set.setPlayers.filter(sp => sp.team === 2).map(sp => sp.userId)

          if (team1Players.length !== 2 || team2Players.length !== 2) continue

          const team1Key = getPairKey(team1Players[0], team1Players[1])
          const team2Key = getPairKey(team2Players[0], team2Players[1])

          if (!pairStats[team1Key]) pairStats[team1Key] = { wins: 0, losses: 0, draws: 0 }
          if (!pairStats[team2Key]) pairStats[team2Key] = { wins: 0, losses: 0, draws: 0 }

          if (set.team1Score > set.team2Score) {
            pairStats[team1Key].wins++
            pairStats[team2Key].losses++
          } else if (set.team2Score > set.team1Score) {
            pairStats[team2Key].wins++
            pairStats[team1Key].losses++
          } else {
            pairStats[team1Key].draws++
            pairStats[team2Key].draws++
          }
        }
      } else {
        // For regular matches, check team composition
        const team1Players = match.players.filter(p => p.team === 1 && p.userId).map(p => p.userId!)
        const team2Players = match.players.filter(p => p.team === 2 && p.userId).map(p => p.userId!)

        if (team1Players.length !== 2 || team2Players.length !== 2) continue

        const team1Key = getPairKey(team1Players[0], team1Players[1])
        const team2Key = getPairKey(team2Players[0], team2Players[1])

        if (!pairStats[team1Key]) pairStats[team1Key] = { wins: 0, losses: 0, draws: 0 }
        if (!pairStats[team2Key]) pairStats[team2Key] = { wins: 0, losses: 0, draws: 0 }

        // Count sets won by each team
        let team1SetsWon = 0
        let team2SetsWon = 0

        for (const set of match.sets) {
          if (set.team1Score > set.team2Score) team1SetsWon++
          else if (set.team2Score > set.team1Score) team2SetsWon++
        }

        if (team1SetsWon > team2SetsWon) {
          pairStats[team1Key].wins++
          pairStats[team2Key].losses++
        } else if (team2SetsWon > team1SetsWon) {
          pairStats[team2Key].wins++
          pairStats[team1Key].losses++
        } else {
          pairStats[team1Key].draws++
          pairStats[team2Key].draws++
        }
      }
    }

    // Get user details for all players
    const allUserIds = new Set<string>()
    Object.keys(pairStats).forEach(key => {
      const [id1, id2] = key.split('_')
      allUserIds.add(id1)
      allUserIds.add(id2)
    })

    if (allUserIds.size === 0) {
      return NextResponse.json([])
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true },
    })

    const userMap = new Map(users.map(u => [u.id, u.name || 'Nepoznato']))

    // Build rankings
    const rankings = Object.entries(pairStats)
      .map(([pairKey, stats]) => {
        const [id1, id2] = pairKey.split('_')
        const total = stats.wins + stats.losses + stats.draws
        const winRate = total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0
        return {
          pairKey,
          player1Id: id1,
          player2Id: id2,
          player1Name: userMap.get(id1) || 'Nepoznato',
          player2Name: userMap.get(id2) || 'Nepoznato',
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          totalMatches: total,
          winRate,
        }
      })
      .filter(r => r.totalMatches >= 5)
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        return b.wins - a.wins
      })
      .slice(0, 10)

    return NextResponse.json(rankings)
  } catch (error) {
    console.error('Error fetching pair rankings:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju rankinga parova' },
      { status: 500 }
    )
  }
}
