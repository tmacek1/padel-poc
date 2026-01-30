'use client'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-800 text-gray-400 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm">
        &copy; {currentYear} Padel PoC. Sva prava pridržana.
      </div>
    </footer>
  )
}
