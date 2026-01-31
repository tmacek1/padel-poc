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
 * Za 5 setova, koristimo round-robin ciklus: nakon što se iscrpe sve 3
 * kombinacije, ciklus kreće ispočetka (set 4 = kombinacija 1, set 5 = kombinacija 2).
 */
export function generatePairRotationSchedule(): PairConfig[] {
  const baseCombinations: [team1: [number, number], team2: [number, number]][] = [
    [[0, 1], [2, 3]], // AB vs CD
    [[0, 2], [1, 3]], // AC vs BD
    [[0, 3], [1, 2]], // AD vs BC
  ]

  const combinations: PairConfig[] = []
  for (let i = 0; i < 5; i++) {
    const combo = baseCombinations[i % 3]
    combinations.push({
      setNumber: i + 1,
      team1: combo[0],
      team2: combo[1],
    })
  }

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

