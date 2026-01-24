import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

// GET /api/locations - Get all locations
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Greska pri dohvacanju lokacija' },
      { status: 500 }
    )
  }
}

// POST /api/locations - Create a new location
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, city } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Naziv lokacije je obavezan' },
        { status: 400 }
      )
    }

    const location = await prisma.location.create({
      data: { name, address, city },
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json(
      { error: 'Greska pri kreiranju lokacije' },
      { status: 500 }
    )
  }
}
