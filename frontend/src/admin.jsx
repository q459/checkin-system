import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';

// 取得環境變數中的 API 網址 (本地開發時自動備用為 http://localhost:5000)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ==========================================
// 頁面 1：課程與課堂場次管理 (含限時分鐘數設定)
// ==========================================
function SessionsPage({ sessions = [], fetchSessions }) {
  const [courses, setCourses] = useState([]);
  const [newCourseName, setNewCourseName] = useState('');
  
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lectureName, setLectureName] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

  const [filterCourseId, setFilterCourseId] = useState('');
  const [selectedSessionToActivate, setSelectedSessionToActivate] = useState('');

  // ⏱️ 準時緩衝分鐘數 (預設 5 分鐘)
  const [limitMinutes, setLimitMinutes] = useState('5');

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/courses`);
      if (res.ok) {
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("無法取得課程列表", err);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/admin/create-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCourseName })
      });
      if (res.ok) {
        setNewCourseName('');
        fetchCourses();
      }
    } catch (err) {
      alert('建立課程失敗');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          lectureName,
          sessionDate
        })
      });

      if (res.ok) {
        setLectureName('');
        fetchSessions();
      }
    } catch (err) {
      alert('新增課堂失敗');
    }
  };

  const handleSetActiveSession = async (sessionId) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/set-active-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          limitMinutes: parseInt(limitMinutes) || 0
        })
      });
      if (res.ok) {
        alert(`✅ 已成功更新開放簽到場次！（準時緩衝時間：${limitMinutes} 分鐘）`);
        fetchSessions();
      }
    } catch (err) {
      alert('設定失敗');
    }
  };

  const activeSession = (sessions || []).find(s => s.is_active === 1);

  const filteredSessions = filterCourseId 
    ? (sessions || []).filter(s => String(s.course_id) === String(filterCourseId))
    : (sessions || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ border: '2px solid #673AB7', borderRadius: '8px', padding: '20px', backgroundColor: '#F3E5F5' }}>
        <h3>📚 Step 1. 建立新課程主題</h3>
        <form onSubmit={handleCreateCourse} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="請輸入課程名稱 (例如: 基礎數學班、英文會話)" 
            value={newCourseName} 
            onChange={e => setNewCourseName(e.target.value)} 
            required 
            style={{ flex: 1, padding: '8px' }} 
          />
          <button type="submit" style={{ padding: '8px 20px', backgroundColor: '#673AB7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ＋ 建立課程
          </button>
        </form>
      </div>

      <div style={{ border: '2px solid #2196F3', borderRadius: '8px', padding: '20px', backgroundColor: '#E3F2FD' }}>
        <h3>🎯 Step 2. 點擊課程按鈕以新增課堂場次</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {(courses || []).map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourse(c)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: selectedCourse?.id === c.id ? '3px solid #0D47A1' : '1px solid #90CAF9',
                backgroundColor: selectedCourse?.id === c.id ? '#2196F3' : 'white',
                color: selectedCourse?.id === c.id ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '15px'
              }}
            >
              📚 {c.name}
            </button>
          ))}
        </div>

        {selectedCourse ? (
          <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '6px', border: '1px dashed #2196F3' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>
              正在為【{selectedCourse.name}】新增課堂：
            </h4>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="課堂/講次自訂名稱 (預設為第X講)" 
                value={lectureName} 
                onChange={e => setLectureName(e.target.value)} 
                style={{ flex: 1, padding: '8px' }} 
              />
              <input 
                type="date" 
                value={sessionDate} 
                onChange={e => setSessionDate(e.target.value)} 
                required 
                style={{ padding: '8px' }} 
              />
              <button type="submit" style={{ padding: '8px 20px', backgroundColor: '#1976D2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                ＋ 新增該日期課堂
              </button>
            </form>
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>👈 請點擊上方任意課程按鈕開始新增課堂。</p>
        )}
      </div>

      <div style={{ border: '2px solid #4CAF50', borderRadius: '8px', padding: '20px', backgroundColor: '#E8F5E9' }}>
        <h3>🟢 Step 3. 開放上課簽到場次控制面板</h3>
        <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', marginBottom: '20px', borderLeft: '5px solid #4CAF50' }}>
          <strong>目前開放簽到中的場次：</strong> 
          {activeSession ? (
            <span style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: '16px', marginLeft: '8px' }}>
              🟢 {activeSession.title} ({activeSession.session_date})
              {activeSession.limit_minutes > 0 ? ` ⏱️ [開放起 ${activeSession.limit_minutes} 分鐘內算準時]` : ' ⏱️ [不限時]'}
            </span>
          ) : (
            <span style={{ color: '#D32F2F', fontWeight: 'bold', marginLeft: '8px' }}>❌ 目前暫無開放的場次</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '6px' }}>
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px' }}>1. 選擇課程：</label>
            <select 
              value={filterCourseId} 
              onChange={e => {
                setFilterCourseId(e.target.value);
                setSelectedSessionToActivate('');
              }}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">-- 顯示所有課程場次 --</option>
              {(courses || []).map(c => (
                <option key={c.id} value={c.id}>📚 {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px' }}>2. 選擇講次/日期：</label>
            <select 
              value={selectedSessionToActivate} 
              onChange={e => setSelectedSessionToActivate(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
            >
              <option value="">-- 請選擇講次 --</option>
              {filteredSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.is_active === 1 ? '🟢 (開放中) ' : ''}{s.title} [{s.session_date}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px' }}>3. 準時緩衝分鐘數：</label>
            <input 
              type="number" 
              value={limitMinutes} 
              onChange={e => setLimitMinutes(e.target.value)} 
              placeholder="例如: 15"
              style={{ width: '60px', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}
            /> 分鐘
          </div>

          <button 
            onClick={() => handleSetActiveSession(selectedSessionToActivate)}
            disabled={!selectedSessionToActivate}
            style={{ 
              padding: '8px 20px', 
              backgroundColor: selectedSessionToActivate ? '#4CAF50' : '#BDBDBD', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: selectedSessionToActivate ? 'pointer' : 'not-allowed', 
              fontWeight: 'bold' 
            }}
          >
            🚀 開放此場次簽到
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 頁面 2：出席統計看板頁面 (含準時/遲到/手動補簽)
// ==========================================
function StatsPage({ sessions = [] }) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [attendanceStats, setAttendanceStats] = useState([]);

  useEffect(() => {
    const list = sessions || [];
    const active = list.find(s => s.is_active === 1);
    if (active) {
      setSelectedSessionId(active.id);
      fetchAttendanceStats(active.id);
    } else if (list.length > 0) {
      setSelectedSessionId(list[0].id);
      fetchAttendanceStats(list[0].id);
    }
  }, [sessions]);

  const fetchAttendanceStats = async (sessionId) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/attendance-stats?sessionId=${sessionId}`);
      if (res.ok) setAttendanceStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualCheckIn = async (attendeeId, studentName, status) => {
    if (!window.confirm(`確定要為學生【${studentName}】手動補簽為 [${status}] 嗎？`)) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/manual-check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSessionId, attendeeId, status })
      });
      if (res.ok) {
        alert('✅ 已完成手動補簽！');
        fetchAttendanceStats(selectedSessionId);
      } else {
        const data = await res.json();
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      alert('補簽失敗');
    }
  };

  return (
    <div style={{ border: '2px solid #4CAF50', borderRadius: '8px', padding: '20px', backgroundColor: '#E8F5E9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>📊 出席簽到實時統計大表</h3>
        <div>
          選擇場次：
          <select value={selectedSessionId} onChange={e => { setSelectedSessionId(e.target.value); fetchAttendanceStats(e.target.value); }} style={{ padding: '6px' }}>
            {(sessions || []).map(s => <option key={s.id} value={s.id}>{s.title} ({s.session_date})</option>)}
          </select>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#C8E6C9' }}>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>學號</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>學生姓名</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>授權家屬 Email (可多位)</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>簽到狀態</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>簽到時間</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>現場管理</th>
          </tr>
        </thead>
        <tbody>
          {(attendanceStats || []).map(item => (
            <tr key={item.attendee_id}>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>{item.student_id}</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}><strong>{item.student_name}</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>{item.user_emails || '未設定'}</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', fontWeight: 'bold' }}>
                {item.is_present ? (
                  item.check_in_status === '遲到' ? 
                    <span style={{ color: '#E65100' }}>🟡 已簽到 (遲到)</span> : 
                    <span style={{ color: '#2E7D32' }}>🟢 已簽到 (準時)</span>
                ) : (
                  <span style={{ color: '#D32F2F' }}>❌ 未簽到</span>
                )}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>{item.check_in_time || '-'}</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                {!item.is_present && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={() => handleManualCheckIn(item.attendee_id, item.student_name, '準時')}
                      style={{ padding: '4px 8px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      🟢 補簽(準時)
                    </button>
                    <button 
                      onClick={() => handleManualCheckIn(item.attendee_id, item.student_name, '遲到')}
                      style={{ padding: '4px 8px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      🟡 補簽(遲到)
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 頁面 3：學生名單獨立頁面 (含刪除學生按鈕版)
// ==========================================
function StudentsPage({ attendees = [], fetchAttendees }) {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  
  const [emails, setEmails] = useState(['']); 
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');

  const handleAddEmailField = () => {
    setEmails([...emails, '']);
  };

  const handleRemoveEmailField = (index) => {
    const updated = emails.filter((_, i) => i !== index);
    setEmails(updated.length > 0 ? updated : ['']);
  };

  const handleEmailChange = (index, value) => {
    const updated = [...emails];
    updated[index] = value;
    setEmails(updated);
  };

  const handleSubmitAttendee = async (e) => {
    e.preventDefault();
    const validEmails = emails.map(e => e.trim()).filter(e => e !== '');

    const res = await fetch(`${API_URL}/api/admin/save-attendee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        studentId, 
        userEmails: validEmails 
      })
    });

    if (res.ok) {
      setMsg('✅ 學生資料與家屬 Email 更新成功！');
      setName(''); 
      setStudentId(''); 
      setEmails(['']); 
      setEditingId(null);
      fetchAttendees();
    } else {
      setMsg('❌ 儲存失敗');
    }
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setStudentId(item.student_id);
    
    if (item.user_emails) {
      setEmails(item.user_emails.split(',').map(e => e.trim()));
    } else {
      setEmails(['']);
    }
  };

  const handleDeleteStudent = async (attendeeId, studentName) => {
    if (!window.confirm(`⚠️ 確定要刪除學生【${studentName}】嗎？\n相關的家屬 Email 綁定也將一併移除！`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/delete-attendee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendeeId })
      });

      if (res.ok) {
        alert(`✅ 學生【${studentName}】已成功刪除！`);
        fetchAttendees();
      } else {
        alert('❌ 刪除失敗');
      }
    } catch (err) {
      alert('刪除失敗，請檢查後端連線');
    }
  };

  const handleResetDevice = async (emailString) => {
    if (!emailString) return;
    const emailList = emailString.split(',').map(e => e.trim());
    
    let targetEmail = emailList[0];
    if (emailList.length > 1) {
      targetEmail = prompt(`請選擇要重置綁定的 Email：\n${emailList.join('\n')}`, emailList[0]);
    } else {
      if (!window.confirm(`確定要重置 ${targetEmail} 的裝置綁定嗎？`)) return;
    }

    if (!targetEmail) return;

    const res = await fetch(`${API_URL}/api/admin/reset-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: targetEmail.trim() })
    });

    if (res.ok) {
      alert(`✅ 已成功重置 ${targetEmail} 的裝置綁定！`);
      fetchAttendees();
    }
  };

  return (
    <div style={{ border: '2px solid #2196F3', borderRadius: '8px', padding: '20px', backgroundColor: '#E3F2FD' }}>
      <h3>👥 學生成員與多家屬 Email 綁定管理</h3>

      <form onSubmit={handleSubmitAttendee} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #BBDEFB' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>學生姓名 *</label>
            <input 
              type="text" 
              placeholder="請輸入學生姓名" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
            />
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>學號 *</label>
            <input 
              type="text" 
              placeholder="請輸入學號" 
              value={studentId} 
              onChange={e => setStudentId(e.target.value)} 
              required 
              disabled={!!editingId} 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
            />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            授權家屬 Email (可點擊按鈕新增多位家屬)：
          </label>
          
          {emails.map((email, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input 
                type="email" 
                placeholder={`家屬 ${idx + 1} Google Email (例如: parent${idx + 1}@gmail.com)`} 
                value={email} 
                onChange={e => handleEmailChange(idx, e.target.value)} 
                style={{ flex: 1, padding: '8px' }} 
              />
              {emails.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => handleRemoveEmailField(idx)}
                  style={{ padding: '8px 12px', backgroundColor: '#FF5252', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ❌ 刪除
                </button>
              )}
            </div>
          ))}

          <button 
            type="button" 
            onClick={handleAddEmailField}
            style={{ padding: '6px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}
          >
            ＋ 新增家屬 Email 欄位
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button type="submit" style={{ padding: '10px 24px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            {editingId ? '💾 儲存修改' : '＋ 建立學生名單'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={() => { setEditingId(null); setName(''); setStudentId(''); setEmails(['']); }}
              style={{ padding: '10px 16px', backgroundColor: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
            >
              取消
            </button>
          )}
        </div>
      </form>

      {msg && <p style={{ color: 'green', fontWeight: 'bold' }}>{msg}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#BBDEFB' }}>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>學號</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>姓名</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>已授權家屬 Email 列表</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {(attendees || []).map(item => (
            <tr key={item.id}>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>{item.student_id}</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}><strong>{item.name}</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                {item.user_emails ? (
                  item.user_emails.split(',').map((mail, i) => (
                    <span key={i} style={{ display: 'inline-block', backgroundColor: '#E1F5FE', color: '#0288D1', padding: '2px 8px', borderRadius: '12px', fontSize: '13px', margin: '2px', border: '1px solid #81D4FA' }}>
                      ✉️ {mail.trim()}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>未設定</span>
                )}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                <button 
                  onClick={() => handleEditClick(item)} 
                  style={{ padding: '4px 8px', cursor: 'pointer', marginRight: '6px' }}
                >
                  ✏️ 編輯
                </button>
                {item.user_emails && (
                  <button 
                    onClick={() => handleResetDevice(item.user_emails)} 
                    style={{ padding: '4px 8px', cursor: 'pointer', marginRight: '6px' }}
                  >
                    🔄 重置裝置
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteStudent(item.id, item.name)} 
                  style={{ padding: '4px 8px', backgroundColor: '#FF5252', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🗑️ 刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 頁面 4：歷史簽到紀錄 (含遲到/準時欄位)
// ==========================================
function HistoryLogsPage() {
  const [logs, setLogs] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [courseName, setCourseName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchMonth, setSearchMonth] = useState('');

  const fetchHistory = async () => {
    let url = `${API_URL}/api/admin/history-logs?keyword=${encodeURIComponent(keyword)}&courseName=${encodeURIComponent(courseName)}&searchDate=${searchDate}&searchYear=${searchYear}&searchMonth=${searchMonth}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("讀取歷史紀錄失敗", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleExport = (format) => {
    if (!format) return;
    if ((logs || []).length === 0) {
      alert('⚠️ 目前沒有可供匯出的紀錄！');
      return;
    }

    const fileName = `歷史簽到紀錄_${new Date().toISOString().split('T')[0]}`;

    if (format === 'xlsx' || format === 'csv') {
      const exportData = logs.map((log, index) => ({
        '項次': index + 1,
        '簽到時間': log.check_in_time,
        '簽到狀態': log.check_in_status || '準時',
        '課程場次': log.session_title,
        '場次日期': log.session_date,
        '學號': log.student_id,
        '學生姓名': log.student_name,
        '代簽家屬 Email': log.user_email
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '歷史簽到紀錄');

      if (format === 'csv') {
        XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
      } else {
        XLSX.writeFile(workbook, `${fileName}.xlsx`, { bookType: 'xlsx' });
      }
    } 
    else if (format === 'pdf') {
      const printWindow = window.open('', '', 'width=900,height=700');
      
      const tableRowsHtml = logs.map((log, index) => `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px;">${index + 1}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${log.check_in_time}</td>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; color: ${log.check_in_status === '遲到' ? '#E65100' : '#2E7D32'};">${log.check_in_status || '準時'}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${log.session_title} (${log.session_date})</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${log.student_id}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${log.student_name}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${log.user_email}</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h2 { color: #FF9800; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th { background-color: #FFE0B2; border: 1px solid #ccc; padding: 10px; text-align: left; }
            </style>
          </head>
          <body>
            <h2>📜 歷史簽到紀錄報表</h2>
            <p>產出日期：${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>項次</th>
                  <th>簽到時間</th>
                  <th>簽到狀態</th>
                  <th>課程場次</th>
                  <th>學號</th>
                  <th>學生姓名</th>
                  <th>代簽家屬 Email</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  return (
    <div style={{ border: '2px solid #FF9800', borderRadius: '8px', padding: '20px', backgroundColor: '#FFF3E0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>📜 歷史簽到流水紀錄與查詢</h3>
        <div>
          <select 
            defaultValue=""
            onChange={e => { handleExport(e.target.value); e.target.value = ''; }}
            style={{ padding: '8px 12px', backgroundColor: '#2E7D32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            <option value="" disabled style={{ backgroundColor: 'white', color: '#333' }}>📥 匯出紀錄檔案...</option>
            <option value="xlsx" style={{ backgroundColor: 'white', color: '#333' }}>📊 匯出為 Excel (.xlsx)</option>
            <option value="csv" style={{ backgroundColor: 'white', color: '#333' }}>📄 匯出為 CSV (.csv)</option>
            <option value="pdf" style={{ backgroundColor: 'white', color: '#333' }}>📑 匯出為 PDF (預覽列印)</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input type="text" placeholder="搜尋學生姓名或學號" value={keyword} onChange={e => setKeyword(e.target.value)} style={{ padding: '8px', flex: '1 1 150px' }} />
        <input type="text" placeholder="搜尋課程名稱 (如: 數學班)" value={courseName} onChange={e => setCourseName(e.target.value)} style={{ padding: '8px', flex: '1 1 150px' }} />
        <div>指定日期：<input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} style={{ padding: '8px' }} /></div>
        <div>
          <select value={searchYear} onChange={e => setSearchYear(e.target.value)} style={{ padding: '8px' }}>
            <option value="">全部年份</option>
            <option value="2024">2024 年</option>
            <option value="2025">2025 年</option>
            <option value="2026">2026 年</option>
            <option value="2027">2027 年</option>
          </select>
        </div>
        <div>
          <select value={searchMonth} onChange={e => setSearchMonth(e.target.value)} style={{ padding: '8px' }}>
            <option value="">全月份 (1-12月)</option>
            <option value="1">1 月</option><option value="2">2 月</option><option value="3">3 月</option><option value="4">4 月</option>
            <option value="5">5 月</option><option value="6">6 月</option><option value="7">7 月</option><option value="8">8 月</option>
            <option value="9">9 月</option><option value="10">10 月</option><option value="11">11 月</option><option value="12">12 月</option>
          </select>
        </div>
        <button type="submit" style={{ padding: '8px 20px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🔍 查詢紀錄</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#FFE0B2' }}>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>簽到時間</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>簽到狀態</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>課程場次 (日期)</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>學號</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>學生姓名</th>
            <th style={{ padding: '10px', border: '1px solid #ccc' }}>代簽家屬 Email</th>
          </tr>
        </thead>
        <tbody>
          {(logs || []).length === 0 ? (
            <tr><td colSpan="6" style={{ padding: '15px', textAlign: 'center', color: '#666' }}>查無符合條件的歷史簽到紀錄</td></tr>
          ) : (
            logs.map(log => (
              <tr key={log.id}>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{log.check_in_time}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc', fontWeight: 'bold' }}>
                  {log.check_in_status === '遲到' ? 
                    <span style={{ color: '#E65100' }}>🟡 遲到</span> : 
                    <span style={{ color: '#2E7D32' }}>🟢 準時</span>}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{log.session_title} ({log.session_date})</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{log.student_id}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}><strong>{log.student_name}</strong></td>
                <td style={{ padding: '10px', border: '1px solid #ccc' }}>{log.user_email}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 主分頁架構 Component
// ==========================================
function Admin() {
  const [attendees, setAttendees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const location = useLocation();

  const fetchAttendees = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/attendees`);
      if (res.ok) setAttendees(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/sessions`);
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAttendees();
    fetchSessions();
  }, []);

  const getTabStyle = (path) => {
    const isActive = location.pathname === path || (path === '/admin/students' && location.pathname === '/admin');
    return {
      padding: '12px 24px',
      textDecoration: 'none',
      color: isActive ? '#fff' : '#333',
      backgroundColor: isActive ? '#2196F3' : '#e0e0e0',
      borderRadius: '8px 8px 0 0',
      fontWeight: 'bold',
      transition: 'all 0.2s'
    };
  };

  return (
    <div style={{ maxWidth: '950px', margin: '30px auto', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h2>🛠️ 簽到系統</h2>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '3px solid #2196F3', marginBottom: '20px' }}>
        <Link to="/admin/students" style={getTabStyle('/admin/students')}>👥 學生管理名單</Link>
        <Link to="/admin/stats" style={getTabStyle('/admin/stats')}>📊 出席統計看板</Link>
        <Link to="/admin/sessions" style={getTabStyle('/admin/sessions')}>🗓️ 課程場次設定</Link>
        <Link to="/admin/history" style={getTabStyle('/admin/history')}>📜 歷史簽到紀錄</Link>
      </div>

      <Routes>
        <Route path="/" element={<StudentsPage attendees={attendees} fetchAttendees={fetchAttendees} />} />
        <Route path="/students" element={<StudentsPage attendees={attendees} fetchAttendees={fetchAttendees} />} />
        <Route path="/stats" element={<StatsPage sessions={sessions} />} />
        <Route path="/sessions" element={<SessionsPage sessions={sessions} fetchSessions={fetchSessions} />} />
        <Route path="/history" element={<HistoryLogsPage />} />
      </Routes>
    </div>
  );
}

export default Admin;