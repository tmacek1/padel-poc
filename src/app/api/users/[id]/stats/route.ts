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
        sets: true,
      },
    })

    let wins = 0
    let losses = 0
    let totalSetsWon = 0
    let totalSetsLost = 0
    let totalGamesWon = 0
    let totalGamesLost = 0

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
        } else {
          losses++
        }
      } else {
        totalSetsWon += team2Sets
        totalSetsLost += team1Sets
        totalGamesWon += team2Games
        totalGamesLost += team1Games

        if (team2Sets > team1Sets) {
          wins++
        } else {
          losses++
        }
      }
    }

    const totalMatches = wins + losses
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0
    const totalSets = totalSetsWon + totalSetsLost
    const setWinRate = totalSets > 0 ? (totalSetsWon / totalSets) * 100 : 0
    const totalGames = totalGamesWon + totalGamesLost
    const gameWinRate = totalGames > 0 ? (totalGamesWon / totalGames) * 100 : 0

    return NextResponse.json({
      userId: id,
      totalMatches,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      totalSetsWon,
      totalSetsLost,
      setWinRate: Math.round(setWinRate * 10) / 10,
      totalGamesWon,
      totalGamesLost,
      gameWinRate: Math.round(gameWinRate * 10) / 10,
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju statistike' },
      { status: 500 }
    )
  }
}
