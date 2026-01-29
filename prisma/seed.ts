import { config } from 'dotenv'
config() // Load .env file

import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Hash password for all test users
  const hashedPassword = await bcrypt.hash('Test1234!', 10)

  // Create 10 test users (1 admin + 9 regular)
  const users = [
    {
      email: 'admin@padel.test',
      name: 'Admin Korisnik',
      password: hashedPassword,
      isAdmin: true,
      profileCompleted: true,
      gender: 'male',
      dominantHand: 'right',
      preferredCourtSide: 'right',
    },
    {
      email: 'ivan@padel.test',
      name: 'Ivan Horvat',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'male',
      dominantHand: 'right',
      preferredCourtSide: 'left',
    },
    {
      email: 'marija@padel.test',
      name: 'Marija Kovač',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'female',
      dominantHand: 'right',
      preferredCourtSide: 'right',
    },
    {
      email: 'petra@padel.test',
      name: 'Petra Novak',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'female',
      dominantHand: 'left',
      preferredCourtSide: 'left',
    },
    // 6 additional dummy users for league testing
    {
      email: 'marko@padel.test',
      name: 'Marko Babić',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'male',
      dominantHand: 'right',
      preferredCourtSide: 'right',
    },
    {
      email: 'ana@padel.test',
      name: 'Ana Jurić',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'female',
      dominantHand: 'right',
      preferredCourtSide: 'left',
    },
    {
      email: 'tomislav@padel.test',
      name: 'Tomislav Knežević',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'male',
      dominantHand: 'left',
      preferredCourtSide: 'left',
    },
    {
      email: 'lucija@padel.test',
      name: 'Lucija Šimić',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'female',
      dominantHand: 'right',
      preferredCourtSide: 'right',
    },
    {
      email: 'luka@padel.test',
      name: 'Luka Matić',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'male',
      dominantHand: 'right',
      preferredCourtSide: 'left',
    },
    {
      email: 'maja@padel.test',
      name: 'Maja Perić',
      password: hashedPassword,
      isAdmin: false,
      profileCompleted: true,
      gender: 'female',
      dominantHand: 'left',
      preferredCourtSide: 'right',
    },
  ]

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    })

    if (existingUser) {
      console.log(`User ${userData.email} already exists, skipping...`)
      continue
    }

    const user = await prisma.user.create({
      data: userData,
    })
    console.log(`Created user: ${user.email} (admin: ${user.isAdmin})`)
  }

  // Create a test club
  const existingClub = await prisma.club.findFirst({
    where: { name: 'Padel Zagreb' },
  })

  if (!existingClub) {
    const club = await prisma.club.create({
      data: {
        name: 'Padel Zagreb',
        address: 'Zagrebačka 123, Zagreb',
      },
    })
    console.log(`Created club: ${club.name}`)
  }

  // Create a test location
  const existingLocation = await prisma.location.findFirst({
    where: { name: 'Teren 1' },
  })

  if (!existingLocation) {
    const location = await prisma.location.create({
      data: {
        name: 'Teren 1',
        address: 'Zagrebačka 123, Zagreb',
        city: 'Zagreb',
      },
    })
    console.log(`Created location: ${location.name}`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
