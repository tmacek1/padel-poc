export const LEAGUE_TIERS = {
  bronze: { name: 'Bronzana liga', order: 1, color: 'amber' },
  silver: { name: 'Srebrna liga', order: 2, color: 'gray' },
  gold: { name: 'Zlatna liga', order: 3, color: 'yellow' },
  platinum: { name: 'Platinasta liga', order: 4, color: 'cyan' },
  diamond: { name: 'Dijamantna liga', order: 5, color: 'blue' },
} as const

export type LeagueTier = keyof typeof LEAGUE_TIERS

export const getTierName = (tier: string): string => {
  return LEAGUE_TIERS[tier as LeagueTier]?.name || tier
}

export const getTierOrder = (tier: string): number => {
  return LEAGUE_TIERS[tier as LeagueTier]?.order || 0
}

export const getTierColor = (tier: string): string => {
  const colors: Record<string, string> = {
    bronze: 'bg-amber-600',
    silver: 'bg-gray-400',
    gold: 'bg-yellow-500',
    platinum: 'bg-cyan-400',
    diamond: 'bg-blue-500',
  }
  return colors[tier] || 'bg-gray-500'
}

export const getTierBadgeClasses = (tier: string): string => {
  const classes: Record<string, string> = {
    bronze: 'bg-amber-100 text-amber-800 border-amber-300',
    silver: 'bg-gray-100 text-gray-800 border-gray-300',
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    platinum: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    diamond: 'bg-blue-100 text-blue-800 border-blue-300',
  }
  return classes[tier] || 'bg-gray-100 text-gray-800'
}

// Bodovni sustav
export const POINTS = {
  WIN: 3,
  TIEBREAK_LOSS: 1,
  LOSS: 0,
}

// Izračunaj bodove za meč
export function calculateMatchPoints(
  isWinner: boolean,
  isTiebreakLoss: boolean
): number {
  if (isWinner) return POINTS.WIN
  if (isTiebreakLoss) return POINTS.TIEBREAK_LOSS
  return POINTS.LOSS
}
