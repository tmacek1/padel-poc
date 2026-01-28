'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  isAdmin?: boolean
  club?: { id: string; name: string } | null
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) {
      router.push('/dashboard')
      return
    }
    fetchUsers()
  }, [status, session, router])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Greska pri dohvacanju korisnika')
      const data = await res.json()
      setUsers(data)
    } catch {
      setError('Greska pri dohvacanju korisnika')
    } finally {
      setLoading(false)
    }
  }

  async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
    setTogglingId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/users/${userId}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Greska pri promjeni admin statusa')
      }

      const updatedUser = await res.json()
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isAdmin: updatedUser.isAdmin } : u
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepoznata greska')
    } finally {
      setTogglingId(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="max-w-4xl mx-auto p-6">
          <p className="text-gray-500">Ucitavanje...</p>
        </div>
      </div>
    )
  }

  if (!session?.user?.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Upravljanje korisnicima</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Korisnik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcija
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="w-8 h-8 rounded-full mr-3"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                          {user.name?.[0] || user.email[0]}
                        </div>
                      )}
                      <span className="font-medium text-gray-900">
                        {user.name || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isAdmin ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Da
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                        Ne
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.id === session.user.id ? (
                      <span className="text-gray-400 text-sm">Vi</span>
                    ) : (
                      <button
                        onClick={() => toggleAdmin(user.id, !!user.isAdmin)}
                        disabled={togglingId === user.id}
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          user.isAdmin
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        } disabled:opacity-50`}
                      >
                        {togglingId === user.id
                          ? '...'
                          : user.isAdmin
                            ? 'Ukloni admina'
                            : 'Postavi admina'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
