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
            setPlayers: true, // Include per-set team assignments (for rotation matches)
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
      // Find which team the user is on (default/original team)
      const userPlayer = match.players.find((p) => p.userId === id)
      if (!userPlayer) continue

      const defaultUserTeam = userPlayer.team

      // Calculate set scores
      let userSetsWon = 0
      let userSetsLost = 0
      let userGamesWon = 0
      let userGamesLost = 0

      for (const set of match.sets) {
        // For rotation matches, check SetPlayer to get user's team for this specific set
        // If no SetPlayer record exists, fall back to original MatchPlayer team
        const setPlayerRecord = set.setPlayers?.find((sp) => sp.userId === id)
        const userTeamInThisSet = setPlayerRecord ? setPlayerRecord.team : defaultUserTeam

        // Calculate if user won this set based on their team IN THIS SET
        const userWonSet =
          (userTeamInThisSet === 1 && set.team1Score > set.team2Score) ||
          (userTeamInThisSet === 2 && set.team2Score > set.team1Score)

        // Track games won/lost based on user's team in this set
        if (userTeamInThisSet === 1) {
          userGamesWon += set.team1Score
          userGamesLost += set.team2Score
        } else {
          userGamesWon += set.team2Score
          userGamesLost += set.team1Score
        }

        // Track by set number
        if (!setStatsByNumber[set.setNumber]) {
          setStatsByNumber[set.setNumber] = { won: 0, lost: 0 }
        }
        if (userWonSet) {
          setStatsByNumber[set.setNumber].won++
          userSetsWon++
        } else if (set.team1Score !== set.team2Score) {
          setStatsByNumber[set.setNumber].lost++
          userSetsLost++
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
      }

      // Update totals
      totalSetsWon += userSetsWon
      totalSetsLost += userSetsLost
      totalGamesWon += userGamesWon
      totalGamesLost += userGamesLost

      // Determine match winner based on sets won
      if (userSetsWon > userSetsLost) {
        wins++
      } else if (userSetsLost > userSetsWon) {
        losses++
      } else {
        draws++ // Match ended in a draw (e.g., 1-1 in sets)
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
      { error: 'Greška pri dohvaćanju statistike' },
      { status: 500 }
    )
  }
}
