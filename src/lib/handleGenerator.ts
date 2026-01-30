import { prisma } from './prisma'

/**
 * Generira jedinstveni handle za korisnika
 * Format: ime_prezime_XXX (gdje je XXX nasumični broj)
 */
export async function generateUniqueHandle(firstName?: string | null, lastName?: string | null): Promise<string> {
  // Normaliziraj ime - makni dijakritike i specijalne znakove
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Makni dijakritike
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '') // Samo slova i brojevi
  }

  const first = firstName ? normalize(firstName) : 'player'
  const last = lastName ? normalize(lastName) : ''

  // Generiraj base handle
  const baseHandle = last ? `${first}_${last}` : first

  // Pokušaj pronaći jedinstveni handle
  let handle = baseHandle
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    const existing = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    })

    if (!existing) {
      return handle
    }

    // Dodaj nasumični broj
    const randomNum = Math.floor(Math.random() * 9000) + 1000 // 1000-9999
    handle = `${baseHandle}_${randomNum}`
    attempts++
  }

  // Fallback - koristi timestamp
  return `${baseHandle}_${Date.now()}`
}

/**
 * Generira handleove za sve korisnike koji ga nemaju
 */
export async function generateHandlesForExistingUsers(): Promise<number> {
  const usersWithoutHandle = await prisma.user.findMany({
    where: {
      handle: null,
      isDeleted: false,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
    },
  })

  let updated = 0

  for (const user of usersWithoutHandle) {
    // Ako nema firstName/lastName, pokušaj izvući iz name
    let firstName = user.firstName
    let lastName = user.lastName

    if (!firstName && user.name) {
      const parts = user.name.split(' ')
      firstName = parts[0] || null
      lastName = parts.slice(1).join(' ') || null
    }

    const handle = await generateUniqueHandle(firstName, lastName)

    await prisma.user.update({
      where: { id: user.id },
      data: { handle },
    })

    updated++
  }

  return updated
}
