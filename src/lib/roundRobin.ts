/**
 * Round-robin raspored za ligu.
 * Za N timova generira N-1 kola (ako je N paran) ili N kola (ako je N neparan, s bye).
 * Svaki par igra protiv svakog drugog para tocno jednom.
 */

export interface RoundRobinMatchup {
  round: number
  homeIndex: number
  awayIndex: number
}

/**
 * Generira single round-robin raspored koristeci "circle method".
 * @param teamCount - broj timova
 * @returns niz matchup-ova s round brojem i indeksima timova
 */
export function generateRoundRobin(teamCount: number): RoundRobinMatchup[] {
  if (teamCount < 2) return []

  const matchups: RoundRobinMatchup[] = []

  // Ako je neparan broj, dodaj "bye" tim
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1
  const hasBye = teamCount % 2 !== 0

  // Kreiraj niz timova (indeksi 0 do n-1)
  const teams: number[] = Array.from({ length: n }, (_, i) => i)

  // Fiksiramo prvi tim, rotiramo ostale (circle method)
  const fixed = teams[0]
  const rotating = teams.slice(1)

  const totalRounds = n - 1

  for (let round = 0; round < totalRounds; round++) {
    // Trenutni raspored za ovo kolo
    const currentTeams = [fixed, ...rotating]

    for (let i = 0; i < n / 2; i++) {
      const home = currentTeams[i]
      const away = currentTeams[n - 1 - i]

      // Preskoci "bye" meceve (bye tim ima indeks teamCount kad je neparan)
      if (hasBye && (home >= teamCount || away >= teamCount)) {
        continue
      }

      matchups.push({
        round: round + 1,
        homeIndex: home,
        awayIndex: away,
      })
    }

    // Rotiraj: zadnji element ide na pocetak rotating niza
    rotating.unshift(rotating.pop()!)
  }

  return matchups
}
