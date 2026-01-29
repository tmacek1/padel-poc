import { prisma } from './prisma'

export interface MatchConflict {
  type: 'same_time' | 'same_day'
  matchId: string
  scheduledAt: Date
  message: string
}

/**
 * Check if two time ranges overlap
 * @param start1 Start time of first range
 * @param duration1 Duration in minutes of first range
 * @param start2 Start time of second range
 * @param duration2 Duration in minutes of second range
 */
function timeRangesOverlap(
  start1: Date,
  duration1: number,
  start2: Date,
  duration2: number
): boolean {
  const end1 = new Date(start1.getTime() + duration1 * 60 * 1000)
  const end2 = new Date(start2.getTime() + duration2 * 60 * 1000)

  // Overlap exists if one range starts before the other ends
  return start1 < end2 && start2 < end1
}

export async function checkMatchConflicts(
  userId: string,
  scheduledAt: Date,
  newMatchDuration: number = 90, // default 90 minutes
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
      durationMinutes: true,
    },
  })

  for (const match of userMatches) {
    if (!match.scheduledAt) continue

    const existingMatchDuration = match.durationMinutes || 90 // default 90 if not set

    // Check if the time ranges actually overlap
    if (timeRangesOverlap(scheduledAt, newMatchDuration, match.scheduledAt, existingMatchDuration)) {
      // Time ranges overlap - critical conflict
      conflicts.push({
        type: 'same_time',
        matchId: match.id,
        scheduledAt: match.scheduledAt,
        message: `Već imaš meč zakazan u ${match.scheduledAt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}. Mečevi se vremenski preklapaju!`,
      })
    }
    // No "same_day" warning if there's no overlap - matches can be on the same day without conflict
  }

  return conflicts
}

export async function checkAllPlayersConflicts(
  playerIds: string[],
  scheduledAt: Date,
  newMatchDuration: number = 90,
  excludeMatchId?: string
): Promise<Map<string, MatchConflict[]>> {
  const result = new Map<string, MatchConflict[]>()

  for (const playerId of playerIds) {
    const conflicts = await checkMatchConflicts(playerId, scheduledAt, newMatchDuration, excludeMatchId)
    if (conflicts.length > 0) {
      result.set(playerId, conflicts)
    }
  }

  return result
}
