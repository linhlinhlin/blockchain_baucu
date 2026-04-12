# Hệ thống Bầu cử Bảo mật HoLiHu sử dụng Blockchain (EIP-4337 Account Abstraction)

Dự án này là một triển khai hệ thống bầu cử bảo mật, minh bạch và phi tập trung, ứng dụng công nghệ blockchain. Hệ thống được đặt tên là "HoLiHu", tích hợp kiến trúc đa token, hệ thống proxy hai tầng và **Account Abstraction (EIP-4337)** để nâng cao trải nghiệm người dùng và bảo mật.

Dự án được phát triển bởi nhóm sinh viên Phạm Thị Minh Hồng, Nguyễn Thùy Linh, Nguyễn Mạnh Hùng thuộc Khoa Công nghệ Thông tin, Trường Đại học Hàng Hải Việt Nam, dưới sự hướng dẫn của ThS. Phạm Ngọc Duy.

## Mục tiêu 🎯

* Khắc phục hạn chế của phương thức bầu cử truyền thống và E-Voting hiện tại như gian lận, chi phí cao và thiếu tính minh bạch.
* Xây dựng một giải pháp bầu cử toàn diện, an toàn và đáng tin cậy.
* Tận dụng các tính năng tiên tiến của blockchain như Account Abstraction (EIP-4337) để đơn giản hóa tương tác cho người dùng.

## Các Công nghệ Chính 🚀

* **Blockchain:** Nền tảng cốt lõi để đảm bảo tính phi tập trung, minh bạch và bất biến.
* **Smart Contracts:** Logic nghiệp vụ của hệ thống bầu cử, được triển khai trên blockchain.
* **Hardhat:** Môi trường phát triển Ethereum để biên dịch, triển khai, kiểm thử và gỡ lỗi smart contract.
* **Account Abstraction (EIP-4337):** Cho phép các tài khoản hợp đồng thông minh (smart contract accounts) hoạt động như ví gốc (EOA), mang lại trải nghiệm người dùng linh hoạt hơn (ví dụ: giao dịch không cần gas, khôi phục xã hội).
* **Kiến trúc Đa Token:** 
* **Hệ thống Proxy Hai Tầng:** 
* **Bundler & EntryPoint (theo EIP-4337):** Các thành phần quan trọng để xử lý `UserOperation` và thực thi giao dịch thay mặt cho tài khoản hợp đồng.
* **React (Frontend):** 
* **Ethers.js:** Thư viện JavaScript để tương tác với blockchain Ethereum.

## Kiến trúc Hệ thống (Dựa trên EIP-4337) 🏗️

Hệ thống sử dụng mô hình Account Abstraction theo EIP-4337, bao gồm các thành phần chính:

1.  **UserOperation:** Một cấu trúc dữ liệu pseudo-transaction mô tả ý định giao dịch của người dùng từ một tài khoản hợp đồng.
2.  **Bundler:** Một node đặc biệt thu thập các `UserOperation` từ một mempool riêng, gói chúng thành một giao dịch duy nhất và gửi đến `EntryPoint` contract.
3.  **EntryPoint Contract:** Một hợp đồng thông minh toàn cục xử lý các gói `UserOperation`, xác minh và thực thi chúng.
4.  **Account Contract (Smart Wallet):** Hợp đồng thông minh đại diện cho ví của người dùng, chứa logic xác minh chữ ký và thực thi lệnh gọi.
5.  **Paymaster (Tùy chọn):** Hợp đồng có thể tài trợ phí gas cho `UserOperation` thay mặt người dùng.

## Cấu trúc Thư mục Dự án (Gợi ý) 📁
├── contracts/                 # Chứa các file smart contract (.sol)
│   ├── HoLiHuVote.sol         # Hợp đồng chính cho việc bỏ phiếu
│   ├── Account.sol            # Hợp đồng ví thông minh (Account Abstraction)
│   ├── AccountFactory.sol     # Hợp đồng tạo Account Contract
│   ├── EntryPoint.sol         # (Có thể là tham chiếu đến EntryPoint chính thức)
│   └── ...                    # Các hợp đồng khác (ví dụ: Paymaster, Token)
├── scripts/                   # Scripts để triển khai, tương tác với contracts
│   └── deploy.js
├── test/                      # Tests cho smart contracts
│   └── HoLiHuVote.test.js
├── hardhat.config.js          # File cấu hình Hardhat
├── package.json
├── .env                       # Lưu các biến môi trường (API keys, private keys)
└── README.md


## Thiết lập và Cài đặt 🛠️

1.  **Clone repository:**
    ```bash
    git clone https://github.com/meiiie/blockchain_sm.git
    ```

2.  **Cài đặt dependencies:**
    Đảm bảo bạn đã cài đặt Node.js và npm (hoặc yarn).
    ```bash
    npm install
    # hoặc
    yarn install
    ```

3.  **Thiết lập biến môi trường:**
    Tạo một file `.env` ở thư mục gốc của dự án và thêm các biến cần thiết. Ví dụ:
    ```
    PRIVATE_KEY=YOUR_ACCOUNT_PRIVATE_KEY
    RPC_URL=YOUR_ETHEREUM_NODE_RPC_URL
    ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY # Nếu muốn verify contract trên Etherscan
    REACT_APP_BUNDLER_URL=YOUR_BUNDLER_URL # Ví dụ: [https://api.holihu.online/bundler](https://api.holihu.online/bundler)
    ```
    **Lưu ý:** Không bao giờ commit file `.env` chứa private key thực lên GitHub. Hãy thêm `.env` vào file `.gitignore` của bạn.

## Các lệnh Hardhat cơ bản 🚀

* **Biên dịch contracts:**
    ```bash
    npx hardhat compile
    ```

* **Chạy tests:**
    ```bash
    npx hardhat test
    ```

* **Triển khai contracts:**
    Chỉnh sửa script trong thư mục `scripts/` (ví dụ: `deploy.js`) với logic triển khai của bạn.
    ```bash
    npx hardhat run scripts/deploy.js --network <tuy_thuoc_vao_mang>
    ```
    Ví dụ: `npx hardhat run scripts/deploy.js --network localhost` hoặc `npx hardhat run scripts/deploy.js --network sepolia` (nếu bạn đã cấu hình mạng Sepolia trong `hardhat.config.js`).

* **Chạy node Hardhat cục bộ:**
    ```bash
    npx hardhat node
    ```

## Quy trình Bỏ phiếu (Sơ lược dựa trên EIP-4337) 🗳️

1.  **Khởi tạo UserOperation:** Người dùng tương tác với frontend để tạo một `UserOperation` cho hành động bỏ phiếu. Dữ liệu này bao gồm:
    * `sender`: Địa chỉ của Account Contract (ví thông minh) của người dùng.
    * `nonce`: Số thứ tự giao dịch từ Account Contract.
    * `initCode`: Mã để triển khai Account Contract nếu nó chưa tồn tại.
    * `callData`: Dữ liệu lệnh gọi đến Account Contract, thường là lệnh để Account Contract gọi đến hợp đồng bầu cử (`HoLiHuVote.sol`) với thông tin phiếu bầu.
    * Các trường liên quan đến phí gas (`callGasLimit`, `verificationGasLimit`, `preVerificationGas`, `maxFeePerGas`, `maxPriorityFeePerGas`).
    * `paymasterAndData`: Dữ liệu cho Paymaster (nếu có).

2.  **Ký UserOperation:** Người dùng (hoặc signer được ủy quyền bởi Account Contract) ký vào hash của `UserOperation`.

    const userOpHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
            [
                userOp.sender, userOp.nonce, userOp.initCode, userOp.callData,
                userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
                userOp.maxFeePerGas, userOp.maxPriorityFeePerGas, userOp.paymasterAndData
            ]
        )
    );
    signature = await signer.signMessage(ethers.utils.arrayify(userOpHash));
    userOp.signature = signature;
    ```

3.  **Gửi UserOperation đến Bundler:**
    `UserOperation` đã ký được gửi đến một Bundler.
    const bundlerUrl = process.env.REACT_APP_BUNDLER_URL || '[https://api.holihu.online/bundler](https://api.holihu.online/bundler)';
    const bundler = new ethers.providers.JsonRpcProvider(bundlerUrl);
    const response = await bundler.send('eth_sendUserOperation', [userOp, contracts.entryPointAddress]);
    ```

4.  **Bundler xử lý và gửi lên EntryPoint:** Bundler kiểm tra `UserOperation`, gói nó với các `UserOperation` khác (nếu có) và gửi lên `EntryPoint` contract.

5.  **EntryPoint xác minh và thực thi:** `EntryPoint` contract xác minh chữ ký và các điều kiện khác của `UserOperation` bằng cách gọi hàm `validateUserOp` trên Account Contract. Nếu hợp lệ, nó sẽ thực thi `callData` thông qua Account Contract.

6.  **Theo dõi kết quả:** Frontend theo dõi giao dịch được Bundler tạo ra để xác nhận kết quả bỏ phiếu.

## Đóng góp 🤝

Nếu bạn muốn đóng góp cho dự án, vui lòng fork repository và tạo một pull request. Bạn cũng có thể mở issue nếu tìm thấy lỗi hoặc có đề xuất cải thiện.

## Giấy phép 📄

MIT

## Liên hệ 📧
*hungkhp888@gmail.com

---
