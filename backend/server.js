const express = require('express');
const cors = require('cors');
const setupDatabase = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

let db;
setupDatabase().then((dbInstance) => { db = dbInstance; });

// ----------------------------------------------------
// 【前台 API】查詢當前開放場次、遲到限制與學生簽到狀態
// ----------------------------------------------------
app.get('/api/my-attendee', async (req, res) => {
  const { email, deviceUuid } = req.query;

  if (!email || !deviceUuid) {
    return res.status(400).json({ message: "缺少必要參數" });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    // 1. 驗證或綁定裝置
    const existingBinding = await db.get(
      `SELECT device_uuid FROM user_device_bindings WHERE user_email = ?`,
      [cleanEmail]
    );

    if (!existingBinding) {
      await db.run(
        `INSERT INTO user_device_bindings (user_email, device_uuid) VALUES (?, ?)`,
        [cleanEmail, deviceUuid]
      );
    } else if (existingBinding.device_uuid !== deviceUuid) {
      return res.status(403).json({ message: "⚠️ 裝置不符！請使用首次登入綁定的特定裝置。" });
    }

    // 2. 查詢當前開放場次
    const activeSession = await db.get(`SELECT * FROM sessions WHERE is_active = 1 LIMIT 1`);
    if (!activeSession) {
      return res.status(400).json({ message: "⚠️ 目前暫無開放簽到的上課場次" });
    }

    // 3. 查詢此 Email 綁定的學生
    const attendee = await db.get(
      `SELECT a.id, a.name, a.student_id 
       FROM user_attendee_mappings m
       JOIN attendees a ON m.attendee_id = a.id
       WHERE LOWER(m.user_email) = ?`,
      [cleanEmail]
    );

    if (!attendee) {
      return res.status(404).json({ message: "⚠️ 此帳號尚未設定對應的學員資料，請聯繫機構管理者！" });
    }

    // 4. 檢查該學生在此場次是否已完成簽到
    const existingLog = await db.get(
      `SELECT * FROM attendance_logs WHERE session_id = ? AND attendee_id = ?`,
      [activeSession.id, attendee.id]
    );

    res.json({ 
      attendee, 
      activeSession,
      isCheckedIn: !!existingLog,
      checkInInfo: existingLog || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "伺服器錯誤" });
  }
});

// 簽到 API (自動判定 準時 vs 遲到)
app.post('/api/check-in', async (req, res) => {
  const { sessionId, userEmail, deviceUuid, attendeeId } = req.body;
  
  try {
    // 檢查重複簽到
    const existingLog = await db.get(
      `SELECT * FROM attendance_logs WHERE session_id = ? AND attendee_id = ?`,
      [sessionId, attendeeId]
    );

    if (existingLog) {
      return res.status(400).json({ message: "⚠️ 該學生今日已完成簽到，請勿重複簽到！" });
    }

    // 取得場次設定與開放時間
    const session = await db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId]);
    if (!session) {
      return res.status(400).json({ message: "找不到該場次" });
    }

    // 計算是否遲到 (比較 開放簽到時間 vs 當前簽到時間)
    let status = '準時';
    if (session.activated_at && session.limit_minutes > 0) {
      const startTime = new Date(session.activated_at).getTime();
      const nowTime = new Date().getTime();
      const diffMinutes = (nowTime - startTime) / (1000 * 60);

      if (diffMinutes > session.limit_minutes) {
        status = '遲到';
      }
    }

    await db.run(
      `INSERT INTO attendance_logs (session_id, user_email, attendee_id, device_uuid, status) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, String(userEmail).trim().toLowerCase(), attendeeId, deviceUuid, status]
    );

    res.json({ 
      success: true, 
      message: status === '遲到' ? "簽到成功！（超過規定分鐘數，標記為遲到）" : "簽到成功！準時到達！",
      status
    });
  } catch (err) {
    console.error("簽到失敗:", err);
    res.status(500).json({ message: "簽到失敗" });
  }
});

// ----------------------------------------------------
// 【後台 API】課程與場次開放設定 (含限時分鐘數)
// ----------------------------------------------------

app.get('/api/admin/courses', async (req, res) => {
  try {
    const list = await db.all(`SELECT * FROM courses ORDER BY id ASC`);
    res.json(list || []);
  } catch (err) {
    res.status(500).json({ message: "無法讀取課程列表" });
  }
});

app.post('/api/admin/create-course', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "請輸入課程名稱" });

  try {
    await db.run(`INSERT INTO courses (code, name) VALUES (?, ?)`, [name.trim(), name.trim()]);
    res.json({ success: true, message: `已成功建立課程 【${name}】` });
  } catch (err) {
    res.status(500).json({ message: "建立課程失敗" });
  }
});

app.get('/api/admin/sessions', async (req, res) => {
  try {
    const list = await db.all(`
      SELECT s.*, c.code as course_code, c.name as course_name 
      FROM sessions s
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY s.id DESC
    `);
    res.json(list || []);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/admin/create-session', async (req, res) => {
  const { courseId, lectureName, sessionDate } = req.body;
  if (!courseId || !sessionDate) {
    return res.status(400).json({ message: "缺少必要參數" });
  }

  try {
    const course = await db.get(`SELECT * FROM courses WHERE id = ?`, [courseId]);
    if (!course) return res.status(404).json({ message: "找不到該課程" });

    const sessionCount = await db.get(`SELECT COUNT(*) as total FROM sessions WHERE course_id = ?`, [courseId]);
    const lectureNo = sessionCount.total + 1;
    const lName = lectureName ? lectureName.trim() : `第${lectureNo}講`;
    const fullTitle = `${course.name} (${lName})`;

    await db.run(
      `INSERT INTO sessions (course_id, title, session_date, is_active) VALUES (?, ?, ?, 0)`,
      [courseId, fullTitle, sessionDate]
    );

    res.json({ success: true, message: "課堂已建立！" });
  } catch (err) {
    res.status(500).json({ message: "建立課堂失敗" });
  }
});

// 開放簽到場次 (寫入開放時間 timestamp 與 限制分鐘數)
app.post('/api/admin/set-active-session', async (req, res) => {
  const { sessionId, limitMinutes } = req.body;
  try {
    const nowIso = new Date().toISOString();
    const minutes = parseInt(limitMinutes) || 0; // 0 代表不限制/不判定遲到

    await db.run(`UPDATE sessions SET is_active = 0`);
    await db.run(
      `UPDATE sessions SET is_active = 1, activated_at = ?, limit_minutes = ? WHERE id = ?`,
      [nowIso, minutes, sessionId]
    );
    res.json({ success: true, message: "已更新開放簽到場次與限時設定！" });
  } catch (err) {
    res.status(500).json({ message: "設定失敗" });
  }
});

// ----------------------------------------------------
// 【後台 API】出席統計看板 (顯示 準時/遲到/未簽到)
// ----------------------------------------------------
app.get('/api/admin/attendance-stats', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ message: "缺少 sessionId" });

  try {
    const stats = await db.all(`
      SELECT 
        a.id as attendee_id,
        a.student_id,
        a.name as student_name,
        GROUP_CONCAT(m.user_email, ', ') as user_emails,
        l.created_at as check_in_time,
        l.status as check_in_status,
        CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END as is_present
      FROM attendees a
      LEFT JOIN user_attendee_mappings m ON a.id = m.attendee_id
      LEFT JOIN attendance_logs l ON a.id = l.attendee_id AND l.session_id = ?
      GROUP BY a.id
      ORDER BY a.student_id ASC
    `, [sessionId]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "無法讀取出席統計" });
  }
});

// 老師現場手動補簽 (可選擇補簽狀態)
app.post('/api/admin/manual-check-in', async (req, res) => {
  const { sessionId, attendeeId, status } = req.body;
  try {
    await db.run(
      `INSERT INTO attendance_logs (session_id, user_email, attendee_id, device_uuid, status) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, '老師現場補簽', attendeeId, 'MANUAL_BY_ADMIN', status || '準時']
    );
    res.json({ success: true, message: "手動補簽成功！" });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: "該學生已完成簽到！" });
    }
    res.status(500).json({ message: "補簽失敗" });
  }
});

// ----------------------------------------------------
// 【後台 API】學生與家屬管理
// ----------------------------------------------------
app.get('/api/admin/attendees', async (req, res) => {
  try {
    const list = await db.all(`
      SELECT 
        a.id, 
        a.name, 
        a.student_id, 
        GROUP_CONCAT(m.user_email, ', ') as user_emails
      FROM attendees a
      LEFT JOIN user_attendee_mappings m ON a.id = m.attendee_id
      GROUP BY a.id
      ORDER BY a.student_id ASC
    `);
    res.json(list || []);
  } catch (err) {
    res.status(500).json({ message: "無法讀取學生清單" });
  }
});

app.post('/api/admin/save-attendee', async (req, res) => {
  const { name, studentId, userEmails } = req.body;
  if (!name || !studentId) {
    return res.status(400).json({ message: "學生姓名與學號為必填！" });
  }

  try {
    let attendee = await db.get(`SELECT id FROM attendees WHERE student_id = ?`, [studentId]);
    let attendeeId;

    if (attendee) {
      await db.run(`UPDATE attendees SET name = ? WHERE id = ?`, [name, attendee.id]);
      attendeeId = attendee.id;
    } else {
      const result = await db.run(`INSERT INTO attendees (name, student_id) VALUES (?, ?)`, [name, studentId]);
      attendeeId = result.lastID;
    }

    await db.run(`DELETE FROM user_attendee_mappings WHERE attendee_id = ?`, [attendeeId]);

    if (Array.isArray(userEmails)) {
      for (const email of userEmails) {
        const cleanEmail = String(email).trim().toLowerCase();
        if (cleanEmail) {
          await db.run(
            `INSERT OR REPLACE INTO user_attendee_mappings (user_email, attendee_id) VALUES (?, ?)`, 
            [cleanEmail, attendeeId]
          );
        }
      }
    }

    res.json({ success: true, message: "學生與家屬資料儲存成功！" });
  } catch (err) {
    res.status(500).json({ message: `儲存失敗：${err.message}` });
  }
});

app.post('/api/admin/delete-attendee', async (req, res) => {
  const { attendeeId } = req.body;
  if (!attendeeId) return res.status(400).json({ message: "缺少必要參數" });

  try {
    await db.run(`DELETE FROM user_attendee_mappings WHERE attendee_id = ?`, [attendeeId]);
    await db.run(`DELETE FROM attendees WHERE id = ?`, [attendeeId]);
    res.json({ success: true, message: "學生已成功刪除！" });
  } catch (err) {
    res.status(500).json({ message: "刪除學生失敗" });
  }
});

app.post('/api/admin/reset-device', async (req, res) => {
  const { userEmail } = req.body;
  try {
    await db.run(`DELETE FROM user_device_bindings WHERE LOWER(user_email) = ?`, [String(userEmail).trim().toLowerCase()]);
    res.json({ success: true, message: `已成功重置 ${userEmail} 的裝置綁定！` });
  } catch (err) {
    res.status(500).json({ message: "重置失敗" });
  }
});

// ----------------------------------------------------
// 【後台 API】歷史簽到紀錄 (含狀態 準時/遲到)
// ----------------------------------------------------
app.get('/api/admin/history-logs', async (req, res) => {
  const { keyword, courseName, searchDate, searchYear, searchMonth } = req.query;

  try {
    let sql = `
      SELECT 
        l.id,
        s.title as session_title,
        s.session_date,
        a.student_id,
        a.name as student_name,
        l.user_email,
        l.status as check_in_status,
        l.created_at as check_in_time
      FROM attendance_logs l
      JOIN sessions s ON l.session_id = s.id
      JOIN attendees a ON l.attendee_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword && String(keyword).trim() !== '') {
      sql += ` AND (a.name LIKE ? OR a.student_id LIKE ?)`;
      const term = `%${String(keyword).trim()}%`;
      params.push(term, term);
    }

    if (courseName && String(courseName).trim() !== '') {
      sql += ` AND s.title LIKE ?`;
      params.push(`%${String(courseName).trim()}%`);
    }

    if (searchDate && String(searchDate).trim() !== '') {
      sql += ` AND (s.session_date = ? OR DATE(l.created_at) = ?)`;
      params.push(searchDate, searchDate);
    }

    if (searchYear && String(searchYear).trim() !== '') {
      sql += ` AND strftime('%Y', s.session_date) = ?`;
      params.push(searchYear);
    }

    if (searchMonth && String(searchMonth).trim() !== '') {
      const formattedMonth = String(searchMonth).padStart(2, '0');
      sql += ` AND strftime('%m', s.session_date) = ?`;
      params.push(formattedMonth);
    }

    sql += ` ORDER BY l.created_at DESC`;

    const logs = await db.all(sql, params);
    res.json(logs || []);
  } catch (err) {
    console.error("查詢歷史紀錄失敗：", err);
    res.json([]);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`後端伺服器已於 http://localhost:${PORT} 啟動`));