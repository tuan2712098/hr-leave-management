import { useEffect, useState } from 'react';
import axios from 'axios';
import './LeavePanel.css';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

const statusNames = {
  pending: 'Chờ Manager duyệt',
  approved_by_manager: 'Chờ HR duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
};

export default function LeavePanel({ token }) {
  const [types, setTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  async function loadRequests() {
    const { data } = await api.get('/leave-requests/me', { headers });
    setRequests(data);
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/leave-types', { headers }),
      api.get('/leave-requests/me', { headers }),
    ])
      .then(([typesResponse, requestsResponse]) => {
        if (!active) return;

        const available = typesResponse.data.filter(
          item => item.status === 'active'
        );

        setTypes(available);
        setRequests(requestsResponse.data);
        setForm(current => ({
          ...current,
          leaveType: current.leaveType || available[0]?._id || '',
        }));
      })
      .catch(err => {
        if (active) {
          setError(
            err.response?.data?.message ||
            'Không thể tải dữ liệu nghỉ phép.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function cancelRequest(id) {
    if (!window.confirm('Bạn chắc chắn muốn hủy đơn nghỉ phép này?')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await api.patch(
        `/leave-requests/${id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadRequests();
      setMessage('Đã hủy đơn nghỉ phép thành công.');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Không thể hủy đơn nghỉ phép.'
      );
    }
  }
  function update(event) {
    setForm(current => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.endDate < form.startDate) {
      setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/leave-requests', form, { headers });
      await loadRequests();

      setForm(current => ({
        ...current,
        startDate: '',
        endDate: '',
        reason: '',
      }));

      setMessage('Đã gửi đơn thành công. Đơn đang chờ Manager duyệt.');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Không gửi được đơn nghỉ phép.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="leave-layout">
      <div className="leave-box">
        <div className="eyebrow">ĐĂNG KÝ NGHỈ PHÉP</div>
        <h2>Gửi đơn nghỉ phép</h2>

        <form className="leave-form" onSubmit={submit}>
          <label>Loại nghỉ phép</label>
          <select
            name="leaveType"
            value={form.leaveType}
            onChange={update}
            required
          >
            <option value="">Chọn loại nghỉ phép</option>
            {types.map(type => (
              <option key={type._id} value={type._id}>
                {type.name}
              </option>
            ))}
          </select>

          <div className="leave-dates">
            <div>
              <label>Ngày bắt đầu</label>
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={update}
                required
              />
            </div>

            <div>
              <label>Ngày kết thúc</label>
              <input
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={update}
                required
              />
            </div>
          </div>

          <label>Lý do nghỉ phép</label>
          <textarea
            name="reason"
            value={form.reason}
            onChange={update}
            placeholder="Nhập lý do nghỉ phép..."
            minLength={3}
            maxLength={1000}
            required
          />

          {error && <p className="error">{error}</p>}
          {message && <p className="leave-success">{message}</p>}

          <button className="primary" disabled={saving || !types.length}>
            {saving ? 'Đang gửi...' : 'Gửi đơn nghỉ phép →'}
          </button>
        </form>
      </div>

      <div className="leave-box">
        <div className="eyebrow">LỊCH SỬ NGHỈ PHÉP</div>
        <h2>Đơn của tôi</h2>

        {requests.length === 0 ? (
          <p className="muted">Bạn chưa có đơn nghỉ phép nào.</p>
        ) : (
          <div className="leave-list">
            {requests.map(request => (
              <div className="leave-item" key={request._id}>
                <div className="leave-item-top">
                  <strong>{request.leaveType?.name || 'Nghỉ phép'}</strong>
                  <span className={`leave-status ${request.status}`}>
                    {statusNames[request.status] || request.status}
                  </span>
                </div>

                <p>
                  {request.startDate.slice(0, 10)}
                  {' → '}
                  {request.endDate.slice(0, 10)}
                </p>

                <p>{request.days} ngày · {request.reason}</p>

                {request.status === 'pending' && (
                  <button
                    type="button"
                    className="cancel-leave-button"
                    onClick={() => cancelRequest(request._id)}
                  >
                    Hủy đơn
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}