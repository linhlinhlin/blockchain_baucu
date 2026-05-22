# Remediation Backlog — Index

Nguồn: `AUDIT_2026-05-18.md`. Quy trình: Spec-Kit (`.specify/`). Mỗi đợt = 1 spec atomic.

| Đợt | Spec dir | Issues | Trạng thái | Mục tiêu |
|---|---|---|---|---|
| **1 — Bảo mật khẩn (Critical)** | `.specify/specs/001-security-remediation-critical/` | S1 S2 S3 S4 S5 | ✅ Scaffolded (spec+plan+tasks), chờ team duyệt → `/speckit-implement` | Chặn lộ key / forge phiếu / forge JWT |
| **2 — Bảo mật cao (High)** | `002-security-remediation-high` *(chưa tạo)* | S6 S7 S8 S9 S10 S13 | ⏳ Chờ scope | Brute-force OTP, định danh yếu, XSS, finalize không quorum, CORS, bind authz |
| **3 — Dọn legacy** | `003-legacy-cleanup` *(chưa tạo)* | S11 + xóa `src/test/**`, `ContractABIs.tsx`, `utils/blockchain.ts`, `ThamGiaBauCuPage`, deps chết; tắt `LegacyBlockchainSettings.Enabled` | ⏳ Chờ scope | Giảm bề mặt tấn công & bundle, hết cần `--legacy-peer-deps` |
| **4 — Hạ tầng** | `004-infra-hardening` *(chưa tạo)* | S15 S16 S17 S19 S20 + healthcheck, Anvil profile, .env template | ⏳ Chờ scope | One-command bring-up, CI tin cậy |
| **5 — Migration** | `005-data-migration` *(chưa tạo)* | S12 + MinIO/IObjectStorage + EF migrations ElectionV1Store | ⏳ Chờ scope | Cloud-agnostic theo roadmap |

## Cách team claim việc

1. Đọc `docs/audit/AUDIT_2026-05-18.md` (§2 bảng issue, §5 thứ tự).
2. Đợt 1 đã có `spec.md`/`plan.md`/`tasks.md` — chia theo User Story (US1–US4), mỗi US độc lập, có owner.
3. Đợt 2–5: tạo spec mới qua `/speckit-specify` khi team chốt scope đợt đó (giữ atomic, ≤5 trang, tham chiếu mã `S#`).
4. Mọi spec/plan/tasks phải tuân `.specify/memory/constitution.md` (Principle I là blocker).

## Nguyên tắc thứ tự (Constitution III, IV)

- Critical trước (Đợt 1) — không phát hành khi còn Critical mở.
- Dọn legacy (Đợt 3) nên làm sớm song song vì giảm bề mặt cho các đợt sau.
- Migration (Đợt 5) sau khi active path đã sạch & an toàn.
