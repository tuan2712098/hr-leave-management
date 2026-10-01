# HR Leave Management System

Ứng dụng quản lý nghỉ phép nội bộ, xây dựng bằng Express.js, MongoDB/Mongoose và React.js.

## Công nghệ
- Backend: Node.js, Express.js, Mongoose, JWT, bcryptjs
- Frontend: React.js, Vite, Axios
- Database: MongoDB

## Chức năng đã triển khai
- Đăng nhập JWT và phân quyền theo vai trò.
- Quản lý nhân viên: xem, thêm, sửa, khóa và mở khóa tài khoản.
- Quản lý phòng ban và loại nghỉ phép qua API.
- Cấp và theo dõi số dư ngày phép.
- Nhân viên gửi đơn và xem lịch sử nghỉ phép.
- Manager duyệt hoặc từ chối đơn.
- HR duyệt cấp cuối và cập nhật số ngày phép đã sử dụng.
- Nhân viên hủy đơn khi còn chờ Manager duyệt.

## Cài đặt

Yêu cầu: Node.js, npm và MongoDB đang chạy tại localhost:27017.

### Backend

1. Vào thư mục `backend`.
2. Chạy `npm install`.
3. Tạo file `.env` dựa trên `.env.example` và đặt JWT_SECRET riêng.
4. Chạy `node src/seed.js` để tạo tài khoản demo trên database mới.
5. Chạy `node src/setupDemo.js` để tạo phòng ban và ngày phép mẫu.
6. Chạy `npm run dev`.

Backend: http://localhost:4000

### Frontend

1. Vào thư mục `frontend`.
2. Chạy `npm install`.
3. Chạy `npm run dev`.

Frontend: http://localhost:5173

## Tài khoản demo

Sau khi chạy `seed.js`, Terminal sẽ hiển thị mật khẩu demo.

- admin@hr.local — Super Admin
- hr@hr.local — HR Admin
- manager@hr.local — Manager
- employee@hr.local — Employee

Không sử dụng tài khoản và mật khẩu demo trong môi trường production.

## Kiểm thử

Các thao tác đã kiểm thử thủ công:
- Đăng nhập nhân viên.
- Gửi đơn nghỉ phép.
- Manager duyệt đơn.
- HR duyệt và cập nhật số dư ngày phép.
- Sửa thông tin nhân viên.
- Hủy đơn đang chờ duyệt.

## Giới hạn hiện tại

Chưa triển khai đầy đủ thông báo email, lịch nghỉ phép, báo cáo Excel và cơ chế transaction xuyên nhiều bản ghi khi duyệt đơn đồng thời. Số ngày nghỉ hiện tính theo ngày làm việc từ thứ Hai đến thứ Sáu, chưa loại trừ ngày nghỉ lễ.

Dự án phục vụ mục đích học tập và thực hành.