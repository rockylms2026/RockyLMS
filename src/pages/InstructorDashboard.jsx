import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function InstructorDashboard() {
  const { profile, signOut } = useAuth()
  const [view, setView] = useState('courses')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedModule, setSelectedModule] = useState(null)
  const [courses, setCourses] = useState([])
  const [modules, setModules] = useState([])
  const [lessons, setLessons] = useState([])
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [showLessonForm, setShowLessonForm] = useState(false)
  const [showQForm, setShowQForm] = useState(false)
  const [editingLesson, setEditingLesson] = useState(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDesc, setModuleDesc] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonContent, setLessonContent] = useState('')
  const [quizTitle, setQuizTitle] = useState('')
  const [qText, setQText] = useState('')
  const [qOptions, setQOptions] = useState(['', '', '', ''])
  const [qCorrect, setQCorrect] = useState(0)
  const [qExplanation, setQExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('*')
      .eq('instructor_id', profile.id).order('created_at', { ascending: false })
    setCourses(data || [])
  }

  async function fetchModules(courseId) {
    const { data } = await supabase.from('modules').select('*')
      .eq('course_id', courseId).order('order_index')
    setModules(data || [])
  }

  async function fetchLessons(moduleId) {
    const { data } = await supabase.from('lessons').select('*')
      .eq('module_id', moduleId).order('order_index')
    setLessons(data || [])
  }

  async function fetchQuiz(moduleId) {
    const { data } = await supabase.from('quizzes').select('*')
      .eq('module_id', moduleId).maybeSingle()
    setQuiz(data || null)
    if (data) {
      const { data: qs } = await supabase.from('quiz_questions').select('*')
        .eq('quiz_id', data.id).order('order_index')
      setQuestions(qs || [])
    } else { setQuestions([]) }
  }

  function openCourse(course) {
    setSelectedCourse(course); setSelectedModule(null)
    setView('course'); fetchModules(course.id)
  }

  function openModule(mod) {
    setSelectedModule(mod); setView('module')
    fetchLessons(mod.id); fetchQuiz(mod.id)
  }

  async function createCourse(e) {
    e.preventDefault(); setLoading(true)
    const { data, error } = await supabase.from('courses')
      .insert({ title: courseTitle, description: courseDesc, instructor_id: profile.id })
      .select().single()
    if (!error) {
      setCourses([data, ...courses]); setCourseTitle(''); setCourseDesc('')
      setShowCourseForm(false); setMsg('Course created!')
      setTimeout(() => setMsg(''), 3000)
    }
    setLoading(false)
  }

  async function deleteCourse(id) {
    if (!confirm('Delete this course and all its content?')) return
    await supabase.from('courses').delete().eq('id', id)
    setCourses(courses.filter(c => c.id !== id))
    if (selectedCourse?.id === id) { setView('courses'); setSelectedCourse(null) }
  }

  async function createModule(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('modules')
      .insert({ course_id: selectedCourse.id, title: moduleTitle, description: moduleDesc, order_index: modules.length })
      .select().single()
    setModules([...modules, data]); setModuleTitle(''); setModuleDesc('')
    setShowModuleForm(false); setLoading(false)
  }

  async function deleteModule(id) {
    if (!confirm('Delete this module and all its content?')) return
    await supabase.from('modules').delete().eq('id', id)
    setModules(modules.filter(m => m.id !== id))
  }

  async function saveLesson(e) {
    e.preventDefault(); setLoading(true)
    if (editingLesson) {
      const { data } = await supabase.from('lessons')
        .update({ title: lessonTitle, content: lessonContent })
        .eq('id', editingLesson.id).select().single()
      setLessons(lessons.map(l => l.id === editingLesson.id ? data : l))
    } else {
      const { data } = await supabase.from('lessons')
        .insert({ module_id: selectedModule.id, title: lessonTitle, content: lessonContent, order_index: lessons.length })
        .select().single()
      setLessons([...lessons, data])
    }
    setLessonTitle(''); setLessonContent('')
    setShowLessonForm(false); setEditingLesson(null); setLoading(false)
  }

  async function deleteLesson(id) {
    if (!confirm('Delete this lesson?')) return
    await supabase.from('lessons').delete().eq('id', id)
    setLessons(lessons.filter(l => l.id !== id))
  }

  function startEditLesson(lesson) {
    setEditingLesson(lesson); setLessonTitle(lesson.title)
    setLessonContent(lesson.content); setShowLessonForm(true)
  }

  async function createQuiz(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('quizzes')
      .insert({ module_id: selectedModule.id, title: quizTitle })
      .select().single()
    setQuiz(data); setQuizTitle(''); setLoading(false)
  }

  async function addQuestion(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('quiz_questions')
      .insert({ quiz_id: quiz.id, question: qText, options: qOptions, correct_index: qCorrect, explanation: qExplanation, order_index: questions.length })
      .select().single()
    setQuestions([...questions, data])
    setQText(''); setQOptions(['', '', '', '']); setQCorrect(0); setQExplanation('')
    setShowQForm(false); setLoading(false)
  }

  async function deleteQuestion(id) {
    if (!confirm('Delete this question?')) return
    await supabase.from('quiz_questions').delete().eq('id', id)
    setQuestions(questions.filter(q => q.id !== id))
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">
          📚 RockyLMS
          <span className="badge badge-instructor" style={{ marginLeft: 8 }}>Instructor</span>
        </div>
        <div className="navbar-user">
          <span>{profile?.full_name}</span>
          <button className="btn-signout" onClick={signOut}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-body">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>My Courses</h3>
            <button className="btn-primary btn-sm" onClick={() => { setShowCourseForm(true); setView('courses') }}>+</button>
          </div>
          <div className="sidebar-items">
            {courses.map(course => (
              <div key={course.id}
                className={`sidebar-item ${selectedCourse?.id === course.id ? 'active' : ''}`}
                onClick={() => openCourse(course)}>
                <span className="sidebar-item-title">{course.title}</span>
              </div>
            ))}
            {courses.length === 0 && <p style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>No courses yet</p>}
          </div>
        </aside>

        <main className="main-content">
          {msg && <div className="success-msg" style={{ marginBottom: 16 }}>{msg}</div>}

          {view === 'courses' && (
            <>
              <div className="page-header">
                <h2>Your Courses</h2>
                <p>Create and manage your courses</p>
              </div>
              {showCourseForm && (
                <div className="form-panel">
                  <h3>Create New Course</h3>
                  <form onSubmit={createCourse}>
                    <div className="form-group">
                      <label>Course Title</label>
                      <input type="text" value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Introduction to Psychology" required />
                    </div>
                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label>Description</label>
                      <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="What is this course about?" />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Create Course</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowCourseForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
              <div className="item-list">
                {courses.map(course => (
                  <div key={course.id} className="item-row" onClick={() => openCourse(course)}>
                    <div className="item-row-info">
                      <h4>{course.title}</h4>
                      <p>{course.description || 'No description'}</p>
                    </div>
                    <div className="item-row-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-secondary btn-sm" onClick={() => openCourse(course)}>Open →</button>
                      <button className="btn-danger" onClick={() => deleteCourse(course.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {courses.length === 0 && !showCourseForm && (
                <div className="empty-state">
                  <div className="icon">📖</div>
                  <h3>No courses yet</h3>
                  <p>Create your first course to get started</p>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCourseForm(true)}>Create Course</button>
                </div>
              )}
            </>
          )}

          {view === 'course' && selectedCourse && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('courses'); setSelectedCourse(null) }}>Courses</span>
                <span className="sep">›</span>
                <span>{selectedCourse.title}</span>
              </div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2>{selectedCourse.title}</h2>
                  <p>{selectedCourse.description}</p>
                </div>
                <button className="btn-accent" onClick={() => setShowModuleForm(true)}>+ Add Module</button>
              </div>
              {showModuleForm && (
                <div className="form-panel">
                  <h3>Add Module</h3>
                  <form onSubmit={createModule}>
                    <div className="form-group">
                      <label>Module Title</label>
                      <input type="text" value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g. Week 1: Introduction" required />
                    </div>
                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label>Description (optional)</label>
                      <input type="text" value={moduleDesc} onChange={e => setModuleDesc(e.target.value)} placeholder="Brief description" />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Add Module</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowModuleForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
              <div className="item-list">
                {modules.map((mod, i) => (
                  <div key={mod.id} className="item-row" onClick={() => openModule(mod)}>
                    <div className="item-row-info">
                      <h4>Module {i + 1}: {mod.title}</h4>
                      <p>{mod.description || 'Click to add lessons and quiz'}</p>
                    </div>
                    <div className="item-row-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-secondary btn-sm" onClick={() => openModule(mod)}>Open →</button>
                      <button className="btn-danger" onClick={() => deleteModule(mod.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {modules.length === 0 && !showModuleForm && (
                <div className="empty-state">
                  <div className="icon">📂</div>
                  <h3>No modules yet</h3>
                  <p>Modules organize your lessons and quizzes</p>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModuleForm(true)}>Add First Module</button>
                </div>
              )}
            </>
          )}

          {view === 'module' && selectedModule && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('courses'); setSelectedCourse(null) }}>Courses</span>
                <span className="sep">›</span>
                <span onClick={() => { setView('course'); setSelectedModule(null) }}>{selectedCourse?.title}</span>
                <span className="sep">›</span>
                <span>{selectedModule.title}</span>
              </div>
              <div className="page-header">
                <h2>{selectedModule.title}</h2>
                <p>{selectedModule.description}</p>
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Lessons</div>
                    <div className="card-subtitle">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button className="btn-accent" onClick={() => { setShowLessonForm(true); setEditingLesson(null); setLessonTitle(''); setLessonContent('') }}>+ Add Lesson</button>
                </div>
                {showLessonForm && (
                  <div className="form-panel">
                    <h3>{editingLesson ? 'Edit Lesson' : 'New Lesson'}</h3>
                    <form onSubmit={saveLesson}>
                      <div className="form-group">
                        <label>Lesson Title</label>
                        <input type="text" value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. What is Psychology?" required />
                      </div>
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label>Content</label>
                        <textarea value={lessonContent} onChange={e => setLessonContent(e.target.value)} placeholder="Write your lesson content here..." style={{ minHeight: 200 }} required />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>{editingLesson ? 'Save Changes' : 'Add Lesson'}</button>
                        <button type="button" className="btn-secondary" onClick={() => { setShowLessonForm(false); setEditingLesson(null) }}>Cancel</button>
                      </div>
                    </form>
                  </div>
                )}
                <div className="item-list">
                  {lessons.map((lesson, i) => (
                    <div key={lesson.id} className="item-row" style={{ cursor: 'default' }}>
                      <div className="item-row-info">
                        <h4>Lesson {i + 1}: {lesson.title}</h4>
                        <p>{lesson.content?.substring(0, 80)}{lesson.content?.length > 80 ? '...' : ''}</p>
                      </div>
                      <div className="item-row-actions">
                        <button className="btn-secondary btn-sm" onClick={() => startEditLesson(lesson)}>Edit</button>
                        <button className="btn-danger" onClick={() => deleteLesson(lesson.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {lessons.length === 0 && !showLessonForm && <p style={{ color: 'var(--text-muted)', fontSize: 14, paddingTop: 8 }}>No lessons yet</p>}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Quiz</div>
                    <div className="card-subtitle">{questions.length} question{questions.length !== 1 ? 's' : ''}</div>
                  </div>
                  {quiz && <button className="btn-accent" onClick={() => setShowQForm(true)}>+ Add Question</button>}
                </div>
                {!quiz && (
                  <form onSubmit={createQuiz}>
                    <div className="form-group">
                      <label>Quiz Title</label>
                      <input type="text" value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="e.g. Module 1 Quiz" required />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Create Quiz</button>
                    </div>
                  </form>
                )}
                {quiz && showQForm && (
                  <div className="form-panel">
                    <h3>New Question</h3>
                    <form onSubmit={addQuestion}>
                      <div className="form-group">
                        <label>Question</label>
                        <input type="text" value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter your question" required />
                      </div>
                      {qOptions.map((opt, i) => (
                        <div className="form-group" key={i} style={{ marginTop: 10 }}>
                          <label>
                            <input type="radio" name="correct" checked={qCorrect === i} onChange={() => setQCorrect(i)} style={{ marginRight: 8 }} />
                            Option {i + 1} {qCorrect === i ? '✓ correct' : ''}
                          </label>
                          <input type="text" value={opt} onChange={e => { const u = [...qOptions]; u[i] = e.target.value; setQOptions(u) }} placeholder={`Option ${i + 1}`} required />
                        </div>
                      ))}
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label>Explanation (shown after answering)</label>
                        <input type="text" value={qExplanation} onChange={e => setQExplanation(e.target.value)} placeholder="Why is that the correct answer?" />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>Add Question</button>
                        <button type="button" className="btn-secondary" onClick={() => setShowQForm(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                )}
                {quiz && (
                  <div className="item-list">
                    {questions.map((q, i) => (
                      <div key={q.id} className="item-row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <strong style={{ fontSize: 14 }}>Q{i + 1}: {q.question}</strong>
                          <button className="btn-danger" onClick={() => deleteQuestion(q.id)}>Delete</button>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {q.options?.map((opt, j) => (
                            <span key={j} style={{ color: j === q.correct_index ? 'var(--success)' : 'inherit' }}>
                              {j === q.correct_index ? '✓ ' : ''}{opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {questions.length === 0 && !showQForm && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No questions yet</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}