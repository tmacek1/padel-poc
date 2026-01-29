import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithAdmin } from '@/lib/session'

// PATCH /api/locations/[id] - Update a location (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithAdmin()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator može uređivati lokacije' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, address, city } = body

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Naziv lokacije je obavezan' },
        { status: 400 }
      )
    }

    if (!address?.trim()) {
      return NextResponse.json(
        { error: 'Adresa je obavezna' },
        { status: 400 }
      )
    }

    if (!city?.trim()) {
      return NextResponse.json(
        { error: 'Grad je obavezan' },
        { status: 400 }
      )
    }

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Lokacija nije pronađena' },
        { status: 404 }
      )
    }

    // Update the location
    const updated = await prisma.location.update({
      where: { id },
      data: {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Greška pri ažuriranju lokacije' },
      { status: 500 }
    )
  }
}

// DELETE /api/locations/[id] - Delete a location (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithAdmin()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Samo administrator može brisati lokacije' },
        { status: 403 }
      )
    }

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Lokacija nije pronađena' },
        { status: 404 }
      )
    }

    // Check if location is used in any matches
    const matchesUsingLocation = await prisma.match.count({
      where: { locationId: id },
    })

    if (matchesUsingLocation > 0) {
      return NextResponse.json(
        {
          error: `Lokacija se koristi u ${matchesUsingLocation} meč(eva). Nije moguće obrisati lokaciju koja se koristi.`,
          matchCount: matchesUsingLocation
        },
        { status: 400 }
      )
    }

    // Check if location is used in any league matchups
    const matchupsUsingLocation = await prisma.leagueMatchup.count({
      where: { locationId: id },
    })

    if (matchupsUsingLocation > 0) {
      return NextResponse.json(
        {
          error: `Lokacija se koristi u ${matchupsUsingLocation} liga susreta. Nije moguće obrisati lokaciju koja se koristi.`,
          matchupCount: matchupsUsingLocation
        },
        { status: 400 }
      )
    }

    // Delete the location
    await prisma.location.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { error: 'Greška pri brisanju lokacije' },
      { status: 500 }
    )
  }
}
