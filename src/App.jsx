
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

// Mengubah username menjadi email internal untuk Supabase.
// Pengguna tidak perlu memasukkan Gmail.
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@nutriteen.invalid`
}

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [activeMenu, setActiveMenu] = useState('Beranda')

  // Memeriksa sesi login dan memantau perubahan autentikasi
  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error('Gagal memeriksa sesi:', error.message)
      }

      setUser(data?.session?.user ?? null)
      setLoading(false)
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Mengambil profil pengguna dari database
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    let mounted = true

    async function loadProfile() {
      setProfileLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('Gagal mengambil profil:', error.message)
        setErrorMessage(
          'Profil belum bisa dimuat: ' + error.message
        )
        setProfileLoading(false)
        return
      }

      if (data) {
        setProfile(data)
      } else {
        // Membuat profil jika belum tersedia
        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.username ||
          'Pengguna NutriTeen'

        const userUsername =
          user.user_metadata?.username || null

        const { data: newProfile, error: insertError } =
          await supabase
            .from('profiles')
            .insert({
              id: user.id,
              display_name: displayName,
              username: userUsername,
            })
            .select()
            .single()

        if (!mounted) return

        if (insertError) {
          console.error(
            'Gagal membuat profil:',
            insertError.message
          )
          setErrorMessage(
            'Gagal menyimpan profil: ' + insertError.message
          )
        } else {
          setProfile(newProfile)
        }
      }

      setProfileLoading(false)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [user])

  // Pendaftaran dan login menggunakan username dan password
  async function handleAuth(event) {
    event.preventDefault()

    setErrorMessage('')
    setMessage('')
    setAuthBusy(true)

    try {
      const normalizedUsername = username.trim().toLowerCase()

      // Validasi username
      if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
        throw new Error(
          'Username harus 3–20 karakter dan hanya boleh menggunakan huruf kecil, angka, atau garis bawah (_).'
        )
      }

      // Validasi password
      if (password.length < 6) {
        throw new Error('Password minimal 6 karakter.')
      }

      const internalEmail = usernameToEmail(normalizedUsername)

      if (authMode === 'register') {
        // Membuat akun baru
        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              username: normalizedUsername,
              display_name: normalizedUsername,
            },
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage(
            'Akun berhasil dibuat! Selamat datang di NutriTeen.'
          )
        } else {
          setMessage(
            'Pendaftaran berhasil. Silakan login menggunakan username dan password.'
          )
        }
      } else {
        // Login menggunakan email internal dari username
        const { error } =
          await supabase.auth.signInWithPassword({
            email: internalEmail,
            password,
          })

        if (error) throw error

        setMessage('Login berhasil!')
      }
    } catch (error) {
      console.error('Kesalahan autentikasi:', error)
      setErrorMessage(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  // Logout
  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(error.message)
    } else {
      setProfile(null)
      setActiveMenu('Beranda')
      setMessage('')
      setErrorMessage('')
      setUsername('')
      setPassword('')
    }
  }

  const menus = [
    { name: 'Beranda', icon: '⌂' },
    { name: 'Makanan', icon: '♧' },
    { name: 'Aktivitas', icon: '⚡' },
    { name: 'Progres', icon: '▥' },
    { name: 'Profil', icon: '♙' },
  ]

  // Tampilan saat memeriksa sesi
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-icon">N</div>
          <h2>NutriTeen</h2>
          <p>Memeriksa sesi akun...</p>
        </div>
      </div>
    )
  }

  // Tampilan login dan pendaftaran
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="brand-icon">N</div>
            <div>
              <h2>NutriTeen</h2>
              <span>Healthy lifestyle</span>
            </div>
          </div>

          <div className="auth-heading">
            <span className="welcome-label">
              NUTRITION & HEALTH
            </span>

            <h1>
              {authMode === 'login'
                ? 'Selamat datang kembali!'
                : 'Buat akun NutriTeen'}
            </h1>

            <p>
              {authMode === 'login'
                ? 'Login untuk melanjutkan perjalanan hidup sehatmu.'
                : 'Daftar untuk mulai menggunakan NutriTeen.'}
            </p>
          </div>

          <form onSubmit={handleAuth}>
            <label className="auth-label">
              Username
              <input
                type="text"
                placeholder="Contoh: fathur123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                autoCapitalize="none"
                autoComplete="username"
              />
            </label>

            <label className="auth-label">
              Password
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={
                  authMode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
              />
            </label>

            <button
              type="submit"
              className="primary-button auth-submit"
              disabled={authBusy}
            >
              {authBusy
                ? 'Mohon tunggu...'
                : authMode === 'login'
                  ? 'Login'
                  : 'Buat Akun'}
              {!authBusy && <span>→</span>}
            </button>
          </form>

          {message && (
            <div className="auth-message success-message">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="auth-message error-message">
              {errorMessage}
            </div>
          )}

          <div className="auth-switch">
            {authMode === 'login'
              ? 'Belum punya akun?'
              : 'Sudah punya akun?'}

            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === 'login' ? 'register' : 'login'
                )
                setMessage('')
                setErrorMessage('')
                setPassword('')
              }}
            >
              {authMode === 'login'
                ? 'Daftar sekarang'
                : 'Login di sini'}
            </button>
          </div>

          <p className="auth-footer">
            © 2026 NutriTeen · Bangun kebiasaan sehat
          </p>
        </div>
      </div>
    )
  }

  // Dashboard NutriTeen
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          <div>
            <h2>NutriTeen</h2>
            <span>Healthy lifestyle</span>
          </div>
        </div>

        <p className="menu-label">MENU UTAMA</p>

        <nav>
          {menus.map((menu) => (
            <button
              key={menu.name}
              className={`nav-item ${
                activeMenu === menu.name ? 'active' : ''
              }`}
              onClick={() => setActiveMenu(menu.name)}
            >
              <span className="nav-icon">{menu.icon}</span>
              {menu.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span>🌱</span>
            <h4>Mulai hidup sehat</h4>
            <p>
              Langkah kecil hari ini berarti untuk masa depanmu.
            </p>
          </div>

          <p className="version">NutriTeen v1.0</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">NutriTeen /</span>
            <strong>{activeMenu}</strong>
          </div>

          <div className="topbar-user">
            <span>
              {profileLoading
                ? 'Memuat profil...'
                : profile?.display_name ||
                  profile?.username ||
                  user.user_metadata?.username ||
                  'Pengguna NutriTeen'}
            </span>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              Keluar
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="auth-message error-message">
            {errorMessage}
          </div>
        )}

        {activeMenu === 'Beranda' ? (
          <>
            <section className="welcome">
              <div>
                <span className="welcome-label">
                  NUTRITION & HEALTH
                </span>

                <h1>Selamat datang di NutriTeen! 👋</h1>

                <p>
                  Mulai perjalanan hidup sehatmu dengan memahami
                  kebutuhan nutrisi dan membangun kebiasaan baik
                  setiap hari.
                </p>

                <button
                  className="primary-button"
                  onClick={() => setActiveMenu('Profil')}
                >
                  Lengkapi Profil <span>→</span>
                </button>
              </div>

              <div className="welcome-illustration">🥑</div>
            </section>

            <section className="section-heading">
              <div>
                <h2>Ringkasan Harian</h2>
                <p>Pantau informasi nutrisi harianmu.</p>
              </div>

              <span className="today-badge">Hari ini</span>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon green">🔥</div>
                <span>Target kalori</span>
                <h3>— <small>kkal</small></h3>
                <p>Menunggu data profil</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">🍚</div>
                <span>Kalori dikonsumsi</span>
                <h3>— <small>kkal</small></h3>
                <p>Belum ada catatan makanan</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon blue">💪</div>
                <span>Protein</span>
                <h3>— <small>gram</small></h3>
                <p>Menunggu data profil</p>
              </div>
            </section>

            <section className="content-grid">
              <div className="content-card">
                <div className="card-heading">
                  <div>
                    <h3>Mulai perjalananmu</h3>
                    <p>Lengkapi beberapa langkah berikut.</p>
                  </div>

                  <span className="check-icon">✓</span>
                </div>

                <div className="task-item">
                  <div className="task-number">01</div>
                  <div>
                    <strong>Lengkapi profil</strong>
                    <p>Masukkan informasi dasar dirimu.</p>
                  </div>
                  <button onClick={() => setActiveMenu('Profil')}>
                    →
                  </button>
                </div>

                <div className="task-item">
                  <div className="task-number">02</div>
                  <div>
                    <strong>Catat makanan</strong>
                    <p>Mulai catat makanan yang dikonsumsi.</p>
                  </div>
                  <button onClick={() => setActiveMenu('Makanan')}>
                    →
                  </button>
                </div>

                <div className="task-item">
                  <div className="task-number">03</div>
                  <div>
                    <strong>Pantau progres</strong>
                    <p>Lihat perkembangan kebiasaan sehatmu.</p>
                  </div>
                  <button onClick={() => setActiveMenu('Progres')}>
                    →
                  </button>
                </div>
              </div>

              <div className="content-card tip-card">
                <div className="tip-icon">🌿</div>
                <span className="tip-label">NUTRITION TIPS</span>
                <h3>Nutrisi seimbang, hidup lebih baik.</h3>
                <p>
                  Konsumsi makanan beragam, cukup minum air,
                  tidur cukup, dan lakukan aktivitas fisik
                  yang menyenangkan.
                </p>
                <div className="tip-footer">
                  Kebiasaan sehat dimulai hari ini.
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="coming-soon">
            <div className="coming-icon">🌱</div>
            <h1>{activeMenu}</h1>
            <p>
              Bagian {activeMenu.toLowerCase()} sedang kita
              persiapkan. Fitur ini akan dibangun pada tahap
              berikutnya.
            </p>
            <button
              className="primary-button"
              onClick={() => setActiveMenu('Beranda')}
            >
              Kembali ke Beranda
            </button>
          </section>
        )}

        <footer>
          <span>© 2026 NutriTeen</span>
          <span>Bangun kebiasaan sehat, mulai dari sekarang.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
