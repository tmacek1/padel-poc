import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

interface SchedulePlayer {
  name: string
  odUserId: string
}

interface ScheduleSet {
  setNumber: number
  team1: SchedulePlayer[]
  team2: SchedulePlayer[]
}

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      scheduledAt: {
        gte: new Date('2026-01-30T00:00:00'),
        lt: new Date('2026-01-31T00:00:00'),
      },
      pairRotation: true,
    },
    include: {
      players: {
        include: { user: { select: { id: true, name: true } } }
      },
      sets: {
        include: {
          setPlayers: {
            include: { user: { select: { id: true, name: true } } }
          },
        },
        orderBy: { setNumber: 'asc' }
      }
    }
  })

  for (const match of matches) {
    console.log('Match ID:', match.id)
    console.log('Date:', match.scheduledAt)

    console.log('\n=== Original Rotation Schedule (pairRotationSchedule) ===')
    if (match.pairRotationSchedule) {
      const schedule: ScheduleSet[] = JSON.parse(match.pairRotationSchedule)
      for (const set of schedule) {
        console.log('Set ' + set.setNumber + ':')
        console.log('  Team 1: ' + set.team1.map(p => p.name).join(' / '))
        console.log('  Team 2: ' + set.team2.map(p => p.name).join(' / '))
      }
    }

    console.log('\n=== Actual SetPlayer Records (what was saved) ===')
    for (const set of match.sets) {
      console.log('Set ' + set.setNumber + ' (' + set.team1Score + ':' + set.team2Score + '):')
      const team1 = set.setPlayers.filter(sp => sp.team === 1)
      const team2 = set.setPlayers.filter(sp => sp.team === 2)
      console.log('  Team 1: ' + team1.map(sp => sp.user?.name).join(' / '))
      console.log('  Team 2: ' + team2.map(sp => sp.user?.name).join(' / '))
    }
  }
}

main().then(() => prisma.$disconnect())
