'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="bg-blue-600 dark:bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="font-bold text-xl">
            PadelHub
          </Link>

          {session && (
            <>
              {/* Desktop navigation */}
              <div className="hidden md:flex items-center space-x-6">
                <Link href="/dashboard" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Dashboard
                </Link>
                <Link href="/matches" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Matchevi
                </Link>
                <Link href="/leagues" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Lige
                </Link>
                <Link href="/stats" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Statistika
                </Link>
                {session.user?.isAdmin && (
                  <>
                    <Link href="/admin" className="hover:text-blue-200 dark:hover:text-gray-300">
                      Admin
                    </Link>
                    <Link href="/tools" className="hover:text-blue-200 dark:hover:text-gray-300">
                      Alati
                    </Link>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Dark mode toggle - both desktop and mobile */}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                {/* Profile dropdown */}
                <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2 hover:text-blue-200 dark:hover:text-gray-300"
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
                    <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-gray-600 flex items-center justify-center">
                      {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                    </div>
                  )}
                  <span className="hidden md:inline">{session.user?.name || session.user?.email}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profil
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Odjava
                    </button>
                  </div>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
