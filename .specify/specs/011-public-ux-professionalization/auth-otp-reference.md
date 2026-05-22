# Đợt 11 US2 — PRE-gate reference (T010): BẤT BIẾN auth/OTP, cấm sửa

US2 chỉ đổi JSX/vỏ. POST-gate (T014): `git diff HEAD -- <file>` chỉ được gồm hunk
import + JSX; **0 dòng** các handler/định danh dưới đây xuất hiện trong diff.

## LoginPage.tsx — verbatim (gốc dòng ~95–335)

```ts
// getRecaptchaToken (~104-120): executeRecaptcha('login_page') → setRecaptchaToken
// handleAutoLogin (~122-147): dispatch(refreshJwtToken()) → resetSecurityState(user.id)
//   → localStorage user_data/isLoggedOut → fetchLatestSession → redirectAfterLogin
// handleCredentialsLogin (~174-244): validate username/password → token=recaptcha
//   → clearAllAccessCache() → dispatch(login({tenDangNhap,matKhau,recaptchaToken}))
//   → login.fulfilled.match → rememberedUsername → resetSecurityState → user_data
//   → fetchLatestSession → addToast → redirectAfterLogin
// handleMetaMaskLogin (~246-335): MetaMask installed check → token=recaptcha
//   → clearAllAccessCache() → connectWallet() → setMetaMaskPhase('signing')
//   → authNonce=`${Date.now()}-${rand}` ; nonce=`HoLiHu BlockVote Login\nAddress: ${walletAddress}\nNonce: ${authNonce}`
//   → window.ethereum.request({method:'personal_sign', params:[nonce, walletAddress]})
//   → dispatch(loginWithMetaMask({diaChiVi,nonce,signature,recaptchaToken}))
//   → loginWithMetaMask.fulfilled.match → resetSecurityState → user_data(+walletAddress)
//   → fetchLatestSession? → addToast → redirectAfterLogin ; finally setMetaMaskPhase('idle')
// useEffect: void handleAutoLogin() + rememberedUsername; getRecaptchaToken; phienDangNhapChiTiet→redirect
```
Định danh cấm xuất hiện trong POST-diff (LoginPage): `executeRecaptcha`, `refreshJwtToken`,
`resetSecurityState`, `clearAllAccessCache`, `login(`, `loginWithMetaMask`, `personal_sign`,
`fetchLatestSession`, chuỗi `nonce`/`authNonce`.

## DangKyTaiKhoanPage.tsx (gốc ~52–77)
`handleSave`: recaptcha check → `dispatch(registerAccount({account, recaptchaToken}))` → trích ví.
**KHÔNG đụng** `../features/TaoTaiKhoanForm` (NewAccountForm). Cấm trong diff: `registerAccount`,
`executeRecaptcha`, props/JSX của `<NewAccountForm>`.

## TimTaiKhoanPage / GuiOTPPage / DatLaiMatKhauPage
Giữ verbatim hàm: tìm tài khoản, gửi OTP, xác minh OTP, đặt lại mật khẩu (Redux `maOTP`/
recovery slices). OTP **không echo** ra UI/console, **không lưu plaintext** localStorage nơi
script chạm. Cấm trong diff: tên thunk gửi/xác minh OTP & đặt lại mật khẩu.

## Phương pháp (đã chứng minh ở S4/S5 Đợt 10)
Mỗi trang: chỉ Edit vùng import + `return(...)` JSX bằng clay; copy nguyên block logic/handler.
PRE = file này. POST = `git diff HEAD -- <file>` chỉ chạm import/JSX; grep các định danh trên
trong diff `+`/`-` (bỏ `+++`/`---`) phải **rỗng**. Verify kèm `npm run typecheck:active`=0 +
quickstart §B1–B4.

> Ghi chú thực thi: US1 đã DONE & commit (gate=0). US2 là lát nhạy cảm nhất
> (5 trang auth/OTP, Principle I — blocker tuyệt đối). Mỗi trang refactor theo
> đúng quy trình verbatim trên; không gộp/ rush. Reference này là cổng PRE.
