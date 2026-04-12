# System Modernization Review

Ngày rà soát: 2026-04-10  
Phạm vi: `smart contract`, `backend`, `frontend`, `database`, `infrastructure`, `dev workflow`

## 1. Kết luận ngắn

Hệ thống hiện tại không nên tiếp tục phát triển theo trục:

- `private geth + custom EntryPoint + custom paymaster + session key trả về client`
- `frontend Vite nhưng vẫn kéo theo react-scripts / next / web3 legacy`
- `backend .NET cũ gắn chặt Azure + SQL Server + blockchain services cũ`

Hướng hợp lý hơn hiện nay:

- coi blockchain như một `application layer` EVM chuẩn, không phải một nền tảng chain tự chế
- giữ `ElectionFactoryV1 / ElectionV1` làm trục bầu cử on-chain hiện tại
- giữ `ASP.NET Core` nhưng làm mỏng backend và bóc tách khỏi Azure-specific services
- giữ `React + Vite`, loại dần các dependency không còn phục vụ active path
- đặt mục tiêu trung hạn là `Docker + PostgreSQL + MinIO + Sepolia/Besu`

## 2. Bức tranh hiện tại

### Smart contract

Hiện đang tồn tại 3 lớp:

1. Legacy AA stack:
   - `EntryPoint`
   - `HLUPaymaster`
   - `HoLiHuToken`
   - `SimpleAccount`
   - các hợp đồng quản lý cũ
2. Test-flow direct vote:
   - `SimpleElectionFlow`
3. Target flow nghiêm túc hơn:
   - `ElectionFactoryV1`
   - `ElectionV1`

Nhận định:

- lớp `1` là phần phức tạp nhất và không còn phù hợp với mục tiêu hiện tại
- lớp `2` chỉ nên giữ làm mẫu UX hoặc chuyển vào `legacy/`
- lớp `3` là active target phù hợp nhất cho hiện tại

### Backend

Backend hiện tại vẫn đang mang 2 hệ song song:

- business API cũ gắn với SQL Server/Azure/legacy blockchain
- module mới `ElectionV1ReadService` để đọc deployment record và trạng thái Sepolia

Nhận định:

- phần backend web2 vẫn còn giá trị
- phần blockchain backend cũ đang quá dày và quá riêng cho kiến trúc trước đó
- backend hiện tại nên được refactor theo mô hình `thin blockchain integration`

### Frontend

Frontend hiện là `React + Vite`, nhưng dependency graph còn rất bẩn:

- có `vite`
- vẫn còn `react-scripts`
- vẫn còn `next`
- vẫn còn cả `web3` và `ethers`
- còn nhiều test pages và route legacy

Nhận định:

- hướng `React + Vite` là đúng
- nhưng package graph hiện tại cần được dọn mạnh
- `Web3Context` cũ đang hardcode chain HoLiHu `210`, token `HLU`, network add/switch cho flow cũ

### Database

Database hiện tại là `SQL Server`, backend dùng `UseSqlServer`.

Nhận định:

- về kỹ thuật có thể chạy tiếp
- nhưng không phù hợp mục tiêu cloud-agnostic / Docker-first mà team đang hướng tới
- mục tiêu đích nên là `PostgreSQL + Npgsql`

### Infrastructure

Hiện hệ thống còn phụ thuộc khá mạnh vào:

- Azure SQL
- Azure Blob
- Pinata
- appsettings secrets

Nhận định:

- đây là phần làm hệ thống kém portable nhất, còn hơn cả việc đang dùng SQL Server
- nếu muốn deploy linh hoạt, cần chuẩn hóa theo `env vars + Docker Compose + object storage abstraction`

## 3. Giữ, Bỏ, Thay

## Giữ

### Giữ ngay

- `ElectionFactoryV1 / ElectionV1`
- `Sepolia` cho public app-level testing
- `ASP.NET Core` làm backend nghiệp vụ
- `React + Vite` làm frontend chính
- `ethers` tạm thời trong ngắn hạn nếu cần giảm biến động migration

### Giữ nhưng cần chuẩn hóa

- backend business logic hiện có
- hệ thống route và auth hiện có
- một phần entity/model nghiệp vụ web2

## Bỏ khỏi active path

### Smart contract / blockchain

- custom `EntryPoint`
- custom `HLUPaymaster`
- `HoLiHuToken` cho mục đích gas/fee nội bộ
- session key trả raw về client
- `SimpleAccount` / SCW flow cũ
- phụ thuộc `geth.holihu.online` làm chain chính cho app

### Frontend

- `react-scripts`
- `next`
- `web3` nếu không còn trang nào cần
- test pages đi thẳng vào production route
- context Web3 cũ nếu đã chuyển hẳn sang Sepolia/Besu target flow

### Backend

- service blockchain cũ phục vụ SCW/paymaster/session key ở active path
- log/cấu hình nhạy cảm trong `appsettings.json`
- coupling trực tiếp vào Azure blob implementation

## Thay

### Smart contract tooling

- chuẩn chính: `Foundry`
- công cụ phụ: `Hardhat 3`
- thư viện chuẩn: `OpenZeppelin Contracts 5`

### Database

- từ `SQL Server`
- sang `PostgreSQL` qua `Npgsql.EntityFrameworkCore.PostgreSQL`

### File/object storage

- từ `Azure Blob` hard-coded
- sang interface `IObjectStorage`
- triển khai mặc định: `MinIO / S3-compatible`

### Frontend web3 stack

- ngắn hạn: `ethers` giữ để tận dụng code đang chạy
- trung hạn: chuyển dần sang `viem` và nếu cần thì `wagmi`

### Runtime/platform

- backend target nên lên `.NET 10 LTS`
- hiện tại `.NET 8` vẫn còn hỗ trợ nhưng sẽ hết support trong 2026

## 4. Đích kiến trúc nên chốt

### V1 thực dụng

- FE: `React 19 + Vite + TypeScript`
- BE: `ASP.NET Core .NET 10`
- DB: `PostgreSQL`
- Object storage: `MinIO`
- Chain app testing: `Sepolia`
- Local chain: `Anvil`
- Private production/staging: `Besu QBFT` nếu trường cần chain riêng
- Contracts: `ElectionFactoryV1 / ElectionV1`

### V2 privacy

Sau khi V1 chạy ổn:

- thêm `Semaphore` hoặc một lớp anonymous eligibility/voting
- chỉ sau đó mới đánh giá tiếp `MACI`

## 5. Tại sao cần bỏ bớt công nghệ phức tạp

Những phần sau đang làm tăng độ khó nhưng không tạo thêm giá trị tương xứng:

- `ERC-4337` custom stack
- paymaster riêng
- token phí nội bộ
- SCW provisioning riêng
- session key lifecycle phía server rồi trả về browser

Với bài toán bầu cử sinh viên:

- giá trị cốt lõi là đúng quy trình, dễ kiểm toán, dễ vận hành, dễ test
- không phải phô diễn account abstraction

Do đó:

- on-chain chỉ nên giữ phần thực sự cần kiểm chứng
- phần identity, điều phối, file, role, thông báo, audit vẫn ở backend web2

## 6. Vấn đề công nghệ cũ đang thấy rõ trong repo

### Backend

- target framework là `net8.0`, nhưng roadmap nên lên `.NET 10 LTS`
- build hiện cảnh báo `AutoMapper 13.0.1` có advisory
- `Program.cs` vẫn đăng ký rất nhiều service blockchain cũ dù active path mới không cần hết

### Frontend

- `package.json` còn cả `vite`, `react-scripts`, `next`
- install phải dùng `--legacy-peer-deps`, đây là dấu hiệu package graph hiện tại không còn lành mạnh
- còn song song nhiều stack web3 và nhiều dependency không thuộc active path

### SQL / infra

- backend còn bám `UseSqlServer`
- storage/service còn nghiêng Azure-specific
- local/portable deployment chưa phải first-class path của toàn hệ thống chính

## 7. Thứ tự migration hợp lý nhất

### Giai đoạn 1: Ngừng mở rộng legacy blockchain stack

- đóng băng `EntryPoint`, `Paymaster`, `HLU token`, `SCW`, `session key`
- coi đó là `legacy`

### Giai đoạn 2: Chuyển UI/BE active path sang ElectionV1

- việc này đã bắt đầu ở trang `QuanLySmartContractPage`
- bước tiếp theo là thay dần flow bầu cử cũ sang `ElectionV1`

### Giai đoạn 3: Dọn frontend

- gỡ `react-scripts`
- gỡ `next`
- kiểm tra và gỡ `web3` nếu không còn active usage
- gom web3 state mới vào một module riêng cho Sepolia/Besu

### Giai đoạn 4: Dọn backend

- tách module blockchain mới thành `ElectionV1` bounded context
- giảm phụ thuộc của controller/service cũ vào blockchain legacy
- chuyển secrets sang env

### Giai đoạn 5: Đổi hạ tầng dữ liệu

- chuyển `SQL Server` sang `PostgreSQL`
- đổi `Azure Blob` sang abstraction và `MinIO`
- dựng `docker-compose` cho app chính

### Giai đoạn 6: Privacy upgrade

- khi V1 ổn định mới làm `Semaphore`

## 8. Quyết định kiến trúc nên chốt ngay

### Chốt nên làm

- `React + Vite`
- `ASP.NET Core`
- `PostgreSQL`
- `Docker-first`
- `Sepolia` cho testnet
- `Besu QBFT` nếu cần private production
- `ElectionFactoryV1 / ElectionV1` làm contract baseline

### Chốt không nên tiếp tục

- custom AA stack
- token phí nội bộ
- paymaster riêng
- SCW/session key flow cũ
- geth private chain làm active application environment

## 9. Việc nên làm ngay sau báo cáo này

1. Port tiếp flow bầu cử hiện tại sang `ElectionV1` ở các trang nghiệp vụ thay vì chỉ trang console.
2. Tạo danh sách dependency FE cần gỡ trong một PR riêng.
3. Tách backend blockchain mới thành module riêng và đánh dấu legacy services là deprecated.
4. Thiết kế migration `SQL Server -> PostgreSQL`.
5. Dựng `docker-compose` đích cho app chính.

## 10. Kết luận cuối

Hệ thống hiện tại có thể được hiện đại hóa mà không cần viết lại toàn bộ từ đầu.

Nhưng cần chốt rõ:

- giữ web stack hiện đại và thực dụng
- bỏ blockchain complexity không cần thiết
- xem `ElectionV1` là baseline mới
- chuyển cả hệ thống sang một mô hình dễ vận hành hơn, ít phụ thuộc cloud hơn, và sát thực tế bầu cử hơn
