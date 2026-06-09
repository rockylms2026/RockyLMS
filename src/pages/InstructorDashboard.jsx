import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function InstructorDashboard() {
  const { profile, signOut } = useAuth()
  const [view, setView] = useState('courses')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [courses, setCourses] = useState([])
  const [modules, setModules] = useState([])
  const [moduleLessons, setModuleLessons] = useState({})
  const [moduleQuizzes, setModuleQuizzes] = useState({})
  const [moduleQuestions, setModuleQuestions] = useState({})
  const [collapsedModules, setCollapsedModules] = useState({})
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [activeLessonForm, setActiveLessonForm] = useState(null)
  const [activeQuizForm, setActiveQuizForm] = useState(null)
  const [showQForm, setShowQForm] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDesc, setModuleDesc] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonContent, setLessonContent] = useState('')
  const [lessonDueDate, setLessonDueDate] = useState('')
  const [lessonPoints, setLessonPoints] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPoints, setEditPoints] = useState('')
  const [quizTitle, setQuizTitle] = useState('')
  const [quizDueDate, setQuizDueDate] = useState('')
  const [quizPoints, setQuizPoints] = useState('')
  const [qText, setQText] = useState('')
  const [qOptions, setQOptions] = useState(['', '', '', ''])
  const [qCorrect, setQCorrect] = useState(0)
  const [qExplanation, setQExplanation] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('*')
      .eq('instructor_id', profile.id).order('created_at', { ascending: false })
    setCourses(data || [])
  }

  async function openCourse(course) {
    setSelectedCourse(course); setView('course')
    await fetchCourseData(course.id)
  }

  async function fetchCourseData(courseId) {
    const { data: mods } = await supabase.from('modules').select('*')
      .eq('course_id', courseId).order('order_index')
    setModules(mods || [])
    const lessonsMap = {}, quizzesMap = {}, questionsMap = {}
    for (const mod of (mods || [])) {
      const { data: lessons } = await supabase.from('lessons').select('*')
        .eq('module_id', mod.id).order('order_index')
      lessonsMap[mod.id] = lessons || []
      const { data: quiz } = await supabase.from('quizzes').select('*')
        .eq('module_id', mod.id).maybeSingle()
      if (quiz) {
        quizzesMap[mod.id] = quiz
        const { data: questions } = await supabase.from('quiz_questions').select('*')
          .eq('quiz_id', quiz.id).order('order_index')
        questionsMap[quiz.id] = questions || []
      }
    }
    setModuleLessons(lessonsMap)
    setModuleQuizzes(quizzesMap)
    setModuleQuestions(questionsMap)
  }

  function openLessonEditor(lesson) {
    setSelectedLesson(lesson)
    setEditTitle(lesson.title)
    setEditContent(lesson.content || '')
    setEditDueDate(lesson.due_date || '')
    setEditPoints(lesson.points || '')
    setView('lessoneditor')
  }

  async function saveLessonDetails(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('lessons')
      .update({ title: editTitle, content: editContent, due_date: editDueDate || null, points: editPoints ? parseInt(editPoints) : 0 })
      .eq('id', selectedLesson.id).select().single()
    const moduleId = selectedLesson.module_id
    setModuleLessons(prev => ({ ...prev, [moduleId]: prev[moduleId].map(l => l.id === selectedLesson.id ? data : l) }))
    setSelectedLesson(data)
    flash('Lesson saved!')
    setLoading(false)
  }

  async function uploadLessonFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${selectedLesson.id}/${Date.now()}.${ext}`
      await supabase.storage.from('lesson-files').upload(path, file, { upsert: true })
      const { data: urlData } = supabase.storage.from('lesson-files').getPublicUrl(path)
      const { data } = await supabase.from('lessons')
        .update({ file_url: urlData.publicUrl, file_name: file.name })
        .eq('id', selectedLesson.id).select().single()
      setSelectedLesson(data)
      const moduleId = selectedLesson.module_id
      setModuleLessons(prev => ({ ...prev, [moduleId]: prev[moduleId].map(l => l.id === selectedLesson.id ? data : l) }))
      flash('File uploaded!')
    } catch (err) { console.error(err) }
    setFileUploading(false)
  }

  async function removeLessonFile() {
    if (!confirm('Remove this file?')) return
    const { data } = await supabase.from('lessons')
      .update({ file_url: null, file_name: null })
      .eq('id', selectedLesson.id).select().single()
    setSelectedLesson(data)
    const moduleId = selectedLesson.module_id
    setModuleLessons(prev => ({ ...prev, [moduleId]: prev[moduleId].map(l => l.id === selectedLesson.id ? data : l) }))
  }

  function toggleModule(id) { setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] })) }
  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  function formatDate(d) {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  async function createCourse(e) {
    e.preventDefault(); setLoading(true)
    const { data, error } = await supabase.from('courses')
      .insert({ title: courseTitle, description: courseDesc, instructor_id: profile.id }).select().single()
    if (!error) { setCourses([data, ...courses]); setCourseTitle(''); setCourseDesc(''); setShowCourseForm(false); flash('Course created!') }
    setLoading(false)
  }

  async function deleteCourse(id) {
    if (!confirm('Delete this course?')) return
    await supabase.from('courses').delete().eq('id', id)
    setCourses(courses.filter(c => c.id !== id))
    if (selectedCourse?.id === id) { setView('courses'); setSelectedCourse(null) }
  }

  async function createModule(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('modules')
      .insert({ course_id: selectedCourse.id, title: moduleTitle, description: moduleDesc, order_index: modules.length }).select().single()
    setModules([...modules, data]); setModuleLessons(prev => ({ ...prev, [data.id]: [] }))
    setModuleTitle(''); setModuleDesc(''); setShowModuleForm(false); setLoading(false)
  }

  async function deleteModule(id) {
    if (!confirm('Delete this module?')) return
    await supabase.from('modules').delete().eq('id', id)
    setModules(modules.filter(m => m.id !== id))
    const nL = { ...moduleLessons }; delete nL[id]
    const nQ = { ...moduleQuizzes }; delete nQ[id]
    setModuleLessons(nL); setModuleQuizzes(nQ)
  }

  async function addLesson(e, moduleId) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('lessons')
      .insert({ module_id: moduleId, title: lessonTitle, content: lessonContent, due_date: lessonDueDate || null, points: lessonPoints ? parseInt(lessonPoints) : 0, order_index: (moduleLessons[moduleId] || []).length })
      .select().single()
    setModuleLessons(prev => ({ ...prev, [moduleId]: [...(prev[moduleId] || []), data] }))
    setLessonTitle(''); setLessonContent(''); setLessonDueDate(''); setLessonPoints('')
    setActiveLessonForm(null); setLoading(false)
  }

  async function deleteLesson(id, moduleId) {
    if (!confirm('Delete this lesson?')) return
    await supabase.from('lessons').delete().eq('id', id)
    setModuleLessons(prev => ({ ...prev, [moduleId]: prev[moduleId].filter(l => l.id !== id) }))
  }

  async function createQuiz(e, moduleId) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('quizzes')
      .insert({ module_id: moduleId, title: quizTitle, due_date: quizDueDate || null, points: quizPoints ? parseInt(quizPoints) : 0 }).select().single()
    setModuleQuizzes(prev => ({ ...prev, [moduleId]: data }))
    setModuleQuestions(prev => ({ ...prev, [data.id]: [] }))
    setQuizTitle(''); setQuizDueDate(''); setQuizPoints(''); setActiveQuizForm(null); setLoading(false)
  }

  function openQuizEditor(quiz) { setSelectedQuiz(quiz); setView('quizeditor') }

  async function addQuestion(e) {
    e.preventDefault(); setLoading(true)
    const { data } = await supabase.from('quiz_questions')
      .insert({ quiz_id: selectedQuiz.id, question: qText, options: qOptions, correct_index: qCorrect, explanation: qExplanation, order_index: (moduleQuestions[selectedQuiz.id] || []).length }).select().single()
    setModuleQuestions(prev => ({ ...prev, [selectedQuiz.id]: [...(prev[selectedQuiz.id] || []), data] }))
    setQText(''); setQOptions(['', '', '', '']); setQCorrect(0); setQExplanation(''); setShowQForm(false); setLoading(false)
  }

  async function deleteQuestion(id, quizId) {
    if (!confirm('Delete this question?')) return
    await supabase.from('quiz_questions').delete().eq('id', id)
    setModuleQuestions(prev => ({ ...prev, [quizId]: prev[quizId].filter(q => q.id !== id) }))
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">📚 RockyLMS <span className="badge badge-instructor" style={{ marginLeft: 8 }}>Instructor</span></div>
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
            {courses.map(c => (
              <div key={c.id} className={`sidebar-item ${selectedCourse?.id === c.id ? 'active' : ''}`} onClick={() => openCourse(c)}>
                <span className="sidebar-item-title">{c.title}</span>
              </div>
            ))}
            {courses.length === 0 && <p style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>No courses yet</p>}
          </div>
        </aside>

        <main className="main-content">
          {msg && <div className="success-msg" style={{ marginBottom: 16 }}>{msg}</div>}

          {/* COURSES */}
          {view === 'courses' && (
            <>
              <div className="page-header"><h2>Your Courses</h2><p>Create and manage your courses</p></div>
              {showCourseForm && (
                <div className="form-panel">
                  <h3>Create New Course</h3>
                  <form onSubmit={createCourse}>
                    <div className="form-group"><label>Course Title</label><input type="text" value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Introduction to Psychology" required /></div>
                    <div className="form-group" style={{ marginTop: 12 }}><label>Description</label><textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="What is this course about?" /></div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Create Course</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowCourseForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
              <div className="item-list">
                {courses.map(c => (
                  <div key={c.id} className="item-row" onClick={() => openCourse(c)}>
                    <div className="item-row-info"><h4>{c.title}</h4><p>{c.description || 'No description'}</p></div>
                    <div className="item-row-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-secondary btn-sm" onClick={() => openCourse(c)}>Open →</button>
                      <button className="btn-danger" onClick={() => deleteCourse(c.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {courses.length === 0 && !showCourseForm && (
                <div className="empty-state"><div className="icon">📖</div><h3>No courses yet</h3>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCourseForm(true)}>Create Course</button>
                </div>
              )}
            </>
          )}

          {/* COURSE — collapsible modules */}
          {view === 'course' && selectedCourse && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('courses'); setSelectedCourse(null) }}>Courses</span>
                <span className="sep">›</span><span>{selectedCourse.title}</span>
              </div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><h2>{selectedCourse.title}</h2><p>{selectedCourse.description}</p></div>
                <button className="btn-accent" onClick={() => setShowModuleForm(true)}>+ Add Module</button>
              </div>

              {showModuleForm && (
                <div className="form-panel">
                  <h3>Add Module</h3>
                  <form onSubmit={createModule}>
                    <div className="form-group"><label>Module Title</label><input type="text" value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g. Week 1: Introduction" required /></div>
                    <div className="form-group" style={{ marginTop: 12 }}><label>Description (optional)</label><input type="text" value={moduleDesc} onChange={e => setModuleDesc(e.target.value)} /></div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Add Module</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowModuleForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {modules.map((mod, i) => (
                <div key={mod.id} className="module-section">
                  <div className="module-header" onClick={() => toggleModule(mod.id)}>
                    <span className="module-toggle">{collapsedModules[mod.id] ? '▶' : '▼'}</span>
                    <span className="module-header-title">Module {i + 1}: {mod.title}</span>
                    <div className="module-header-actions" onClick={e => e.stopPropagation()}>
                      <button style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 12 }} onClick={() => deleteModule(mod.id)}>Delete</button>
                    </div>
                  </div>

                  {!collapsedModules[mod.id] && (
                    <div className="module-items">
                      {(moduleLessons[mod.id] || []).map((lesson, j) => (
                        <div key={lesson.id} className="module-item" onClick={() => openLessonEditor(lesson)}>
                          <span className="item-icon">📄</span>
                          <div className="item-info">
                            <span className="item-title">Lesson {j + 1}: {lesson.title}</span>
                            <span className="item-meta">
                              {lesson.due_date && `Due ${formatDate(lesson.due_date)}`}
                              {lesson.due_date && lesson.points > 0 && ' · '}
                              {lesson.points > 0 && `${lesson.points} pts`}
                              {lesson.file_url && ' · 📎 File attached'}
                            </span>
                          </div>
                          <div className="item-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn-secondary btn-sm" onClick={() => openLessonEditor(lesson)}>Edit</button>
                            <button className="btn-danger" onClick={() => deleteLesson(lesson.id, mod.id)}>Delete</button>
                          </div>
                        </div>
                      ))}

                      {moduleQuizzes[mod.id] ? (
                        <div className="module-item">
                          <span className="item-icon">📝</span>
                          <div className="item-info">
                            <span className="item-title">{moduleQuizzes[mod.id].title}</span>
                            <span className="item-meta">
                              {moduleQuizzes[mod.id].due_date && `Due ${formatDate(moduleQuizzes[mod.id].due_date)}`}
                              {moduleQuizzes[mod.id].due_date && moduleQuizzes[mod.id].points > 0 && ' · '}
                              {moduleQuizzes[mod.id].points > 0 && `${moduleQuizzes[mod.id].points} pts · `}
                              {(moduleQuestions[moduleQuizzes[mod.id].id] || []).length} questions
                            </span>
                          </div>
                          <div className="item-actions">
                            <button className="btn-secondary btn-sm" onClick={() => openQuizEditor(moduleQuizzes[mod.id])}>Manage Questions</button>
                          </div>
                        </div>
                      ) : activeQuizForm === mod.id ? (
                        <div style={{ padding: '16px 20px', background: '#f8f9ff' }}>
                          <form onSubmit={e => createQuiz(e, mod.id)}>
                            <div className="form-group"><label>Quiz Title</label><input type="text" value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="e.g. Module 1 Quiz" required /></div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                              <div className="form-group" style={{ flex: 1 }}><label>Due Date</label><input type="date" value={quizDueDate} onChange={e => setQuizDueDate(e.target.value)} /></div>
                              <div className="form-group" style={{ flex: 1 }}><label>Points</label><input type="number" value={quizPoints} onChange={e => setQuizPoints(e.target.value)} placeholder="0" min="0" /></div>
                            </div>
                            <div className="form-actions">
                              <button type="submit" className="btn-primary" disabled={loading}>Create Quiz</button>
                              <button type="button" className="btn-secondary" onClick={() => setActiveQuizForm(null)}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      ) : null}

                      {activeLessonForm === mod.id ? (
                        <div style={{ padding: '16px 20px', background: '#f8f9ff' }}>
                          <form onSubmit={e => addLesson(e, mod.id)}>
                            <div className="form-group"><label>Lesson Title</label><input type="text" value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. What is Psychology?" required /></div>
                            <div className="form-group" style={{ marginTop: 10 }}><label>Content</label><textarea value={lessonContent} onChange={e => setLessonContent(e.target.value)} placeholder="Write lesson content..." style={{ minHeight: 100 }} /></div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                              <div className="form-group" style={{ flex: 1 }}><label>Due Date</label><input type="date" value={lessonDueDate} onChange={e => setLessonDueDate(e.target.value)} /></div>
                              <div className="form-group" style={{ flex: 1 }}><label>Points</label><input type="number" value={lessonPoints} onChange={e => setLessonPoints(e.target.value)} placeholder="0" min="0" /></div>
                            </div>
                            <div className="form-actions">
                              <button type="submit" className="btn-primary" disabled={loading}>Add Lesson</button>
                              <button type="button" className="btn-secondary" onClick={() => setActiveLessonForm(null)}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div style={{ display: 'flex' }}>
                          <div className="add-item" style={{ flex: 1 }} onClick={() => setActiveLessonForm(mod.id)}>+ Add Lesson</div>
                          {!moduleQuizzes[mod.id] && (
                            <div className="add-item" style={{ flex: 1, borderLeft: '1px solid var(--border)' }} onClick={() => { setActiveQuizForm(mod.id); setQuizTitle('') }}>+ Add Quiz</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {modules.length === 0 && !showModuleForm && (
                <div className="empty-state"><div className="icon">📂</div><h3>No modules yet</h3>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModuleForm(true)}>Add First Module</button>
                </div>
              )}
            </>
          )}

          {/* LESSON EDITOR */}
          {view === 'lessoneditor' && selectedLesson && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('courses'); setSelectedCourse(null) }}>Courses</span>
                <span className="sep">›</span>
                <span onClick={() => setView('course')}>{selectedCourse?.title}</span>
                <span className="sep">›</span>
                <span>{selectedLesson.title}</span>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 20 }}>Lesson Details</div>
                <form onSubmit={saveLessonDetails}>
                  <div className="form-group"><label>Lesson Title</label><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required /></div>
                  <div className="form-group" style={{ marginTop: 12 }}><label>Page Content</label>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Write your lesson content here..." style={{ minHeight: 300 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Due Date</label><input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} /></div>
                    <div className="form-group" style={{ flex: 1 }}><label>Points</label><input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} min="0" /></div>
                  </div>
                  <div className="form-actions" style={{ marginTop: 16 }}>
                    <button type="submit" className="btn-primary" disabled={loading}>Save Changes</button>
                    <button type="button" className="btn-secondary" onClick={() => setView('course')}>← Back to Course</button>
                  </div>
                </form>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>Lesson File</div>
                {selectedLesson.file_url ? (
                  <div className="module-item" style={{ cursor: 'default', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <span className="item-icon">📎</span>
                    <div className="item-info">
                      <span className="item-title">{selectedLesson.file_name}</span>
                      <span className="item-meta">Attached file</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={selectedLesson.file_url} target="_blank" rel="noreferrer"
                        style={{ textDecoration: 'none', padding: '6px 12px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                        View
                      </a>
                      <button className="btn-danger" onClick={removeLessonFile}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No file attached. Upload a PDF or any file for students to download.</p>
                    <label className="btn-accent" style={{ cursor: 'pointer', display: 'inline-block' }}>
                      {fileUploading ? 'Uploading...' : '📎 Upload File'}
                      <input type="file" style={{ display: 'none' }} onChange={uploadLessonFile} disabled={fileUploading} />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {/* QUIZ EDITOR */}
          {view === 'quizeditor' && selectedQuiz && (
            <>
              <div className="breadcrumb">
                <span onClick={() => { setView('courses'); setSelectedCourse(null) }}>Courses</span>
                <span className="sep">›</span>
                <span onClick={() => setView('course')}>{selectedCourse?.title}</span>
                <span className="sep">›</span>
                <span>{selectedQuiz.title}</span>
              </div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><h2>{selectedQuiz.title}</h2><p>{(moduleQuestions[selectedQuiz.id] || []).length} questions</p></div>
                <button className="btn-accent" onClick={() => setShowQForm(true)}>+ Add Question</button>
              </div>

              {showQForm && (
                <div className="form-panel">
                  <h3>New Question</h3>
                  <form onSubmit={addQuestion}>
                    <div className="form-group"><label>Question</label><input type="text" value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter your question" required /></div>
                    {qOptions.map((opt, i) => (
                      <div className="form-group" key={i} style={{ marginTop: 10 }}>
                        <label><input type="radio" name="correct" checked={qCorrect === i} onChange={() => setQCorrect(i)} style={{ marginRight: 8 }} />Option {i + 1} {qCorrect === i ? '✓ correct' : ''}</label>
                        <input type="text" value={opt} onChange={e => { const u = [...qOptions]; u[i] = e.target.value; setQOptions(u) }} placeholder={`Option ${i + 1}`} required />
                      </div>
                    ))}
                    <div className="form-group" style={{ marginTop: 12 }}><label>Explanation</label><input type="text" value={qExplanation} onChange={e => setQExplanation(e.target.value)} placeholder="Why is that the correct answer?" /></div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={loading}>Add Question</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowQForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="item-list">
                {(moduleQuestions[selectedQuiz.id] || []).map((q, i) => (
                  <div key={q.id} className="item-row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong style={{ fontSize: 14 }}>Q{i + 1}: {q.question}</strong>
                      <button className="btn-danger" onClick={() => deleteQuestion(q.id, selectedQuiz.id)}>Delete</button>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {q.options?.map((opt, j) => (
                        <span key={j} style={{ color: j === q.correct_index ? 'var(--success)' : 'inherit' }}>{j === q.correct_index ? '✓ ' : ''}{opt}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {(moduleQuestions[selectedQuiz.id] || []).length === 0 && !showQForm && (
                  <div className="empty-state"><div className="icon">❓</div><h3>No questions yet</h3>
                    <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowQForm(true)}>Add First Question</button>
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