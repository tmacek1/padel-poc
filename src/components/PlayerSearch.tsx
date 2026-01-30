'use client'

import { useState, useRef, useEffect } from 'react'

interface User {
  id: string
  name: string | null
  email: string
  handle?: string | null
  createdAt?: string
}

interface PlayerSearchProps {
  users: User[]
  selectedUserId: string
  onSelect: (userId: string) => void
  placeholder?: string
  excludeIds?: string[]
  label?: string
}

export default function PlayerSearch({
  users,
  selectedUserId,
  onSelect,
  placeholder = 'Pretraži igrače...',
  excludeIds = [],
  label,
}: PlayerSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get display name with handle for disambiguation
  const getDisplayName = (user: User) => {
    const sameName = users.filter(
      (u) =>
        u.name &&
        user.name &&
        u.name.toLowerCase() === user.name.toLowerCase() &&
        u.id !== user.id
    )
    if (sameName.length > 0 && user.name && user.handle) {
      return `${user.name} (@${user.handle})`
    }
    return user.name || (user.handle ? `@${user.handle}` : 'Nepoznato ime')
  }

  const MAX_RESULTS = 20
  const RECENT_PLAYERS_COUNT = 5

  // Get recent players (sorted by createdAt desc) - show when no search term
  const recentPlayers = users
    .filter((user) => !excludeIds.includes(user.id))
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, RECENT_PLAYERS_COUNT)

  // Filter users based on search term and exclusions
  const searchResults = users.filter((user) => {
    if (excludeIds.includes(user.id)) return false
    if (!searchTerm) return false
    const searchLower = searchTerm.toLowerCase()
    return user.name?.toLowerCase().includes(searchLower)
  })

  // Show recent players when no search, otherwise show search results
  const filteredUsers = searchTerm ? searchResults : recentPlayers

  // Get selected user display name
  const selectedUser = users.find((u) => u.id === selectedUserId)
  const displayValue = selectedUser ? getDisplayName(selectedUser) : ''

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredUsers[highlightedIndex]) {
          handleSelect(filteredUsers[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (user: User) => {
    onSelect(user.id)
    setSearchTerm('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setIsOpen(true)
    setHighlightedIndex(0)
    // Clear selection if user is typing
    if (selectedUserId) {
      onSelect('')
    }
  }

  const handleClear = () => {
    onSelect('')
    setSearchTerm('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-800 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={selectedUserId ? displayValue : searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            if (!selectedUserId) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white ${
            selectedUserId ? 'bg-green-50 border-green-300' : ''
          }`}
        />
        {selectedUserId && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 hover:text-gray-700 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !selectedUserId && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {filteredUsers.length === 0 ? (
            <div className="px-4 py-3 text-gray-600">
              {searchTerm ? 'Nema rezultata' : 'Nema dostupnih igrača'}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs text-gray-600 bg-gray-50 border-b">
                {searchTerm
                  ? `${filteredUsers.length} igrača pronađeno${filteredUsers.length > MAX_RESULTS ? ` (prikazano prvih ${MAX_RESULTS})` : ''}`
                  : 'Nedavno registrirani igrači'
                }
              </div>
              {filteredUsers.slice(0, searchTerm ? MAX_RESULTS : RECENT_PLAYERS_COUNT).map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 ${
                    index === highlightedIndex ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900">{user.name || 'Nepoznato ime'}</div>
                  {user.handle && (
                    <div className="text-sm text-gray-500">@{user.handle}</div>
                  )}
                </button>
              ))}
              {searchTerm && filteredUsers.length > MAX_RESULTS && (
                <div className="px-4 py-2 text-sm text-gray-600 bg-gray-50 border-t">
                  Suzi pretragu za prikaz ostalih rezultata.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
