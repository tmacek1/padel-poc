'use client'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-800 dark:bg-gray-950 text-gray-400 py-4 mt-auto hidden md:block">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm">
        &copy; {currentYear} PadelHub. Sva prava pridržana.
      </div>
    </footer>
  )
}
