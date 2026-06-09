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
  const [collapsedModules, setCollapsedModules] = useState({})
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
    setCollapsedModules({})
    const { data } = await supabase.from('modules')
      .select('*, lessons(*), quizzes(*)')
      .eq('course_id', course.id)
      .order('order_index')
    setModules(data || [])
  }

  function toggleModule(moduleId) {
    setCollapsedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
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

  function formatDate(dateStr) {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

              {modules.map((mod, i) => {
                const lessons = mod.lessons || []
                const quizItem = mod.quizzes?.[0]
                const doneLessons = lessons.filter(l => completedLessons.includes(l.id)).length
                const attempt = quizItem ? quizAttempts[quizItem.id] : null

                return (
                  <div key={mod.id} className="module-section">
                    <div className="module-header" onClick={() => toggleModule(mod.id)}>
                      <span className="module-toggle">{collapsedModules[mod.id] ? '▶' : '▼'}</span>
                      <span className="module-header-title">Module {i + 1}: {mod.title}</span>
                      {lessons.length > 0 && (
                        <span style={{ fontSize: 12, opacity: 0.75, marginLeft: 'auto', marginRight: 8 }}>
                          {doneLessons}/{lessons.length} completed
                        </span>
                      )}
                    </div>

                    {!collapsedModules[mod.id] && (
                      <div className="module-items">
                        {lessons.map((lesson, j) => (
                          <div key={lesson.id} className="module-item"
                            onClick={() => { setSelectedLesson(lesson); setView('lesson') }}>
                            <span className="item-icon">{completedLessons.includes(lesson.id) ? '✅' : '📄'}</span>
                            <div className="item-info">
                              <span className="item-title">Lesson {j + 1}: {lesson.title}</span>
                              <span className="item-meta">
                                {lesson.due_date && `Due ${formatDate(lesson.due_date)}`}
                                {lesson.due_date && lesson.points > 0 && ' · '}
                                {lesson.points > 0 && `${lesson.points} pts`}
                              </span>
                            </div>
                          </div>
                        ))}

                        {quizItem && (
                          <div className="module-item" onClick={() => openQuiz(quizItem)}>
                            <span className="item-icon">{attempt ? '✅' : '📝'}</span>
                            <div className="item-info">
                              <span className="item-title">{quizItem.title}</span>
                              <span className="item-meta">
                                {quizItem.due_date && `Due ${formatDate(quizItem.due_date)}`}
                                {quizItem.due_date && quizItem.points > 0 && ' · '}
                                {quizItem.points > 0 && `${quizItem.points} pts`}
                                {attempt && ` · Score: ${attempt.score}/${attempt.total}`}
                              </span>
                            </div>
                          </div>
                        )}

                        {lessons.length === 0 && !quizItem && (
                          <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>No content yet</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {modules.length === 0 && (
                <div className="empty-state">
                  <div className="icon">📂</div>
                  <h3>No modules yet</h3>
                  <p>Check back later</p>
                </div>
              )}
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
                <div>
                  <h2>{selectedLesson.title}</h2>
                  {(selectedLesson.points > 0 || selectedLesson.due_date) && (
                    <p>
                      {selectedLesson.points > 0 && `${selectedLesson.points} pts`}
                      {selectedLesson.points > 0 && selectedLesson.due_date && ' · '}
                      {selectedLesson.due_date && `Due ${formatDate(selectedLesson.due_date)}`}
                    </p>
                  )}
                </div>
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
                <p>
                  {questions.length} questions
                  {selectedQuiz.points > 0 && ` · ${selectedQuiz.points} pts`}
                  {selectedQuiz.due_date && ` · Due ${formatDate(selectedQuiz.due_date)}`}
                </p>
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