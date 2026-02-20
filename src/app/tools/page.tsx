'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

type DriveFolder = { id: string; name: string }

export default function ToolsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [driveStatus, setDriveStatus] = useState<{
    loading: string | null
    success: { filename: string; link: string } | null
    error: string | null
  }>({ loading: null, success: null, error: null })

  // Folder picker state
  const [picker, setPicker] = useState<{
    open: boolean
    type: string
    folders: DriveFolder[]
    loading: boolean
    newFolderName: string
    creating: boolean
  }>({ open: false, type: 'matches', folders: [], loading: false, newFolderName: '', creating: false })

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  const fetchFolders = useCallback(async () => {
    setPicker(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/admin/backup/drive/folders')
      const data = await res.json()
      if (!res.ok) {
        setDriveStatus({ loading: null, success: null, error: data.error })
        setPicker(prev => ({ ...prev, open: false, loading: false }))
        return
      }
      setPicker(prev => ({ ...prev, folders: data.folders, loading: false }))
    } catch {
      setPicker(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const openFolderPicker = async (type: string) => {
    setDriveStatus({ loading: null, success: null, error: null })
    setPicker({ open: true, type, folders: [], loading: true, newFolderName: '', creating: false })
    await fetchFolders()
  }

  const createFolder = async () => {
    const name = picker.newFolderName.trim()
    if (!name) return
    setPicker(prev => ({ ...prev, creating: true }))
    try {
      const res = await fetch('/api/admin/backup/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        setPicker(prev => ({
          ...prev,
          folders: [...prev.folders, data.folder].sort((a, b) => a.name.localeCompare(b.name)),
          newFolderName: '',
          creating: false,
        }))
      } else {
        setPicker(prev => ({ ...prev, creating: false }))
      }
    } catch {
      setPicker(prev => ({ ...prev, creating: false }))
    }
  }

  const uploadToDrive = async (folderId?: string | null) => {
    const type = picker.type
    setPicker(prev => ({ ...prev, open: false }))
    setDriveStatus({ loading: type, success: null, error: null })
    try {
      let url = `/api/admin/backup/drive?type=${type}`
      if (folderId) url += `&folderId=${folderId}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setDriveStatus({ loading: null, success: null, error: data.error })
        return
      }
      setDriveStatus({
        loading: null,
        success: { filename: data.filename, link: data.webViewLink },
        error: null,
      })
    } catch {
      setDriveStatus({
        loading: null,
        success: null,
        error: 'Greška pri povezivanju sa serverom',
      })
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-4xl mx-auto p-6">
          <p className="text-gray-700 dark:text-gray-300">Učitavanje...</p>
        </div>
      </div>
    )
  }

  if (!session?.user?.isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Alati</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backup */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Backup podataka</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Preuzmi Excel datoteku s podacima</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="/api/admin/backup?type=matches"
                className="block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
              >
                Backup matcheva
              </a>
              <a
                href="/api/admin/backup?type=all"
                className="block text-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
              >
                Backup svega (matchevi + igrači + lige + statistika)
              </a>

              {/* Google Drive upload */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Spremi backup direktno na Google Drive:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openFolderPicker('matches')}
                    disabled={driveStatus.loading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DriveIcon />
                    {driveStatus.loading === 'matches' ? 'Spremam...' : 'Spremi matcheve na Drive'}
                  </button>
                  <button
                    onClick={() => openFolderPicker('all')}
                    disabled={driveStatus.loading !== null}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DriveIcon />
                    {driveStatus.loading === 'all' ? 'Spremam...' : 'Spremi sve na Drive'}
                  </button>
                </div>

                {driveStatus.success && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">
                      Spremljeno: <strong>{driveStatus.success.filename}</strong>
                    </p>
                    {driveStatus.success.link && (
                      <a
                        href={driveStatus.success.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 dark:text-green-400 underline hover:no-underline"
                      >
                        Otvori na Google Driveu
                      </a>
                    )}
                  </div>
                )}

                {driveStatus.error && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-300">{driveStatus.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Import */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Uvoz podataka</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Uvezi matcheve iz CSV datoteke</p>
              </div>
            </div>
            <Link
              href="/admin/import"
              className="block text-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm"
            >
              Otvori uvoz podataka
            </Link>
          </div>
        </div>
      </div>

      {/* Folder Picker Modal */}
      {picker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPicker(prev => ({ ...prev, open: false }))}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Spremi na Google Drive</h3>
                <button
                  onClick={() => setPicker(prev => ({ ...prev, open: false }))}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {picker.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Save to root */}
                  <button
                    onClick={() => uploadToDrive(null)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left border border-gray-200 dark:border-gray-600 mb-3"
                  >
                    <DriveIcon />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">My Drive (root)</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Spremi direktno u root</p>
                    </div>
                  </button>

                  {/* Existing folders */}
                  {picker.folders.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">Postojeci folderi</p>
                      {picker.folders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => uploadToDrive(folder.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                        >
                          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create new folder */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">Novi folder</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={picker.newFolderName}
                        onChange={e => setPicker(prev => ({ ...prev, newFolderName: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && createFolder()}
                        placeholder="Naziv foldera..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={createFolder}
                        disabled={!picker.newFolderName.trim() || picker.creating}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {picker.creating ? '...' : 'Kreiraj'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPicker(prev => ({ ...prev, open: false }))}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium text-sm"
              >
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DriveIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path d="M4.433 22l-1.766-3.062 7.233-12.526h3.533L6.2 18.938 4.433 22z" fill="#0066DA"/>
      <path d="M19.567 22H4.433l1.767-3.062h13.367L21.333 22h-1.766z" fill="#00AC47"/>
      <path d="M14.9 6.412L8.433 18.938l-1.766-3.062L12.133 6.412h2.767z" fill="#EA4335"/>
      <path d="M21.333 18.938L19.567 22l-1.766-3.062L14.9 6.412h3.533l2.9 12.526z" fill="#00832D"/>
      <path d="M14.9 6.412h-2.767L8.433 6.412l3.534-6.124L14.9 6.412z" fill="#2684FC"/>
      <path d="M8.433 6.412l3.534-6.124L8.433.288l-3.534 6.124h3.534z" fill="#FFBA00"/>
    </svg>
  )
}
