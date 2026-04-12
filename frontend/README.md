# Frontend - Hệ thống Bầu cử HoLiHu (EIP-4337)

Đây là giao diện người dùng (frontend) cho Hệ thống Bầu cử Bảo mật HoLiHu. Frontend này cho phép người dùng tương tác với các smart contract đã triển khai trên blockchain, sử dụng kiến trúc Account Abstraction (EIP-4337) để mang lại trải nghiệm bỏ phiếu mượt mà và an toàn.

Dự án là một phần của nghiên cứu khoa học sinh viên "Nghiên cứu ứng dụng công nghệ Blockchain trong xây dựng hệ thống bầu cử bảo mật" của nhóm HoLiHu (Phạm Thị Minh Hồng, Nguyễn Thùy Linh, Nguyễn Mạnh Hùng) tại Trường Đại học Hàng Hải Việt Nam.

## Mục tiêu Frontend 🎯

* Cung cấp giao diện trực quan, dễ sử dụng cho cử tri và quản trị viên (nếu có).
* Cho phép người dùng tạo/quản lý ví thông minh (Smart Account) tuân theo EIP-4337.
* Hiển thị thông tin về các cuộc bầu cử, ứng cử viên.
* Thực hiện quy trình bỏ phiếu một cách an toàn thông qua việc tạo và gửi `UserOperation`.
* Theo dõi trạng thái phiếu bầu và xem kết quả bầu cử (nếu được phép).

## Công nghệ sử dụng (Frontend Stack) 🖥️

* **React:** Một thư viện JavaScript phổ biến để xây dựng giao diện người dùng.
* **Ethers.js:** Thư viện để tương tác với blockchain Ethereum (gửi `UserOperation`, truy vấn trạng thái, v.v.).
* **[Thư viện Styling - ví dụ: CSS Modules, Tailwind CSS, Shadcn]:** 
* **[Thư viện Quản lý Trạng thái - ví dụ: Redux Toolkit, Zustand, Context API]
* **[Thư viện Routing - ví dụ: React Router]:** 
* **Axios/Fetch API:** Để giao tiếp với Bundler hoặc các API backend khác (nếu có).

## Điều kiện tiên quyết 📋

* Node.js (phiên bản 16.x trở lên được khuyến nghị)
* npm (Node Package Manager) hoặc yarn
* Một trình duyệt web hiện đại (Chrome, Firefox, Edge, Safari)

## Bắt đầu & Cài đặt 🚀

1.  **Clone repository (nếu frontend nằm trong cùng repo với backend):**
    ```bash
    git clone [https://github.com/meiiie/vananh.git](https://github.com/meiiie/vananh.git) # Thay bằng URL repo của bạn
    cd vananh/frontend # Hoặc đường dẫn đến thư mục frontend của bạn
    ```
    Nếu frontend là một repository riêng, hãy clone repository đó.

2.  **Cài đặt dependencies:**
    ```bash
    npm install
    # hoặc
    yarn install
    ```

3.  **Thiết lập Biến Môi trường:**
    Tạo một file `.env` trong thư mục gốc của frontend (ví dụ: `frontend/.env`). File này sẽ chứa các cấu hình cần thiết để kết nối với blockchain và các dịch vụ liên quan.
    **Ví dụ nội dung file `.env`:**
    ```env
    REACT_APP_RPC_URL=YOUR_ETHEREUM_NODE_RPC_URL # Ví dụ: [https://sepolia.infura.io/v3/YOUR_INFURA_ID](https://sepolia.infura.io/v3/YOUR_INFURA_ID) hoặc http://localhost:8545
    REACT_APP_BUNDLER_URL=[https://api.holihu.online/bundler](https://api.holihu.online/bundler) # Hoặc URL Bundler của bạn
    REACT_APP_ENTRYPOINT_ADDRESS=YOUR_ENTRYPOINT_CONTRACT_ADDRESS
    REACT_APP_ACCOUNT_FACTORY_ADDRESS=YOUR_ACCOUNT_FACTORY_CONTRACT_ADDRESS
    REACT_APP_VOTING_CONTRACT_ADDRESS=YOUR_HOLIHU_VOTE_CONTRACT_ADDRESS
    REACT_APP_CHAIN_ID=YOUR_CHAIN_ID # Ví dụ: 11155111 cho Sepolia

    # Các biến khác nếu có
    # REACT_APP_PAYMASTER_URL=YOUR_PAYMASTER_URL (nếu sử dụng Paymaster)
    ```
    **Quan trọng:**
    * Thay thế `YOUR_...` bằng các giá trị thực tế của dự án.
    * Đảm bảo file `.env` đã được thêm vào `.gitignore` để tránh commit các thông tin nhạy cảm.

## Các Script có sẵn 📜

Trong thư mục dự án frontend, bạn có thể chạy:

* **`npm start`** hoặc **`yarn start`**
    Chạy ứng dụng ở chế độ phát triển. Mở [http://localhost:3000](http://localhost:3000) (hoặc cổng khác nếu được cấu hình) để xem trong trình duyệt. Trang sẽ tự động tải lại nếu bạn thực hiện thay đổi.

* **`npm run build`** hoặc **`yarn build`**
    Xây dựng ứng dụng cho môi trường production vào thư mục `build`. Nó tối ưu hóa bản dựng để có hiệu suất tốt nhất.

* **`npm test`** hoặc **`yarn test`** (Nếu bạn có thiết lập unit tests)
    Chạy trình chạy thử nghiệm trong chế độ tương tác.

## Kết nối với Backend và Smart Contracts 🔗

Frontend này được thiết kế để tương tác với:
1.  **Bundler (EIP-4337):** Gửi các `UserOperation` đến URL của Bundler được cấu hình trong `REACT_APP_BUNDLER_URL`. Bundler sẽ gói các `UserOperation` này và gửi chúng lên `EntryPoint` contract.
2.  **EntryPoint Contract:** Địa chỉ của `EntryPoint` contract cần được cấu hình (`REACT_APP_ENTRYPOINT_ADDRESS`) để frontend có thể tạo `UserOperation` chính xác.
3.  **AccountFactory Contract:** Nếu người dùng tạo ví thông minh mới thông qua frontend, địa chỉ của `AccountFactory` (`REACT_APP_ACCOUNT_FACTORY_ADDRESS`) sẽ được sử dụng.
4.  **HoLiHuVote Contract:** Hợp đồng bầu cử chính (`REACT_APP_VOTING_CONTRACT_ADDRESS`) sẽ được gọi bởi ví thông minh của người dùng để thực hiện hành động bỏ phiếu.
5.  **RPC Node:** Để đọc dữ liệu từ blockchain (ví dụ: trạng thái bầu cử, thông tin ứng cử viên) và để `ethers.js` tương tác với mạng lưới (`REACT_APP_RPC_URL`).

Đảm bảo tất cả các địa chỉ hợp đồng và URL trong file `.env` là chính xác cho môi trường mạng lưới (ví dụ: localhost, Sepolia, mainnet) mà bạn đang làm việc.
## Đóng góp 🤝

Nếu bạn muốn đóng góp cho dự án, vui lòng fork repository và tạo một pull request. Bạn cũng có thể mở issue nếu tìm thấy lỗi hoặc có đề xuất cải thiện.

## Giấy phép 📄

MIT

## Liên hệ 📧

*hungkhp888@gmail.com

---
Chúc mừng bạn với giao diện người dùng của hệ thống HoLiHu!
