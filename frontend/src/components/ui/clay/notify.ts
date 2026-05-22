// Đợt 10 (spec 010) — FR-005: MỘT hệ thông báo duy nhất cho active path.
// Bọc react-hot-toast (provider <Toaster> đã mount ở AppAfterLogin.tsx:37).
// KHÔNG mount provider mới. KHÔNG import sweetalert2/sonner/react-toastify ở active path.
// Mọi trang active gọi notify.* thay vì toast.* trực tiếp để đồng nhất vị trí/kiểu/thời lượng.
import toast, { type ToastOptions } from 'react-hot-toast';

const BASE: ToastOptions = {
  position: 'top-right',
  duration: 4000,
  style: {
    borderRadius: '12px',
    border: '1px solid var(--clay-border)',
    background: 'var(--clay-surface)',
    color: 'var(--clay-text)',
    fontSize: '0.9rem',
    boxShadow: 'none',
    maxWidth: '420px',
  },
};

export const notify = {
  success(message: string, opts?: ToastOptions) {
    return toast.success(message, {
      ...BASE,
      iconTheme: { primary: 'var(--state-success)', secondary: '#ffffff' },
      ...opts,
    });
  },
  error(message: string, opts?: ToastOptions) {
    return toast.error(message, {
      ...BASE,
      duration: 6000,
      iconTheme: { primary: 'var(--state-danger)', secondary: '#ffffff' },
      ...opts,
    });
  },
  info(message: string, opts?: ToastOptions) {
    return toast(message, { ...BASE, ...opts });
  },
  loading(message: string, opts?: ToastOptions) {
    return toast.loading(message, { ...BASE, ...opts });
  },
  dismiss(id?: string) {
    toast.dismiss(id);
  },
  promise<T>(
    p: Promise<T>,
    msgs: { loading: string; success: string; error: string },
    opts?: ToastOptions,
  ) {
    return toast.promise(p, msgs, { ...BASE, ...opts });
  },
};

export default notify;
