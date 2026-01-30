/**
 * Generira sve moguće kombinacije parova za 4 igrača
 * Svaki igrač igra s svakim drugim igračem kao partner
 */
export interface PairConfig {
  setNumber: number
  team1: [number, number] // indeksi igrača (0-3)
  team2: [number, number]
}

/**
 * Za 4 igrača (A, B, C, D) postoje 3 moguće kombinacije parova:
 * 1. AB vs CD
 * 2. AC vs BD
 * 3. AD vs BC
 *
 * Za 5 setova, ponavljamo kombinacije.
 */
export function generatePairRotationSchedule(): PairConfig[] {
  const combinations: PairConfig[] = [
    { setNumber: 1, team1: [0, 1], team2: [2, 3] }, // AB vs CD
    { setNumber: 2, team1: [0, 2], team2: [1, 3] }, // AC vs BD
    { setNumber: 3, team1: [0, 3], team2: [1, 2] }, // AD vs BC
    { setNumber: 4, team1: [1, 2], team2: [0, 3] }, // BC vs AD (ponavljanje)
    { setNumber: 5, team1: [1, 3], team2: [0, 2] }, // BD vs AC (ponavljanje)
  ]

  return combinations
}

/**
 * Mapira indekse igrača na stvarne korisnike
 */
export function mapPlayersToSchedule(
  players: { id: string; name: string | null }[],
  schedule: PairConfig[]
): {
  setNumber: number
  team1: { id: string; name: string | null }[]
  team2: { id: string; name: string | null }[]
}[] {
  return schedule.map((config) => ({
    setNumber: config.setNumber,
    team1: config.team1.map((idx) => players[idx]),
    team2: config.team2.map((idx) => players[idx]),
  }))
}

/**
 * Generira nasumični raspored za 5 setova
 */
export function generateRandomPairRotation(): PairConfig[] {
  const baseConfigs: [number, number][][] = [
    [[0, 1], [2, 3]], // AB vs CD
    [[0, 2], [1, 3]], // AC vs BD
    [[0, 3], [1, 2]], // AD vs BC
  ]

  // Shuffle the combinations
  const shuffled = [...baseConfigs].sort(() => Math.random() - 0.5)

  // Create 5 sets by repeating and shuffling
  const result: PairConfig[] = []

  for (let i = 0; i < 5; i++) {
    const config = shuffled[i % 3]
    result.push({
      setNumber: i + 1,
      team1: config[0] as [number, number],
      team2: config[1] as [number, number],
    })
  }

  return result
}
