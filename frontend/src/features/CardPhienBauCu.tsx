import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Trash2, UsersRound } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Button } from '../components/ui/Button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/AlterDialog';
import type { AppDispatch } from '../store/store';
import type { PhienBauCu } from '../store/types';
import { removePhienBauCu } from '../store/slice/phienBauCuSlice';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parseVietnameseDate(value: Date | string) {
  if (value instanceof Date) {
    return value;
  }

  if (value.includes('/')) {
    const [datePart, timePart = '00:00'] = value.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0);
  }

  return new Date(value);
}

function formatDate(value: Date | string) {
  const date = parseVietnameseDate(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời gian' : dateFormatter.format(date);
}

function getStatusStyles(status?: string) {
  switch (status) {
    case 'Sắp diễn ra':
      return 'border-[var(--clay-border)] bg-[var(--clay-surface-soft)] text-black';
    case 'Đang diễn ra':
      return 'border-[rgba(0,102,204,0.24)] bg-[var(--clay-primary-light)] text-[var(--clay-primary)]';
    case 'Đã kết thúc':
      return 'border-[var(--clay-border)] bg-[rgba(255,255,255,0.78)] text-[var(--clay-muted)]';
    default:
      return 'border-[rgba(0,102,204,0.24)] bg-[var(--clay-primary-light)] text-[var(--clay-primary)]';
  }
}

export default function CardPhienBauCu({ session }: { session: PhienBauCu }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const progress = Math.max(0, Math.min(100, Math.round(session.tienTrinhPhienBau ?? 0)));
  const status = session.trangThai || 'Chưa xác định';

  const handleDelete = async () => {
    await dispatch(removePhienBauCu(session.id));
    setIsDialogOpen(false);
  };

  const handleManage = () => {
    navigate(`${location.pathname}/${session.id}/phien-bau-cu`);
  };

  return (
    <article className="ux-action-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate text-xl font-extrabold tracking-[-0.035em] text-black">
              {session.tenPhienBauCu}
            </h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyles(status)}`}>
              {status}
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--clay-muted)]">
            {session.moTa || 'Chưa có mô tả cho phiên bầu cử này.'}
          </p>

          <dl className="mt-4 grid gap-3 text-sm text-[var(--clay-muted)] sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--clay-border)] bg-white px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--clay-blueberry)]" />
              <div className="min-w-0">
                <dt className="clay-label text-[10px]">Bắt đầu</dt>
                <dd className="truncate font-medium text-black">{formatDate(session.ngayBatDau)}</dd>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--clay-border)] bg-white px-3 py-2">
              <Clock3 className="h-4 w-4 shrink-0 text-[var(--clay-blueberry)]" />
              <div className="min-w-0">
                <dt className="clay-label text-[10px]">Kết thúc</dt>
                <dd className="truncate font-medium text-black">{formatDate(session.ngayKetThuc)}</dd>
              </div>
            </div>
          </dl>

          {status === 'Đang diễn ra' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--clay-muted)]">
                <span>Tiến độ phiên</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--clay-border-light)]">
                <div
                  className="h-full rounded-full bg-[var(--clay-blueberry)] transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button type="button" onClick={handleManage} className="rounded-full bg-[var(--clay-blueberry)] text-white hover:bg-[var(--clay-blueberry)]/90">
            <UsersRound className="h-4 w-4" />
            Quản lý phiên
          </Button>
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="rounded-full border-[rgba(252,121,129,0.35)] text-[var(--clay-pomegranate)]">
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa phiên bầu cử?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động này không thể hoàn tác. Chỉ xóa khi bạn chắc chắn phiên này chưa cần
                  dùng cho kiểm chứng hoặc báo cáo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Giữ lại</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Xóa phiên</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </article>
  );
}
