import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/rankings - Get player rankings (top players by win rate)
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

    // Calculate stats per user
    const userStats: Record<string, { wins: number; losses: number; draws: number }> = {}

    for (const match of matches) {
      for (const player of match.players) {
        if (!player.userId) continue

        if (!userStats[player.userId]) {
          userStats[player.userId] = { wins: 0, losses: 0, draws: 0 }
        }

        const defaultTeam = player.team
        let userSetsWon = 0
        let userSetsLost = 0

        for (const set of match.sets) {
          const setPlayerRecord = set.setPlayers?.find(sp => sp.userId === player.userId)
          const userTeam = setPlayerRecord ? setPlayerRecord.team : defaultTeam

          const won =
            (userTeam === 1 && set.team1Score > set.team2Score) ||
            (userTeam === 2 && set.team2Score > set.team1Score)
          const lost =
            (userTeam === 1 && set.team2Score > set.team1Score) ||
            (userTeam === 2 && set.team1Score > set.team2Score)

          if (won) userSetsWon++
          if (lost) userSetsLost++
        }

        if (match.pairRotation) {
          userStats[player.userId].wins += userSetsWon
          userStats[player.userId].losses += userSetsLost
        } else {
          if (userSetsWon > userSetsLost) {
            userStats[player.userId].wins++
          } else if (userSetsLost > userSetsWon) {
            userStats[player.userId].losses++
          } else {
            userStats[player.userId].draws++
          }
        }
      }
    }

    // Get user details for all players with stats
    const userIds = Object.keys(userStats)
    if (userIds.length === 0) {
      return NextResponse.json([])
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    // Build rankings
    const rankings = userIds
      .map(userId => {
        const stats = userStats[userId]
        const total = stats.wins + stats.losses + stats.draws
        const winRate = total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0
        const user = userMap.get(userId)
        return {
          userId,
          name: user?.name || 'Nepoznato',
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          totalMatches: total,
          winRate,
        }
      })
      .filter(r => r.totalMatches > 0)
      .sort((a, b) => {
        // Sort by win rate desc, then by total wins desc
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        return b.wins - a.wins
      })
      .slice(0, 10)

    return NextResponse.json(rankings)
  } catch (error) {
    console.error('Error fetching rankings:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju rankinga' },
      { status: 500 }
    )
  }
}
