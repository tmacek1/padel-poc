import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/users/[id]/stats - Get player statistics
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all completed matches where user participated
    const matches = await prisma.match.findMany({
      where: {
        status: 'completed',
        players: {
          some: { userId: id },
        },
      },
      include: {
        players: true,
        sets: {
          include: {
            playerPositions: true,
          },
        },
      },
    })

    let wins = 0
    let losses = 0
    let draws = 0
    let totalSetsWon = 0
    let totalSetsLost = 0
    let totalGamesWon = 0
    let totalGamesLost = 0

    // Stats by set number (1st set, 2nd set, 3rd set, etc.)
    const setStatsByNumber: Record<number, { won: number; lost: number }> = {}

    // Stats by court side
    const courtSideStats = {
      left: { setsPlayed: 0, setsWon: 0 },
      right: { setsPlayed: 0, setsWon: 0 },
    }

    for (const match of matches) {
      // Find which team the user is on
      const userPlayer = match.players.find((p) => p.userId === id)
      if (!userPlayer) continue

      const userTeam = userPlayer.team

      // Calculate set scores
      let team1Sets = 0
      let team2Sets = 0
      let team1Games = 0
      let team2Games = 0

      for (const set of match.sets) {
        team1Games += set.team1Score
        team2Games += set.team2Score

        const userWonSet =
          (userTeam === 1 && set.team1Score > set.team2Score) ||
          (userTeam === 2 && set.team2Score > set.team1Score)

        // Track by set number
        if (!setStatsByNumber[set.setNumber]) {
          setStatsByNumber[set.setNumber] = { won: 0, lost: 0 }
        }
        if (userWonSet) {
          setStatsByNumber[set.setNumber].won++
        } else if (set.team1Score !== set.team2Score) {
          setStatsByNumber[set.setNumber].lost++
        }

        // Track by court side
        const userPosition = set.playerPositions?.find((p) => p.userId === id)
        if (userPosition) {
          const side = userPosition.courtSide as 'left' | 'right'
          if (side === 'left' || side === 'right') {
            courtSideStats[side].setsPlayed++
            if (userWonSet) {
              courtSideStats[side].setsWon++
            }
          }
        }

        if (set.team1Score > set.team2Score) {
          team1Sets++
        } else if (set.team2Score > set.team1Score) {
          team2Sets++
        }
      }

      // Determine winner
      if (userTeam === 1) {
        totalSetsWon += team1Sets
        totalSetsLost += team2Sets
        totalGamesWon += team1Games
        totalGamesLost += team2Games

        if (team1Sets > team2Sets) {
          wins++
        } else if (team2Sets > team1Sets) {
          losses++
        } else {
          draws++ // Match ended in a draw (e.g., 1-1 in sets)
        }
      } else {
        totalSetsWon += team2Sets
        totalSetsLost += team1Sets
        totalGamesWon += team2Games
        totalGamesLost += team1Games

        if (team2Sets > team1Sets) {
          wins++
        } else if (team1Sets > team2Sets) {
          losses++
        } else {
          draws++ // Match ended in a draw (e.g., 1-1 in sets)
        }
      }
    }

    const totalMatches = wins + losses + draws
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0
    const totalSets = totalSetsWon + totalSetsLost
    const setWinRate = totalSets > 0 ? (totalSetsWon / totalSets) * 100 : 0
    const totalGames = totalGamesWon + totalGamesLost
    const gameWinRate = totalGames > 0 ? (totalGamesWon / totalGames) * 100 : 0

    // Convert set stats to array format
    const setNumberStats = Object.entries(setStatsByNumber)
      .map(([setNum, stats]) => ({
        setNumber: parseInt(setNum),
        won: stats.won,
        lost: stats.lost,
        total: stats.won + stats.lost,
        winRate: stats.won + stats.lost > 0
          ? Math.round((stats.won / (stats.won + stats.lost)) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => a.setNumber - b.setNumber)

    // Calculate court side win rates
    const courtSideWinRates = {
      left: {
        setsPlayed: courtSideStats.left.setsPlayed,
        setsWon: courtSideStats.left.setsWon,
        winRate: courtSideStats.left.setsPlayed > 0
          ? Math.round((courtSideStats.left.setsWon / courtSideStats.left.setsPlayed) * 1000) / 10
          : 0,
      },
      right: {
        setsPlayed: courtSideStats.right.setsPlayed,
        setsWon: courtSideStats.right.setsWon,
        winRate: courtSideStats.right.setsPlayed > 0
          ? Math.round((courtSideStats.right.setsWon / courtSideStats.right.setsPlayed) * 1000) / 10
          : 0,
      },
    }

    return NextResponse.json({
      userId: id,
      totalMatches,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10,
      totalSetsWon,
      totalSetsLost,
      setWinRate: Math.round(setWinRate * 10) / 10,
      totalGamesWon,
      totalGamesLost,
      gameWinRate: Math.round(gameWinRate * 10) / 10,
      // Enhanced stats
      setNumberStats,
      courtSideStats: courtSideWinRates,
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju statistike' },
      { status: 500 }
    )
  }
}
