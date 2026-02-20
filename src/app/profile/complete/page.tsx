'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CompleteProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [dominantHand, setDominantHand] = useState('')
  const [preferredCourtSide, setPreferredCourtSide] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    // Pre-fill name from session if available
    if (session?.user?.name) {
      setName(session.user.name)
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!name.trim()) {
      setError('Ime i prezime su obavezni')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/users/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          gender,
          dominantHand,
          preferredCourtSide,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Greška pri spremanju profila')
        setLoading(false)
        return
      }

      // Update session to reflect profile completion
      await update()

      // Redirect to dashboard
      router.push('/dashboard')
    } catch {
      setError('Greška pri spremanju profila')
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-700 dark:text-gray-300">Učitavanje...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700 py-12 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dovrši profil</h1>
          <p className="text-gray-700 dark:text-gray-300 mt-2">
            Samo još par podataka da završiš registraciju
          </p>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ime i prezime *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              placeholder="Tvoje ime i prezime"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Spol
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Muški</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Ženski</span>
              </label>
            </div>
          </div>

          {/* Dominant Hand */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Glavna ruka
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dominantHand"
                  value="right"
                  checked={dominantHand === 'right'}
                  onChange={(e) => setDominantHand(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Desna</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dominantHand"
                  value="left"
                  checked={dominantHand === 'left'}
                  onChange={(e) => setDominantHand(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Lijeva</span>
              </label>
            </div>
          </div>

          {/* Preferred Court Side */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferirana strana terena
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="preferredCourtSide"
                  value="right"
                  checked={preferredCourtSide === 'right'}
                  onChange={(e) => setPreferredCourtSide(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Desna (Drive)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="preferredCourtSide"
                  value="left"
                  checked={preferredCourtSide === 'left'}
                  onChange={(e) => setPreferredCourtSide(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-800 dark:text-gray-200">Lijeva (Reves)</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
          >
            {loading ? 'Spremanje...' : 'Završi registraciju'}
          </button>
        </form>
      </div>
    </div>
  )
}
