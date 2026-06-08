import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function StudentDashboard() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('enrolled')
  const [view, setView] = useState('home')
  const [allCourses, setAllCourses] = useState([])
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const [completedLessons, setCompletedLessons] = useState([])
  const [quizAttempts, setQuizAttempts] = useState({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchAllCourses()
    fetchEnrolledCourses()
    fetchCompletions()
    fetchAttempts()
  }, [])

  async function fetchAllCourses() {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    setAllCourses(data || [])
  }

  async function fetchEnrolledCourses() {
    const { data } = await supabase.from('enrollments')
      .select('course_id, courses(*)')
      .eq('student_id', profile.id)
    setEnrolledCourses(data?.map(e => e.courses).filter(Boolean) || [])
  }

  async function fetchCompletions() {
    const { data } = await supabase.from('lesson_completions')
      .select('lesson_id').eq('student_id', profile.id)
    setCompletedLessons(data?.map(d => d.lesson_id) || [])
  }

  async function fetchAttempts() {
    const { data } = await supabase.from('quiz_attempts')
      .select('quiz_id, score, total, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
    const map = {}
    data?.forEach(a => { if (!map[a.quiz_id]) map[a.quiz_id] = a })
    setQuizAttempts(map)
  }

  async function enroll(courseId) {
    setLoading(true)
    await supabase.from('enrollments').insert({ student_id: profile.id, course_id: courseId })
    setMsg('Enrolled successfully!')
    setTimeout(() => setMsg(''), 3000)
    await fetchEnrolledCourses()
    setLoading(false)
  }

  async function openCourse(course) {
    setSelectedCourse(course)
    setView('course')
    const { data } = await supabase.from('modules')
      .select('*, lessons(*), quizzes(*)')
      .eq('course_id', course.id)
      .order('order_index')
    setModules(data || [])
  }

  async function openQuiz(quiz) {
    setSelectedQuiz(quiz)
    setAnswers({})
    setSubmitted(false)
    setScore(null)
    const { data } = await supabase.from('quiz_questions')
      .select('*').eq('quiz_id', quiz.id).order('order_index')
    setQuestions(data || [])
    if (quizAttempts[quiz.id]) {
      setScore(quizAttempts[quiz.id])
      setSubmitted(true)
    }
    setView('quiz')
  }

  async function markComplete(lessonId) {
    if (completedLessons.includes(lessonId)) return
    await supabase.from('lesson_completions').insert({ student_id: profile.id, lesson_id: lessonId })
    setCompletedLessons(prev => [...prev, lessonId])
  }

  async function submitQuiz() {
    let correct = 0
    const answerMap = {}
    questions.forEach(q => {
      answerMap[q.id] = answers[q.id]
      if (answers[q.id] === q.correct_index) correct++
    })
    const result = { score: correct, total: questions.length }
    await supabase.from('quiz_attempts').insert({
      student_id: profile.id, quiz_id: selectedQuiz.id,
      score: correct, total: questions.length, answers: answerMap
    })
    setScore(result)
    setSubmitted(true)
    setQuizAttempts(prev => ({ ...prev, [selectedQuiz.id]: result }))
  }

  const isEnrolled = id => enrolledCourses.some(c => c?.id === id)

  const getProgress = (mod) => {
    if (!mod.lessons?.length) return null
    const done = mod.lessons.filter(l => completedLessons.includes(l.id)).length
    return { done, total: mod.lessons.length }
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">
          📚 RockyLMS
          <span className="badge badge-student" style={{ marginLeft: 8 }}>Student</span>
        </div>
        <div className="navbar-user">
          <span>{profile?.full_name}</span>
          <button className="btn-signout" onClick={signOut}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-body">
        <aside className="sidebar">
          <div className="sidebar-header"><h3>Navigation</h3></div>
          <div className="sidebar-items">
            <div className={`sidebar-item ${tab === 'enrolled' && view === 'home' ? 'active' : ''}`}
              onClick={() => { setTab('enrolled'); setView('home') }}>📘 My Courses</div>
            <div className={`sidebar-item ${tab === 'browse' && view === 'home' ? 'active' : ''}`}
              onClick={() => { setTab('browse'); setView('home') }}>🔍 Browse Courses</div>
            {enrolledCourses.length > 0 && (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrolled</div>
                {enrolledCourses.map(course => (
                  <div key={course.id}
                    className={`sidebar-item ${selectedCourse?.id === course.id ? 'active' : ''}`}
                    onClick={() => openCourse(course)}>
                    <span className="sidebar-item-title">{course.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>

        <main className="main-content">
          {msg && <div className="success-msg" style={{ marginBottom: 16 }}>{msg}</div>}

          {view === 'home' && tab === 'enrolled' && (
            <>
              <div className="page-header">
                <h2>My Courses</h2>
                <p>Continue where you left off</p>
              </div>
              <div className="item-list">
                {enrolledCourses.map(course => (
                  <div key={course.id} className="item-row" onClick={() => openCourse(course)}>
                    <div className="item-row-info">
                      <h4>{course.title}</h4>
                      <p>{course.description || 'Click to continue learning'}</p>
                    </div>
                    <button className="btn-primary btn-sm">Continue →</button>
                  </div>
                ))}
                {enrolledCourses.length === 0 && (
                  <div className="empty-state">
                    <div className="icon">🎓</div>
                    <h3>No courses yet</h3>
                    <p>Browse available courses and enroll to get started</p>
                    <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('browse')}>Browse Courses</button>
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'home' && tab === 'browse' && (
            <>
              <div className="page-header">
                <h2>Available Courses</h2>
                <p>Enroll in a course to start learning</p>
              </div>
              <div className="item-list">
                {allCourses.map(course => (
                  <div key={course.id} className="item-row" style={{ cursor: 'default' }}>
                    <div className="item-row-info">
                      <h4>{course.title}</h4>
                      <p>{course.description || 'No description'}</p>
                    </div>
                    <div className="item-row-actions">
                      {isEnrolled(course.id)
                        ? <span className="badge badge-enrolled">Enrolled ✓</span>
                        : <button className="btn-primary btn-sm" disabled={loading} onClick={() => enroll(course.id)}>Enroll</button>}
                    </div>
                  </div>
                ))}
                {allCourses.length === 0 && (
                  <div className="empty-state">
                    <div className="icon">📭</div>
                    <h3>No courses available yet</h3>
                    <p>Check back later</p>
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'course' && selectedCourse && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('home'); setSelectedCourse(null) }}>Home</span>
                <span className="sep">›</span>
                <span>{selectedCourse.title}</span>
              </div>
              <div className="page-header">
                <h2>{selectedCourse.title}</h2>
                <p>{selectedCourse.description}</p>
              </div>
              <div className="item-list">
                {modules.map((mod, i) => {
                  const progress = getProgress(mod)
                  const attempt = mod.quizzes?.[0] ? quizAttempts[mod.quizzes[0].id] : null
                  return (
                    <div key={mod.id} className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div>
                          <div className="card-title">Module {i + 1}: {mod.title}</div>
                          <div className="card-subtitle">{mod.description}</div>
                        </div>
                      </div>
                      {progress && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{progress.done}/{progress.total} lessons completed</div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {mod.lessons?.map((lesson, j) => (
                        <div key={lesson.id} className="item-row" style={{ marginBottom: 8 }}
                          onClick={() => { setSelectedLesson(lesson); setView('lesson') }}>
                          <div className="item-row-info">
                            <h4 style={{ fontSize: 14 }}>
                              {completedLessons.includes(lesson.id) ? '✅ ' : '📄 '}
                              Lesson {j + 1}: {lesson.title}
                            </h4>
                          </div>
                          <button className="btn-secondary btn-sm">Read →</button>
                        </div>
                      ))}
                      {mod.quizzes?.[0] && (
                        <div className="item-row" style={{ marginTop: 8, borderColor: attempt ? 'var(--success)' : 'var(--accent)', background: attempt ? '#f0fff4' : '#fffbeb' }}
                          onClick={() => openQuiz(mod.quizzes[0])}>
                          <div className="item-row-info">
                            <h4 style={{ fontSize: 14 }}>
                              {attempt ? `✅ Quiz: ${mod.quizzes[0].title} — ${attempt.score}/${attempt.total}` : `📝 Quiz: ${mod.quizzes[0].title}`}
                            </h4>
                          </div>
                          <button className="btn-secondary btn-sm">{attempt ? 'Review' : 'Take Quiz'} →</button>
                        </div>
                      )}
                      {!mod.lessons?.length && !mod.quizzes?.length && (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No content yet</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {view === 'lesson' && selectedLesson && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('home'); setSelectedCourse(null) }}>Home</span>
                <span className="sep">›</span>
                <span onClick={() => setView('course')}>{selectedCourse?.title}</span>
                <span className="sep">›</span>
                <span>{selectedLesson.title}</span>
              </div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2>{selectedLesson.title}</h2>
                {completedLessons.includes(selectedLesson.id)
                  ? <span className="badge badge-enrolled" style={{ padding: '8px 16px', fontSize: 14 }}>Completed ✓</span>
                  : <button className="btn-primary" onClick={() => markComplete(selectedLesson.id)}>Mark as Complete ✓</button>}
              </div>
              <div className="lesson-content">{selectedLesson.content}</div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button className="btn-secondary" onClick={() => setView('course')}>← Back to Course</button>
                {!completedLessons.includes(selectedLesson.id) && (
                  <button className="btn-primary" onClick={() => { markComplete(selectedLesson.id); setView('course') }}>
                    Mark Complete & Continue →
                  </button>
                )}
              </div>
            </>
          )}

          {view === 'quiz' && selectedQuiz && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('home'); setSelectedCourse(null) }}>Home</span>
                <span className="sep">›</span>
                <span onClick={() => setView('course')}>{selectedCourse?.title}</span>
                <span className="sep">›</span>
                <span>{selectedQuiz.title}</span>
              </div>
              <div className="page-header">
                <h2>{selectedQuiz.title}</h2>
                <p>{questions.length} questions</p>
              </div>
              {submitted && score && (
                <div className="card score-card" style={{ marginBottom: 24 }}>
                  <div className="score-number">{score.score}/{score.total}</div>
                  <div className="score-label">
                    {score.score === score.total ? '🎉 Perfect score!' : score.score >= score.total / 2 ? '👍 Good job!' : '📚 Keep studying!'}
                  </div>
                </div>
              )}
              {questions.map((q, i) => (
                <div key={q.id} className="quiz-question">
                  <h4>Q{i + 1}: {q.question}</h4>
                  <div className="quiz-options">
                    {q.options?.map((opt, j) => {
                      let cls = 'quiz-option'
                      if (submitted) {
                        if (j === q.correct_index) cls += ' correct'
                        else if (answers[q.id] === j) cls += ' incorrect'
                      } else if (answers[q.id] === j) cls += ' selected'
                      return (
                        <div key={j} className={cls} onClick={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: j }))}>
                          <span style={{ fontWeight: 600, minWidth: 20 }}>{String.fromCharCode(65 + j)}.</span>
                          {opt}
                        </div>
                      )
                    })}
                  </div>
                  {submitted && q.explanation && (
                    <div className="quiz-explanation">💡 {q.explanation}</div>
                  )}
                </div>
              ))}
              {!submitted && questions.length > 0 && (
                <button className="btn-primary"
                  disabled={Object.keys(answers).length < questions.length}
                  onClick={submitQuiz} style={{ marginTop: 8 }}>
                  Submit Quiz ({Object.keys(answers).length}/{questions.length} answered)
                </button>
              )}
              {submitted && (
                <button className="btn-secondary" onClick={() => setView('course')} style={{ marginTop: 8 }}>← Back to Course</button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}