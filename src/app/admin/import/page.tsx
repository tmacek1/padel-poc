'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

interface ParsedRow {
  datum: string
  igrac1_tim1: string
  igrac2_tim1: string
  igrac1_tim2: string
  igrac2_tim2: string
  set1_tim1: string
  set1_tim2: string
  set2_tim1: string
  set2_tim2: string
  set3_tim1: string
  set3_tim2: string
  lokacija: string
  napomena: string
}

interface ImportResult {
  row: number
  success: boolean
  error?: string
  matchId?: string
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Skip header
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',').map((c) => c.trim())
    rows.push({
      datum: cols[0] || '',
      igrac1_tim1: cols[1] || '',
      igrac2_tim1: cols[2] || '',
      igrac1_tim2: cols[3] || '',
      igrac2_tim2: cols[4] || '',
      set1_tim1: cols[5] || '',
      set1_tim2: cols[6] || '',
      set2_tim1: cols[7] || '',
      set2_tim2: cols[8] || '',
      set3_tim1: cols[9] || '',
      set3_tim2: cols[10] || '',
      lokacija: cols[11] || '',
      napomena: cols[12] || '',
    })
  }

  return rows
}

function validateRow(row: ParsedRow): string[] {
  const errors: string[] = []

  // Date validation
  if (!row.datum) {
    errors.push('Datum je obavezan')
  } else {
    const date = new Date(row.datum)
    if (isNaN(date.getTime())) {
      errors.push(`Neispravan format datuma: "${row.datum}"`)
    }
  }

  // Player emails
  const emails = [row.igrac1_tim1, row.igrac2_tim1, row.igrac1_tim2, row.igrac2_tim2]
  emails.forEach((email, idx) => {
    if (!email) {
      errors.push(`Igrač ${idx + 1} je obavezan`)
    } else if (!email.includes('@')) {
      errors.push(`"${email}" nije validna email adresa`)
    }
  })

  // At least one set with scores
  const s1 = parseInt(row.set1_tim1) || parseInt(row.set1_tim2)
  const s2 = parseInt(row.set2_tim1) || parseInt(row.set2_tim2)
  const s3 = parseInt(row.set3_tim1) || parseInt(row.set3_tim2)
  if (!s1 && !s2 && !s3) {
    errors.push('Barem jedan set mora imati rezultat')
  }

  return errors
}

const CSV_TEMPLATE = `datum,igrač1_tim1,igrač2_tim1,igrač1_tim2,igrač2_tim2,set1_tim1,set1_tim2,set2_tim1,set2_tim2,set3_tim1,set3_tim2,lokacija,napomena
2024-01-15,marko@email.com,ana@email.com,ivan@email.com,petra@email.com,6,4,3,6,7,5,Padel centar Zagreb,Odličan meč`

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({})
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null)
  const [importSummary, setImportSummary] = useState<{ total: number; success: number; errors: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  const handleFile = (file: File) => {
    setError('')
    setImportResults(null)
    setImportSummary(null)

    if (!file.name.endsWith('.csv')) {
      setError('Samo CSV datoteke su podržane')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)

      if (rows.length === 0) {
        setError('CSV datoteka je prazna ili nema validnih redaka')
        return
      }

      // Validate all rows
      const errors: Record<number, string[]> = {}
      rows.forEach((row, idx) => {
        const rowErrors = validateRow(row)
        if (rowErrors.length > 0) {
          errors[idx] = rowErrors
        }
      })

      setParsedRows(rows)
      setValidationErrors(errors)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (Object.keys(validationErrors).length > 0) {
      setError('Molimo ispravite greške prije uvoza')
      return
    }

    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Greška pri uvozu')
        return
      }

      setImportSummary({ total: data.total, success: data.success, errors: data.errors })
      setImportResults(data.results)
    } catch {
      setError('Greška pri uvozu podataka')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'padel-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setParsedRows([])
    setValidationErrors({})
    setImportResults(null)
    setImportSummary(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-700 dark:text-gray-300">Učitavanje...</div>
        </div>
      </div>
    )
  }

  if (!session?.user?.isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Uvoz podataka</h1>
          <Link
            href="/admin"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
          >
            &larr; Natrag na Admin
          </Link>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upute za uvoz</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            Pripremi CSV datoteku s matchevima u sljedećem formatu. Igrači se identificiraju po email adresi
            i moraju već postojati u sustavu.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 overflow-x-auto">
            <code className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre">
{`datum,igrač1_tim1,igrač2_tim1,igrač1_tim2,igrač2_tim2,set1_tim1,set1_tim2,set2_tim1,set2_tim2,set3_tim1,set3_tim2,lokacija,napomena
2024-01-15,marko@email.com,ana@email.com,ivan@email.com,petra@email.com,6,4,3,6,7,5,Padel centar Zagreb,`}
            </code>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Preuzmi CSV predložak
            </button>
          </div>

          <ul className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>Format datuma: YYYY-MM-DD (npr. 2024-01-15)</li>
            <li>Email adrese igrača moraju postojati u sustavu</li>
            <li>Set 3 je opcionalan (ostaviti prazno ako ga nema)</li>
            <li>Lokacija se traži po imenu (djelomično podudaranje)</li>
            <li>Svi uvezeni matchevi dobivaju status &quot;completed&quot;</li>
          </ul>
        </div>

        {/* File Upload */}
        {!importSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Odaberi datoteku</h2>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Povuci i ispusti CSV datoteku ovdje
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">ili</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm"
              >
                Odaberi datoteku
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && !importSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pregled ({parsedRows.length} matcheva)
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  Poništi
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || Object.keys(validationErrors).length > 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  {importing ? 'Uvoz u tijeku...' : `Importiraj ${parsedRows.length} matcheva`}
                </button>
              </div>
            </div>

            {Object.keys(validationErrors).length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm font-medium">
                  {Object.keys(validationErrors).length} redaka ima greške. Ispravite CSV i pokušajte ponovo.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Datum</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tim 1</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tim 2</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">S1</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">S2</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">S3</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokacija</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => {
                    const hasErrors = validationErrors[idx]
                    return (
                      <tr
                        key={idx}
                        className={`border-b dark:border-gray-700 ${hasErrors ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                      >
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{row.datum}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200 text-xs">
                          {row.igrac1_tim1}<br />{row.igrac2_tim1}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200 text-xs">
                          {row.igrac1_tim2}<br />{row.igrac2_tim2}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-900 dark:text-white font-medium">
                          {row.set1_tim1 || '-'}:{row.set1_tim2 || '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-900 dark:text-white font-medium">
                          {row.set2_tim1 || '-'}:{row.set2_tim2 || '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-900 dark:text-white font-medium">
                          {row.set3_tim1 || '-'}:{row.set3_tim2 || '-'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">{row.lokacija || '-'}</td>
                        <td className="px-3 py-2">
                          {hasErrors ? (
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {hasErrors.map((e, i) => (
                                <div key={i}>{e}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rezultat uvoza</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{importSummary.total}</div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">Ukupno</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{importSummary.success}</div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">Uspješno</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{importSummary.errors}</div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">Greške</div>
              </div>
            </div>

            {importResults && importResults.some((r) => !r.success) && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Greške:</h3>
                <div className="space-y-2">
                  {importResults
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div key={r.row} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm">
                        <span className="font-medium text-red-800 dark:text-red-300">Red {r.row}:</span>{' '}
                        <span className="text-red-700 dark:text-red-400">{r.error}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Novi uvoz
              </button>
              <Link
                href="/matches"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
              >
                Pregledaj matcheve
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
