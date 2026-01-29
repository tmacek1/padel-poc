'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="font-bold text-xl">
            Padel PoC
          </Link>

          {session && (
            <>
              <div className="hidden md:flex items-center space-x-6">
                <Link href="/dashboard" className="hover:text-blue-200">
                  Dashboard
                </Link>
                <Link href="/matches" className="hover:text-blue-200">
                  Matchevi
                </Link>
                <Link href="/leagues" className="hover:text-blue-200">
                  Lige
                </Link>
                <Link href="/stats" className="hover:text-blue-200">
                  Statistika
                </Link>
                {session.user?.isAdmin && (
                  <Link href="/admin" className="hover:text-blue-200">
                    Admin
                  </Link>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2 hover:text-blue-200"
                >
                  {session.user?.image && !imageError ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-8 h-8 rounded-full"
                      onError={() => setImageError(true)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                    </div>
                  )}
                  <span className="hidden md:inline">{session.user?.name || session.user?.email}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profil
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Odjava
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
