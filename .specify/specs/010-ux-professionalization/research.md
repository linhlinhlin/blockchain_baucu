# Phase 0 — Research: Đợt 10 UX/UI Professionalization

Mọi NEEDS CLARIFICATION đã được giải quyết (3 quyết định sản phẩm chốt với user trước `/speckit-specify`). Dưới đây là các quyết định kỹ thuật + bằng chứng `file:line`.

## D1 — Hệ thiết kế: giữ & nâng cấp Apple-like sáng

- **Decision**: Giữ token clay/apple trong `frontend/src/index.css:5-46` (biến `--clay-*`, `--surface-*`, `--product-shadow`) làm **nguồn sự thật duy nhất**; lớp component dùng chung tiêu thụ token này. Không đổi font (`system-ui` stack `index.css:43-44`), không đổi accent (`--clay-primary:#0066cc`).
- **Rationale**: `design.md` + Đợt 7 guardrails (`index.css:790-896`) đã ép single-accent/one-radius/flat. User chốt "nâng cấp hệ hiện tại". Đổi sẽ phá Đợt 7/8/9.
- **Alternatives rejected**: Coursera/YouTube/dark — user loại; mâu thuẫn `design.md`.

## D2 — Thang trạng thái ngữ nghĩa tối thiểu

- **Decision**: Thêm token `--state-success/-warning/-danger/-info` (+ nền nhạt) trong `index.css`, **chỉ** dùng cho StatusBadge / toast / phase-chip / validation. Trang trí vẫn single-blue.
- **Rationale**: Dashboard commit/reveal/finalize cần phân biệt `finalized` vs `canceled` vs lỗi (rủi ro vận hành nếu chỉ một sắc xanh). Đã biện minh ở `plan.md` Complexity Tracking.
- **Alternatives rejected**: chỉ chữ/icon — kiểm chứng ngầm ở trang hiện tại cho thấy trạng thái khó đọc, dễ nhầm.

## D3 — Một hệ toast (FR-005)

- **Decision**: Chuẩn hoá trên **`react-hot-toast`** qua wrapper `components/ui/clay/notify.ts`; mọi `toast.*` ở active path gọi qua wrapper (vị trí/kiểu/thời lượng nhất quán). Không gỡ lib khác khỏi `package.json` (ngoài scope) nhưng cấm import vào active path.
- **Bằng chứng**: Provider đã mount `react-hot-toast` ở `AppAfterLogin.tsx:11,37` và `AppBeforeLogin.tsx:3,21`. Active path đã dùng react-hot-toast: `QuanLySmartContractPage.tsx:4`, `QuetMaQRPage.tsx:20`, `Web3Context.tsx:14`, `UserMenu.tsx:9`. `sweetalert2`/`sonner`/`react-toastify` **không** xuất hiện ở 5 trang active. `Use-toast.tsx` (Radix) mount qua `AppRoutes.tsx:60,81` nhưng 5 trang không gọi.
- **Rationale**: Active path gần như đã chuẩn; chỉ cần wrapper hợp nhất → **migration rủi ro ~0** (đổi import, không đổi logic).
- **Alternatives rejected**: gộp về `sonner`/Radix toast — phải viết lại 30+ call site, rủi ro cao, vô ích.

## D4 — Lọc/phân trang danh sách bầu cử client-side (KHÔNG đụng BE)

- **Decision**: US5/FR-010 làm **client-side** (search + filter theo phase + sort + paginate + EmptyState) trong `CuocBauCuCuaNguoiDungPage.tsx`. **Không** sửa backend.
- **Bằng chứng**: `electionV1Api.ts:~414-426` `listElectionV1Groups()` → `GET /api/election-v1/election-groups` trả `{items:[...]}` toàn bộ; backend `ElectionV1Controller.ListElectionGroups()` không nhận tham số, store file-based O(10–100) bản ghi; trang đã lọc client-side sẵn (`CuocBauCuCuaNguoiDungPage.tsx:~43-53`).
- **Rationale**: Constitution III (YAGNI) + spec FR-014 "chỉ sửa BE khi UX bị chặn". Ở quy mô hiện tại UX **không** bị chặn → đổi BE là phức tạp thừa, mở rộng bề mặt, mâu thuẫn "atomic/surgical". Phân trang server-side ghi nhận là follow-up khi dữ liệu lớn.
- **Alternatives rejected**: thêm `?phase=&skip=&take=` vào controller — đụng BE ngoài nhu cầu, tăng rủi ro/bề mặt, không cần ở volume hiện tại.

## D5 — Khung & IA: breadcrumb/page-header suy ra từ routeMeta (không đổi cây route)

- **Decision**: Tạo `routes/routeMeta.ts` map path→`{title,breadcrumbTrail,section}`. `AppAfterLogin.tsx:44-51` bọc `<Outlet/>` bằng `PageHeader`+`Breadcrumb`. Sidebar (`Sidebar.tsx`) sắp xếp lại nhóm theo flow active, thêm focus-trap + đóng bằng Esc cho drawer (`Sidebar.tsx:184-206` hiện chỉ click-nền).
- **Bằng chứng**: Không có breadcrumb/page-header nào (`AppAfterLogin.tsx` render `<Outlet/>` trần). Cây route phẳng dưới `/app` (`AppRoutes.tsx:312-487`) → map tĩnh khả thi. Drawer mobile thiếu Esc/focus-trap (`Sidebar.tsx:173-206`).
- **Rationale**: Không đụng `AppRoutes.tsx` (giảm rủi ro điều hướng); IA là lớp trình bày suy diễn. A11y FR-002/FR-013.
- **Alternatives rejected**: nhúng breadcrumb thủ công từng trang — lặp lại, dễ lệch, mâu thuẫn "nhất quán".

## D6 — Lớp component xây trên Radix sẵn có

- **Decision**: `components/ui/clay/*` dùng Radix đã cài cho hành vi (DropdownButton←`@radix-ui/react-dropdown-menu`, Tabs←`react-tabs` Radix, Select←`@radix-ui/react-select`, modal←`@radix-ui/react-dialog`, ScrollArea←`@radix-ui/react-scroll-area`), style bằng class clay. DataTable/Stepper/Wizard/Pagination/SummaryRail/EmptyState/Skeleton tự dựng nhẹ (không lib mới).
- **Bằng chứng**: `package.json` đã có toàn bộ Radix cần thiết (dropdown-menu, tabs, select, dialog, popover, scroll-area, accordion). `framer-motion` có sẵn cho chuyển động drawer/wizard. `lucide-react` cho icon.
- **Rationale**: Tái dùng, 0 dependency mới (Principle III); hành vi a11y của Radix đạt FR-013.
- **Alternatives rejected**: thêm shadcn/MUI/Headless mới — vi phạm "không thêm lib UI mới".

## INV — Bất biến bảo mật KHÔNG ĐƯỢC SỬA (S4/S5, `QuanLySmartContractPage.tsx`)

Khi tái cấu trúc US4, các đoạn sau phải giữ **nguyên văn & nguyên thứ tự trong luồng**:

- **S4 — dẫn xuất khoá + mã hoá vote-secret** (`~207-227`): `voteEncMessage()`, `deriveVoteAesKey()` (ký `signMessage` → SHA-256 → AES-GCM key), `encryptVoteSecret()`, `decryptVoteSecret()`. localStorage chỉ lưu `{electionAddress,voter,candidateName,committedAt,iv,ciphertext}`.
- **S4 — vị trí mã hoá**: trong `handleCommitVote()` (`~630-644`) mã hoá & `saveStoredVoteEnvelope()` **SAU** khi commit on-chain thành công. Không được dời lên trước.
- **S5 — kiểm chủ sở hữu lúc nạp** (`loadStoredVoteEnvelope` `~236-239`): từ chối envelope nếu `electionAddress`/`voter` không khớp (so sánh `toLowerCase`).
- **S5 — kiểm trước reveal** (`handleRevealVote()` `~668-671`): `if (!envelope || envelope.voter.toLowerCase() !== address.toLowerCase()) throw …` **trước** decrypt/reveal. Không được bỏ/đổi thứ tự.

Tái cấu trúc chỉ được di chuyển JSX/bố cục, **không** tách các handler này khỏi điểm gọi, không đổi điều kiện so khớp, không log secret. Task US4 phải có bước verify đối chiếu 4 đoạn trên trước/sau.

## Quy mô & rủi ro

- Bề mặt: 5 trang + `Sidebar.tsx` + `AppAfterLogin.tsx` + `index.css` + lớp `ui/clay/` (~16 file mới) + `routeMeta.ts`. Không BE, không contract, không legacy.
- Rủi ro chính: hồi quy state/handler khi tái cấu trúc trang dài (1028–1340 dòng). Giảm thiểu: refactor "lift JSX, keep logic" — giữ nguyên tên/biến state & handler đã liệt kê trong `data-model.md`; verify bằng `quickstart.md` 5 luồng + `tsc --noEmit`.
