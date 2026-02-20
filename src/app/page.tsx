import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4">PadelHub</h1>
        <p className="text-xl mb-8 opacity-90">
          Prati svoje matcheve, statistiku i lige
        </p>

        <div className="space-x-4">
          <Link
            href="/auth/login"
            className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-200 transition"
          >
            Prijava
          </Link>
          <Link
            href="/auth/register"
            className="inline-block bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition"
          >
            Registracija
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl px-4">
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white text-center">
          <div className="text-3xl mb-3">*</div>
          <h3 className="font-semibold mb-2">Evidencija matcheva</h3>
          <p className="text-sm opacity-80">Kreiraj i prati sve svoje padel matcheve</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white text-center">
          <div className="text-3xl mb-3">#</div>
          <h3 className="font-semibold mb-2">Statistika</h3>
          <p className="text-sm opacity-80">Detaljni uvid u pobjede, poraze i postotke</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white text-center">
          <div className="text-3xl mb-3">!</div>
          <h3 className="font-semibold mb-2">Lige</h3>
          <p className="text-sm opacity-80">Sudjeluj u ligama i prati ljestvicu</p>
        </div>
      </div>
    </div>
  )
}
