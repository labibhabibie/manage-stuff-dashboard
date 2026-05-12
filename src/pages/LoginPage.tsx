import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/logo.svg'
import { User, Lock, Eye, EyeOff, Building2 } from 'lucide-react'

export default function Login(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, loadingSet] = useState(false)
  const [error, errorSet] = useState<string | null>(null)
  const [showPassword, showPasswordSet] = useState(false)
  const [rememberMe, rememberMeSet] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    loadingSet(true)
    errorSet(null)

    const { error } = await signIn(email, password)

    loadingSet(false)

    if (error) {
      errorSet('Email atau password salah. Silakan coba lagi.')
    } else {
      navigate('/dashboard')
    }
  }

  const handleSSO = (): void => {
    /**
     * TODO: Implementasi SSO Perusahaan
     *
     * Pilihan implementasi:
     *
     * 1. Supabase SSO (SAML 2.0):
     *    await supabase.auth.signInWithSSO({
     *      domain: 'perusahaan.com',
     *    })
     *
     * 2. OAuth Provider (Google Workspace / Microsoft Azure AD):
     *    await supabase.auth.signInWithOAuth({
     *      provider: 'azure', // atau 'google'
     *      options: { redirectTo: window.location.origin }
     *    })
     *
     * 3. OpenID Connect custom:
     *    window.location.href = `${SSO_PROVIDER_URL}/authorize?
     *      client_id=${CLIENT_ID}&
     *      redirect_uri=${REDIRECT_URI}&
     *      response_type=code&scope=openid profile email`
     */
    console.warn('SSO belum dikonfigurasi')
  }

  return (
      <div className="w-full min-h-screen flex items-center justify-center p-4 sm:p-6"
           style={{ background: `radial-gradient(circle at center, #0EA5E9 0%, #0284C7 35%, #0A3D91 100%)`,}}>
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-lg px-5 py-8 sm:px-8 sm:py-10 flex flex-col items-center gap-5 sm:gap-6">
          {/* Logo */}
          <div className="w-full flex justify-center pb-1">
            <img src={logo} alt="Logo" className="h-14 sm:h-20 object-contain" />
          </div>

          {/* Title */}
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-blue-900">Sistem Inspeksi X-ray</h1>
            <p className="text-sm sm:text-base font-medium text-blue-700">
              Sistem manajemen inspeksi barang
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-800">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 sm:py-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
                <User size={16} className="text-gray-400 shrink-0 sm:w-[18px] sm:h-[18px]" />
                <input
                    className="bg-transparent text-sm text-gray-700 w-full focus:outline-none placeholder-gray-400"
                    type="email"
                    placeholder="admin@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-800">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 sm:py-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
                <Lock size={16} className="text-gray-400 shrink-0 sm:w-[18px] sm:h-[18px]" />
                <input
                    className="bg-transparent text-sm text-gray-700 w-full focus:outline-none placeholder-gray-400"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="***********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button
                    type="button"
                    onClick={() => showPasswordSet(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors p-0.5"
                >
                  {showPassword ? (
                      <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" />
                  ) : (
                      <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me + Lupa Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => rememberMeSet(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-blue-800 accent-blue-800 cursor-pointer"
                />
                <span className="text-sm text-gray-600">Ingat Saya</span>
              </label>
              <button
                  type="button"
                  onClick={() => {
                    /* TODO: navigate ke halaman lupa password */
                  }}
                  className="text-sm font-medium text-blue-800 hover:text-blue-600 transition-colors"
              >
                Lupa Password?
              </button>
            </div>

            {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
            )}

            {/* Tombol Masuk */}
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-900 hover:bg-blue-800 active:bg-blue-950 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base mt-1"
            >
              {loading ? 'Memuat...' : 'Masuk'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
              atau masuk dengan
            </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Tombol SSO */}
            <button
                type="button"
                onClick={handleSSO}
                className="w-full border-2 border-blue-900 text-blue-900 hover:bg-blue-50 active:bg-blue-100 font-bold py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base flex items-center justify-center gap-2"
            >
              <Building2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              SSO Perusahaan
            </button>
          </form>

          {/* Footer note */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Belum punya akun? beritahu Admin untuk mendaftarkan akun anda
          </p>
        </div>
      </div>
  )
}