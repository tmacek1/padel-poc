import { prisma } from './prisma'

export interface MatchConflict {
  type: 'same_time' | 'same_day'
  matchId: string
  scheduledAt: Date
  message: string
}

export async function checkMatchConflicts(
  userId: string,
  scheduledAt: Date,
  excludeMatchId?: string
): Promise<MatchConflict[]> {
  const conflicts: MatchConflict[] = []

  // Get start and end of the day
  const dayStart = new Date(scheduledAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(scheduledAt)
  dayEnd.setHours(23, 59, 59, 999)

  // Find all matches for this user on the same day
  const userMatches = await prisma.match.findMany({
    where: {
      scheduledAt: {
        gte: dayStart,
        lte: dayEnd,
      },
      players: {
        some: {
          userId: userId,
        },
      },
      status: {
        not: 'cancelled',
      },
      ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
    },
    select: {
      id: true,
      scheduledAt: true,
    },
  })

  for (const match of userMatches) {
    if (!match.scheduledAt) continue

    const timeDiff = Math.abs(
      scheduledAt.getTime() - match.scheduledAt.getTime()
    )
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    if (hoursDiff < 2) {
      // Within 2 hours - critical conflict
      conflicts.push({
        type: 'same_time',
        matchId: match.id,
        scheduledAt: match.scheduledAt,
        message: `Vec imas mec zakazan u ${match.scheduledAt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}. Mec se preklapa!`,
      })
    } else {
      // Same day - warning
      conflicts.push({
        type: 'same_day',
        matchId: match.id,
        scheduledAt: match.scheduledAt,
        message: `Vec imas mec zakazan za ${match.scheduledAt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })} istog dana.`,
      })
    }
  }

  return conflicts
}

export async function checkAllPlayersConflicts(
  playerIds: string[],
  scheduledAt: Date,
  excludeMatchId?: string
): Promise<Map<string, MatchConflict[]>> {
  const result = new Map<string, MatchConflict[]>()

  for (const playerId of playerIds) {
    const conflicts = await checkMatchConflicts(playerId, scheduledAt, excludeMatchId)
    if (conflicts.length > 0) {
      result.set(playerId, conflicts)
    }
  }

  return result
}
