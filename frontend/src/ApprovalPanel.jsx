import { useEffect, useState } from 'react';
import axios from 'axios';
import './ApprovalPanel.css';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
});

export default function ApprovalPanel({ token, role }) {
  const isManager = role === 'manager';
  const isHR = role === 'hr_admin' || role === 'super_admin';
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const endpoint = isManager ? '/approvals/team' : '/approvals/hr';

  useEffect(() => {
    if (!isManager && !isHR) return;

    let active = true;

    api.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => {
        if (active) setRequests(data);
      })
      .catch(err => {
        if (active) {
          setError(err.response?.data?.message || 'Không tải được danh sách chờ duyệt.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, endpoint, isManager, isHR]);

  if (!isManager && !isHR) return null;

  async function decide(id, decision) {
    const note = (notes[id] || '').trim();

    if (decision === 'reject' && !note) {
      setError('Bạn cần nhập lý do khi từ chối đơn.');
      return;
    }

    setBusyId(id);
    setError('');
    setMessage('');

    try {
      await api.post(
        `/approvals/${id}/${isManager ? 'manager' : 'hr'}`,
        { decision, note },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { data } = await api.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRequests(data);
      setMessage(
        decision === 'approve'
          ? 'Đã duyệt đơn thành công.'
          : 'Đã từ chối đơn.'
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Không xử lý được đơn. Vui lòng thử lại.'
      );
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="approval-panel">
      <div className="approval-heading">
        <div>
          <span className="eyebrow">
            {isManager ? 'QUẢN LÝ NHÓM' : 'QUẢN TRỊ NHÂN SỰ'}
          </span>
          <h2>Đơn chờ phê duyệt</h2>
          <p className="muted">
            {isManager
              ? 'Các đơn đang chờ quản lý xác nhận.'
              : 'Các đơn đã được Manager duyệt và đang chờ HR xác nhận cuối.'}
          </p>
        </div>

        <span className="approval-count">{requests.length} đơn</span>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="approval-success">{message}</p>}

      {loading ? (
        <p className="muted">Đang tải danh sách...</p>
      ) : requests.length === 0 ? (
        <div className="approval-empty">
          Hiện không có đơn nào chờ bạn phê duyệt.
        </div>
      ) : (
        <div className="approval-list">
          {requests.map(request => (
            <article className="approval-item" key={request._id}>
              <div className="approval-info">
                <h3>{request.user?.fullName || 'Nhân viên'}</h3>
                <p className="muted">{request.user?.email}</p>

                <div className="approval-details">
                  <span>{request.leaveType?.name || 'Nghỉ phép'}</span>
                  <span>{request.days} ngày</span>
                  <span>
                    {request.startDate?.slice(0, 10)}
                    {' → '}
                    {request.endDate?.slice(0, 10)}
                  </span>
                </div>

                <p className="approval-reason">
                  <strong>Lý do:</strong> {request.reason}
                </p>
              </div>

              <div className="approval-actions">
                <label htmlFor={`note-${request._id}`}>
                  Ghi chú phê duyệt
                </label>

                <textarea
                  id={`note-${request._id}`}
                  placeholder="Nhập ghi chú hoặc lý do từ chối..."
                  maxLength={500}
                  value={notes[request._id] || ''}
                  onChange={event => setNotes(current => ({
                    ...current,
                    [request._id]: event.target.value,
                  }))}
                />

                <div className="approval-buttons">
                  <button
                    type="button"
                    className="approval-reject"
                    disabled={Boolean(busyId)}
                    onClick={() => decide(request._id, 'reject')}
                  >
                    Từ chối
                  </button>

                  <button
                    type="button"
                    className="approval-accept"
                    disabled={Boolean(busyId)}
                    onClick={() => decide(request._id, 'approve')}
                  >
                    {busyId === request._id ? 'Đang xử lý...' : '✓ Duyệt đơn'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}