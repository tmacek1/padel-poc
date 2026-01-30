import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
}

async function generateUniqueHandle(firstName: string | null, lastName: string | null): Promise<string> {
  const first = firstName ? normalize(firstName) : 'player'
  const last = lastName ? normalize(lastName) : ''
  const baseHandle = last ? `${first}_${last}` : first

  let handle = baseHandle
  let attempts = 0

  while (attempts < 100) {
    const existing = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    })

    if (!existing) {
      return handle
    }

    const randomNum = Math.floor(Math.random() * 9000) + 1000
    handle = `${baseHandle}_${randomNum}`
    attempts++
  }

  return `${baseHandle}_${Date.now()}`
}

async function main() {
  console.log('Fetching users without handles...')

  const users = await prisma.user.findMany({
    where: {
      handle: null,
      isDeleted: false,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
    },
  })

  console.log(`Found ${users.length} users without handles`)

  for (const user of users) {
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
      data: {
        handle,
        ...(firstName && !user.firstName ? { firstName } : {}),
        ...(lastName && !user.lastName ? { lastName } : {}),
      },
    })

    console.log(`Generated handle for ${user.email}: @${handle}`)
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
