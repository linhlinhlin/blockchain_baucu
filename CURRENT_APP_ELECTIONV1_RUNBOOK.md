# Current App ElectionV1 Runbook

Runbook này áp dụng cho:

- FE hiện tại: `E:\test_thacsi\blockchain\frontend`
- BE hiện tại: `E:\test_thacsi\blockchain\WebApplication3\WebApplication3\WebApplication3`
- Smart contract repo: `E:\test_thacsi\blockchain\blockchain_sm`

## 1. Điều kiện trước khi chạy

- `blockchain_sm/.env` phải có:
  - `SEPOLIA_RPC_URL`
  - `SEPOLIA_PRIVATE_KEYS`
  - `FACTORY_ADDRESS`
- Backend phải có cấu hình DB/JWT hoạt động như luồng app hiện tại.
- Tài khoản đăng nhập vào app phải có ví MetaMask đã gắn trong backend. Nếu không, API tạo election sẽ từ chối vì ví admin không thuộc tài khoản đang đăng nhập.

## 2. Chạy backend hiện tại

Tại PowerShell:

```powershell
cd E:\test_thacsi\blockchain
dotnet run --project E:\test_thacsi\blockchain\WebApplication3\WebApplication3\WebApplication3\WebApplication3.csproj --launch-profile http
```

Backend chạy ở:

- `http://localhost:5293`

API mới đã dùng:

- `GET /api/election-v1/public-config`
- `GET /api/election-v1/elections`
- `GET /api/election-v1/elections/{identifier}`
- `GET /api/election-v1/elections/{identifier}/proof`
- `POST /api/election-v1/elections`

## 3. Chạy frontend hiện tại

Mở terminal khác:

```powershell
cd E:\test_thacsi\blockchain\frontend
npm install --legacy-peer-deps
npm run dev -- --host 127.0.0.1 --port 3000
```

Frontend chạy ở:

- `http://127.0.0.1:3000`

## 4. Luồng tạo election mới

1. Đăng nhập vào app như bình thường.
2. Mở route:

```text
/app/tao-phien-bau-cu
```

3. Kết nối MetaMask.
4. Chuyển ví sang `Sepolia`.
5. Điền:
   - `title`
   - `description`
   - `commitStart`
   - `commitEnd`
   - `revealEnd`
   - ít nhất `2` ứng viên
   - danh sách ví cử tri
6. Bấm `Tạo Election Trên Sepolia`.
7. Nếu thành công, app tự chuyển sang:

```text
/app/quan-ly-smart-contract?election=<address>
```

## 5. Luồng test business flow

### 5.1 Quản lý election

Vào:

```text
/app/quan-ly-smart-contract
```

Trang này đọc deployment record thật từ backend và hiển thị:

- danh sách election
- phase
- tổng commit
- tổng reveal
- revealed results
- proof eligibility theo ví đang kết nối

### 5.2 Commit vote

1. Chọn election.
2. Kết nối đúng ví MetaMask có trong whitelist.
3. Khi election đang ở phase `Commit`, bấm `Commit` tại ứng viên muốn chọn.
4. Vote package được lưu vào `localStorage` của trình duyệt.

### 5.3 Reveal vote

1. Chờ election sang phase `Reveal`.
2. Dùng lại đúng ví đã commit.
3. Dùng lại đúng browser profile đã commit.
4. Bấm `Reveal Vote`.

### 5.4 Finalize

1. Chờ election sang phase `Ended`.
2. Bấm `Finalize Election`.
3. Kết quả cuối cùng sẽ dựa trên các phiếu đã reveal thành công.

## 6. Lưu ý quan trọng

- `ElectionV1` hiện là commit-reveal, chưa phải anonymous voting hoàn chỉnh.
- `Reveal` sẽ lộ ví và lựa chọn ứng viên trên chain.
- Kết quả hiển thị trên UI là `revealed results`, không phải toàn bộ `commits`.
- Backend tạo election hiện dùng helper script trong `blockchain_sm` để build manifest, Merkle whitelist và deploy qua factory.

## 7. Smoke deploy đã có

Smoke deploy mới nhất dùng helper create path:

- election address: `0x09F0b5Ed469Fb914Ce7930Ab086cF619a71076B0`
- tx hash: `0xf09ffcbd1cb1e75dadc0d5e9148ff5c122813606d8b6b13b3d91906bd28b648a`

Election này đã xuất hiện trong `GET /api/election-v1/elections` của backend hiện tại.
