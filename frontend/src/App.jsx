import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// 取得環境變數中的 API 網址與 Client ID
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '979046836859-5tnfvuk14ll953i5ed30htij8sjs213l.apps.googleusercontent.com';

function HomeCheckIn() {
  const [deviceUuid, setDeviceUuid] = useState('');
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState('');
  const [attendee, setAttendee] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInInfo, setCheckInInfo] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let localUuid = localStorage.getItem('device_uuid');
    if (!localUuid) {
      localUuid = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('device_uuid', localUuid);
    }
    setDeviceUuid(localUuid);
  }, []);

  const handleLoginSuccess = (res) => {
    try {
      const decoded = jwtDecode(res.credential);
      setUserEmail(decoded.email);
      setUserName(decoded.name);
      fetchMyAttendee(decoded.email, deviceUuid);
    } catch (err) {
      setStatusMessage('登入解密失敗');
    }
  };

  const fetchMyAttendee = async (email, uuid) => {
    try {
      const res = await fetch(`${API_URL}/api/my-attendee?email=${encodeURIComponent(email)}&deviceUuid=${uuid}`);
      const data = await res.json();
      if (res.ok) {
        setAttendee(data.attendee);
        setActiveSession(data.activeSession);
        setIsCheckedIn(!!data.isCheckedIn);
        setCheckInInfo(data.checkInInfo || null);
        setStatusMessage('');
      } else {
        setAttendee(null);
        setActiveSession(null);
        setIsCheckedIn(false);
        setCheckInInfo(null);
        setStatusMessage(data.message);
      }
    } catch (err) {
      setStatusMessage('無法連線至後端伺服器');
    }
  };

  const handleCheckIn = async () => {
    if (!attendee || !activeSession || isCheckedIn) return;
    try {
      const res = await fetch(`${API_URL}/api/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          userEmail,
          deviceUuid,
          attendeeId: attendee.id
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`✅ ${data.message}`);
        setIsCheckedIn(true);
        fetchMyAttendee(userEmail, deviceUuid);
      } else {
        setStatusMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setStatusMessage('❌ 簽到連線失敗');
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <div style={{ border: '2px solid #4CAF50', borderRadius: '12px', padding: '30px', textAlign: 'center', backgroundColor: '#f9fff9' }}>
        <h2>👵 線上簽到系統 👨‍🦳</h2>

        {!userEmail ? (
          <div>
            <p style={{ fontSize: '18px' }}>請點擊下方按鈕登入 Google：</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => setStatusMessage('登入失敗')} />
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '14px', color: '#555' }}>
              登入帳號：<strong>{userName}</strong> ({userEmail})
            </p>

            {activeSession && (
              <div style={{ margin: '15px 0', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '6px', color: '#0d47a1', fontWeight: 'bold' }}>
                📌 當前開放場次：{activeSession.title} ({activeSession.session_date})
                {activeSession.limit_minutes > 0 && (
                  <p style={{ fontSize: '12px', color: '#d32f2f', margin: '5px 0 0 0' }}>
                    ⏱️ 本場次簽到時間為開放後 {activeSession.limit_minutes} 分鐘內，超時將記錄為遲到。
                  </p>
                )}
              </div>
            )}

            {attendee && (
              <div style={{ margin: '20px 0', padding: '20px', backgroundColor: isCheckedIn ? '#e8f5e9' : '#fffde7', borderRadius: '8px', border: isCheckedIn ? '2px solid #4CAF50' : '2px solid #fbc02d' }}>
                <h3 style={{ fontSize: '24px', margin: '0 0 15px 0' }}>簽到對象：{attendee.name}</h3>
                
                {isCheckedIn ? (
                  <div style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                    <p style={{ fontSize: '20px', margin: '10px 0' }}>
                      {checkInInfo?.status === '遲到' ? '🟡 簽到完成（遲到）' : '🟢 簽到完成（準時）'}
                    </p>
                    {checkInInfo && (
                      <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                        簽到時間：{checkInInfo.created_at}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleCheckIn}
                    style={{
                      padding: '16px 45px',
                      fontSize: '22px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    按下簽到
                  </button>
                )}
              </div>
            )}

            {statusMessage && (
              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#fff3cd', color: '#856404', fontWeight: 'bold', margin: '15px 0' }}>
                {statusMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route path="/" element={<HomeCheckIn />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;