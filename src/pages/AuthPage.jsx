import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [instructorCode, setInstructorCode] = useState('')
  const [isInstructor, setIsInstructor] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setMessage(''); setLoading(true)

    if (mode === 'signup') {
      if (isInstructor && instructorCode !== import.meta.env.VITE_INSTRUCTOR_CODE) {
        setError('Invalid instructor code.'); setLoading(false); return
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role: isInstructor ? 'instructor' : 'student' } }
      })
      if (error) setError(error.message)
      else setMessage('Account created! You can now log in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">📚</span>
          <h1>RockyLMS</h1>
          <p>Your Learning Management System</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => { setMode('login'); setError(''); setMessage('') }}>Log In</button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" placeholder="Your full name" value={fullName}
                onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="your@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={isInstructor}
                  onChange={e => setIsInstructor(e.target.checked)} />
                I am an instructor
              </label>
            </div>
          )}
          {mode === 'signup' && isInstructor && (
            <div className="form-group">
              <label>Instructor Code</label>
              <input type="password" placeholder="Enter instructor code" value={instructorCode}
                onChange={e => setInstructorCode(e.target.value)} required />
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          {message && <p className="success-msg">{message}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}