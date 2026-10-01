import { useEffect, useState } from 'react';
import axios from 'axios';
import './UserManagement.css';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
});

const roleNames = {
  employee: 'Nhân viên',
  manager: 'Quản lý',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
};

const blankForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'employee',
  department: '',
  manager: '',
  status: 'active',
};

export default function UserManagement({ token, role }) {
  const allowed = role === 'hr_admin' || role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  async function loadUsers(query = '') {
    const { data } = await api.get('/users', {
      headers,
      params: { search: query },
    });
    setUsers(data.items);
  }

  useEffect(() => {
    if (!allowed) return;

    Promise.all([
      api.get('/users', { headers }),
      api.get('/departments', { headers }),
    ])
      .then(([usersResponse, departmentsResponse]) => {
        setUsers(usersResponse.data.items);
        setDepartments(departmentsResponse.data);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Không tải được dữ liệu nhân viên.');
      });
  }, [token, allowed]);

  if (!allowed) return null;

  function update(event) {
    setForm(current => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function startCreate() {
    setForm(blankForm);
    setEditingId('');
    setPassword('');
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function startEdit(user) {
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      department: user.department?._id || '',
      manager: user.manager?._id || '',
      status: user.status,
    });
    setEditingId(user._id);
    setPassword('');
    setError('');
    setMessage('');
    setShowForm(true);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setPassword('');

    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        role: form.role,
        department: form.department || null,
        manager: form.manager || null,
      };

      if (editingId) {
        await api.patch(`/users/${editingId}`, {
          ...payload,
          status: form.status,
        }, { headers });
        setMessage('Đã cập nhật thông tin nhân viên.');
      } else {
        const { data } = await api.post('/users', {
          ...payload,
          email: form.email.trim(),
        }, { headers });

        setPassword(data.temporaryPassword);
        setMessage('Đã tạo tài khoản. Hãy lưu mật khẩu tạm bên dưới.');
      }

      await loadUsers(search);
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Không lưu được thông tin.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(user) {
    const next = user.status === 'active' ? 'inactive' : 'active';

    if (!window.confirm(
      `${next === 'inactive' ? 'Khóa' : 'Mở khóa'} tài khoản ${user.email}?`
    )) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await api.patch(`/users/${user._id}`, {
        status: next,
      }, { headers });

      await loadUsers(search);
      setMessage(
        next === 'inactive'
          ? 'Đã khóa tài khoản.'
          : 'Đã mở khóa tài khoản.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Không thay đổi được trạng thái.');
    } finally {
      setBusy(false);
    }
  }

  async function searchUsers(event) {
    event.preventDefault();
    setError('');

    try {
      await loadUsers(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm kiếm được.');
    }
  }

  const managers = users.filter(user =>
    user.role === 'manager' && user.status === 'active'
  );

  return (
    <section className="people-panel">
      <div className="people-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ NHÂN SỰ</span>
          <h2>Quản lý nhân viên</h2>
          <p className="muted">Quản lý tài khoản, phòng ban và phân quyền.</p>
        </div>

        <button className="people-primary" onClick={startCreate}>
          + Thêm nhân viên
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="people-success">{message}</div>}

      {password && (
        <div className="people-password">
          <strong>Mật khẩu tạm của tài khoản vừa tạo:</strong>
          <code>{password}</code>
          <p>Hãy lưu lại ngay. Mật khẩu này chỉ hiển thị trong lần tạo tài khoản.</p>
        </div>
      )}

      <form className="people-search" onSubmit={searchUsers}>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Tìm theo tên hoặc email..."
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      {showForm && (
        <form className="people-form" onSubmit={save}>
          <div className="people-form-heading">
            <h3>{editingId ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}</h3>
            <button type="button" onClick={() => setShowForm(false)}>✕</button>
          </div>

          <div className="people-fields">
            <label>
              Họ tên
              <input
                name="fullName"
                value={form.fullName}
                onChange={update}
                minLength={2}
                maxLength={100}
                required
              />
            </label>

            <label>
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update}
                disabled={Boolean(editingId)}
                required
              />
            </label>

            <label>
              Số điện thoại
              <input
                name="phone"
                value={form.phone}
                onChange={update}
                maxLength={20}
              />
            </label>

            <label>
              Vai trò
              <select name="role" value={form.role} onChange={update}>
                {Object.entries(roleNames)
                  .filter(([key]) =>
                    role === 'super_admin' ||
                    ['employee', 'manager'].includes(key)
                  )
                  .map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
              </select>
            </label>

            <label>
              Phòng ban
              <select
                name="department"
                value={form.department}
                onChange={update}
              >
                <option value="">Chưa phân phòng ban</option>
                {departments.filter(dept => dept.status === 'active').map(dept => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
            </label>

            <label>
              Quản lý trực tiếp
              <select name="manager" value={form.manager} onChange={update}>
                <option value="">Chưa có quản lý</option>
                {managers.map(user => (
                  <option key={user._id} value={user._id}>{user.fullName}</option>
                ))}
              </select>
            </label>

            {editingId && (
              <label>
                Trạng thái
                <select name="status" value={form.status} onChange={update}>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Đã khóa</option>
                </select>
              </label>
            )}
          </div>

          <div className="people-form-actions">
            <button type="button" onClick={() => setShowForm(false)}>Hủy</button>
            <button className="people-primary" type="submit" disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      )}

      <div className="people-table-wrap">
        <table className="people-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Vai trò</th>
              <th>Phòng ban</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>
                  <strong>{user.fullName}</strong>
                  <small>{user.email}</small>
                </td>
                <td>{roleNames[user.role] || user.role}</td>
                <td>{user.department?.name || 'Chưa phân'}</td>
                <td>
                  <span className={
                    user.status === 'active'
                      ? 'people-active'
                      : 'people-inactive'
                  }>
                    {user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td>
                  <div className="people-actions">
                    <button onClick={() => startEdit(user)}>Sửa</button>
                    <button
                      disabled={busy}
                      onClick={() => toggleStatus(user)}
                    >
                      {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="muted">Chưa tìm thấy nhân viên nào.</p>
        )}
      </div>
    </section>
  );
}