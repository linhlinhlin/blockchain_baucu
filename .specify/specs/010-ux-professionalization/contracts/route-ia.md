# Contract — Route IA (`routes/routeMeta.ts`)

Bảng tĩnh suy ra title/breadcrumb/section cho khung shell. **Không** đổi cây route trong `AppRoutes.tsx` — chỉ tra cứu theo `location.pathname`.

```ts
type Section = 'Bầu cử' | 'Cử tri' | 'Khác';
type RouteMeta = { title: string; section: Section; breadcrumb: { label:string; to?:string }[] };

// Khoá theo pathname chuẩn hoá (bỏ trailing slash). Trang chủ shell = /app.
const ROUTE_META: Record<string, RouteMeta> = {
  '/app':                       { title:'Trang chủ',        section:'Bầu cử', breadcrumb:[{label:'Trang chủ'}] },
  '/app/quan-ly-smart-contract':{ title:'Bảng điều khiển',  section:'Bầu cử', breadcrumb:[{label:'Trang chủ',to:'/app'},{label:'Bầu cử'},{label:'Bảng điều khiển'}] },
  '/app/tao-phien-bau-cu':      { title:'Tạo bầu cử',        section:'Bầu cử', breadcrumb:[{label:'Trang chủ',to:'/app'},{label:'Bầu cử'},{label:'Tạo bầu cử'}] },
  '/app/user-elections':        { title:'Danh sách bầu cử',  section:'Bầu cử', breadcrumb:[{label:'Trang chủ',to:'/app'},{label:'Bầu cử'},{label:'Danh sách bầu cử'}] },
  '/app/quet-ma-qr':            { title:'Quét mã QR',        section:'Cử tri', breadcrumb:[{label:'Trang chủ',to:'/app'},{label:'Cử tri'},{label:'Quét mã QR'}] },
  '/verify-voter':              { title:'Xác minh cử tri',   section:'Cử tri', breadcrumb:[{label:'Xác minh cử tri'}] }, // ngoài shell /app
};

function resolveRouteMeta(pathname: string): RouteMeta
// - Chuẩn hoá bỏ '/' cuối; nếu khớp chính xác → trả meta.
// - Nếu không khớp (route động/redirect) → fallback { title suy từ segment cuối, section:'Khác', breadcrumb tối thiểu }.
// - KHÔNG ném lỗi: route không khai báo vẫn render shell bình thường.
```

## Ràng buộc
- `/verify-voter` chạy ngoài `AppAfterLogin` (route gốc, không sidebar) → PageHeader/Breadcrumb dùng biến thể không-shell (chỉ tiêu đề + tiến độ Wizard), không vẽ breadcrumb `/app`.
- Bảng phải phủ tối thiểu 5 trang active + `/app`. Route legacy/redirect (`AppRoutes.tsx:331-485`) không cần khai báo (fallback).
- Thay đổi nhãn ở đây là **nguồn sự thật** cho cả Sidebar (đồng bộ thuật ngữ "bầu cử").
