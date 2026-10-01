import { useEffect, useState } from 'react';
import axios from 'axios';
import LeavePanel from './LeavePanel';
import ApprovalPanel from './ApprovalPanel';
import UserManagement from './UserManagement';

const api = axios.create({ baseURL: 'http://localhost:4000/api' });

const roleNames = {
  employee: 'Nhân viên',
  manager: 'Quản lý',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
};

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const token = sessionStorage.getItem('hr_token');
      const user = JSON.parse(sessionStorage.getItem('hr_user') || 'null');
      return token && user ? { token, user } : null;
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState('employee@hr.local');
  const [password, setPassword] = useState('');
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;

    api.get('/leave-balances/me', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(({ data }) => setBalances(data))
      .catch((err) => {
        if (err.response?.status === 401) {
          sessionStorage.removeItem('hr_token');
          sessionStorage.removeItem('hr_user');
          setSession(null);
          setError('Phiên đăng nhập đã hết hạn.');
        } else {
          setError('Chưa tải được dữ liệu ngày phép.');
        }
      });
  }, [session]);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });

      sessionStorage.setItem('hr_token', data.accessToken);
      sessionStorage.setItem('hr_user', JSON.stringify(data.user));

      setBalances([]);
      setPassword('');
      setSession({ token: data.accessToken, user: data.user });
    } catch (err) {
      setError(err.response?.data?.message || 'Không kết nối được Backend.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem('hr_token');
    sessionStorage.removeItem('hr_user');
    setSession(null);
    setBalances([]);
    setError('');
  }

  if (!session) {
    return (
      <main className="login-layout">
        <section className="welcome">
          <div className="brand">✦ HR Workspace</div>
          <div>
            <span className="eyebrow">HR LEAVE MANAGEMENT SYSTEM</span>
            <h1>Quản lý nghỉ phép<br /><em>dễ dàng hơn.</em></h1>
            <p>Gửi đơn nghỉ phép, theo dõi số dư và quản lý quy trình phê duyệt trên cùng một hệ thống.</p>
            <div className="features">
              <div>01 — Theo dõi ngày phép</div>
              <div>02 — Phê duyệt hai cấp</div>
              <div>03 — Quản lý nhân sự</div>
            </div>
          </div>
          <small>HR Workspace · Internship Project</small>
        </section>

        <section className="login-side">
          <div className="login-card">
            <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
            <h2>Đăng nhập</h2>
            <p className="muted">Sử dụng tài khoản được cấp để tiếp tục.</p>

            <form onSubmit={login}>
              <label>Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />

              <label>Mật khẩu</label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />

              {error && <p className="error">{error}</p>}

              <button className="primary" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
              </button>
            </form>

            <div className="demo">
              <strong>CHỌN TÀI KHOẢN DEMO</strong>
              <div className="demo-buttons">
                {[
                  ['Nhân viên', 'employee@hr.local'],
                  ['Manager', 'manager@hr.local'],
                  ['HR', 'hr@hr.local'],
                  ['Admin', 'admin@hr.local'],
                ].map(([label, value]) => (
                  <button key={value} type="button" onClick={() => setEmail(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <small>Các tài khoản sử dụng mật khẩu demo đã tạo ở Backend.</small>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const { user } = session;

  return (
    <main className="dashboard">
      <header>
        <div className="brand">✦ HR Workspace</div>
        <div>
          <span className="role">{roleNames[user.role]}</span>
          <button className="logout" onClick={logout}>Đăng xuất</button>
        </div>
      </header>

      <div className="content">
        <span className="eyebrow">TỔNG QUAN NHÂN SỰ</span>
        <h1>Xin chào, {user.fullName} 👋</h1>
        <p className="muted">Thông tin tài khoản và số ngày phép của bạn.</p>

        <div className="cards">
          <section className="card">
            <span className="eyebrow">TÀI KHOẢN</span>
            <div className="avatar">{user.fullName.charAt(0)}</div>
            <h3>{user.fullName}</h3>
            <p className="muted">{user.email}</p>
            <span className="role">{roleNames[user.role]}</span>
          </section>

          <section className="card">
            <span className="eyebrow">SỐ DƯ NGÀY PHÉP</span>
            {error && <p className="error">{error}</p>}
            {balances.length === 0 && <p className="muted">Chưa có dữ liệu ngày phép.</p>}
            {balances.map(item => (
              <div className="balance" key={item._id}>
                <div>
                  <strong>{item.leaveType?.name || 'Loại nghỉ phép'}</strong>
                  <p className="muted">Đã dùng: {item.usedDays} ngày</p>
                </div>
                <div className="days">
                  {item.remainingDays}
                  <small>ngày còn lại</small>
                </div>
              </div>
            ))}
          </section>
        </div>

        <LeavePanel token={session.token} />
        <ApprovalPanel token={session.token} role={user.role} />
        <UserManagement token={session.token} role={user.role} />
        <div className="notice">
          Giao diện đăng nhập và số dư ngày phép đã kết nối Backend.
          Tiếp theo sẽ bổ sung gửi đơn và phê duyệt trực tiếp trên web.
        </div>
      </div>
    </main>
  );
}