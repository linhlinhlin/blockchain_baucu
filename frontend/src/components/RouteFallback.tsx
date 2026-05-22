// Đợt 13.2: Suspense fallback dùng chung (3 nơi: AppRoutes/AppBeforeLogin/
// AppAfterLogin) — đảm bảo có boundary NGAY TRÊN Outlet bắt suspend lazy
// route, hết lỗi React "A component suspended while responding to synchronous
// input" (xảy ra dù bật v7_startTransition vì boundary cách Outlet quá xa).
export function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--clay-muted)',
        fontSize: 14,
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          width: 22,
          height: 22,
          border: '3px solid currentColor',
          borderRightColor: 'transparent',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }}
        aria-hidden="true"
      />
      <span style={{ marginLeft: 10 }}>Đang tải…</span>
    </div>
  );
}

export default RouteFallback;
