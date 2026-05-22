# ADR 0001 — Object Storage Abstraction (Azure Blob → IObjectStorage → MinIO)

- **Trạng thái**: Accepted (thiết kế) — triển khai swap = follow-up có kiểm thử tích hợp
- **Ngày**: 2026-05-19 · **Spec**: `.specify/specs/005-data-migration/` · **Liên quan**: roadmap "Thay" §3, audit infra (MinIO)

## Bối cảnh

`SYSTEM_MODERNIZATION_REVIEW` đặt mục tiêu thay `Azure Blob` hardcoded bằng interface `IObjectStorage` + triển khai mặc định `MinIO/S3-compatible` (cloud-agnostic). Hiện backend bind trực tiếp `IAzureBlobService`/`PinataService` trong nhiều controller web2 **active** + service legacy (coupling cao, giống vấn đề legacy DI gating ở Đợt 3). Active path ElectionV1 **không dùng** object storage.

## Quyết định

Định nghĩa seam `IObjectStorage` rồi **migrate dần**, KHÔNG swap một lần (rủi ro vỡ web2 đang chạy — Constitution I/IV). Đợt 5 chốt thiết kế; thực thi theo các bước kiểm thử được.

### Interface đề xuất

```csharp
public interface IObjectStorage
{
    Task<string> PutAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task<Stream> GetAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
    Uri GetPublicUrl(string key);
}
```

### Lộ trình (từng bước verify được)

1. **Thêm `IObjectStorage`** + adapter `AzureBlobObjectStorage` bọc `AzureBlobService` hiện có (0 thay đổi hành vi). Đăng ký `IObjectStorage` → adapter.
2. **Refactor từng consumer** (FileService/controller upload) sang `IObjectStorage` — mỗi consumer 1 PR nhỏ + test upload/download.
3. **Thêm `MinioObjectStorage`** (AWS SDK S3-compatible, endpoint MinIO) sau `IObjectStorage`; chọn impl qua config `ObjectStorage:Provider` (azure|minio), default azure.
4. **Thêm service `minio`** vào `docker-compose.active.yml` (profile `object-storage`), env-driven bucket/keys.
5. Khi mọi consumer đã qua `IObjectStorage` và MinIO test xong → đổi default sang minio cho stack Docker; Azure thành tuỳ chọn.

## Vì sao chưa code swap ở Đợt 5

- Consumer object storage là web2/legacy coupling cao; swap toàn bộ không kiểm thử (không có MinIO/Azure thật ở môi trường này) **rủi ro hơn giá trị** cho hệ bầu cử (Constitution I).
- Active path (ElectionV1 — trọng tâm bảo mật) không phụ thuộc object storage ⇒ không chặn mục tiêu chính.
- Ghi nhận trung thực: đây là refactor hạ tầng dữ liệu thuộc "Giai đoạn 5" roadmap, cần môi trường tích hợp để verify từng bước.

## Hệ quả

- Có thiết kế rõ + lộ trình PR-nhỏ để team thực thi an toàn.
- Không tạo interface treo (anti-pattern) — chỉ chốt ADR; code đi kèm consumer thật ở các PR follow-up.
- Cloud-agnostic đạt được tăng dần, không big-bang.
