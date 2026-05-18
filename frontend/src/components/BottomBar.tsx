import type React from 'react';
import { BarChart, FileText, Settings, Cpu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface BottomBarProps {
  electionName: string;
  cuocBauCuId: number;
}

const BottomBar: React.FC<BottomBarProps> = ({ cuocBauCuId, electionName }) => {
  return (
    <div className="relative bottom-0 left-0 right-0 bg-[var(--clay-bg)] border-t border-[var(--clay-border)] h-16 sm:h-20">
      <div className="relative h-full flex items-center">
        <div className="absolute left-0 top-0 bottom-0 w-48 sm:w-56 overflow-hidden">
          <img src="/tai_xuong.jpg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20">
            <h2 className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-sm font-semibold truncate text-white">
              {electionName}
            </h2>
          </div>
        </div>
        <nav aria-label="Điều hướng cuộc bầu cử" className="flex-1 ml-48 sm:ml-56">
          <ul className="flex justify-around h-full">
            <BottomBarItem icon={BarChart} label="Tổng Quan" to="/app/user-elections" />
            <BottomBarItem
              icon={FileText}
              label="Thể Lệ"
              to={`/app/user-elections/elections/${cuocBauCuId}/rules`}
            />
            <BottomBarItem icon={Cpu} label="Blockchain" to="/app/quan-ly-smart-contract" />
            <BottomBarItem icon={Settings} label="Tạo phiên" to="/app/tao-phien-bau-cu" />
          </ul>
        </nav>
      </div>
    </div>
  );
};

interface BottomBarItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
}

const BottomBarItem = ({ icon: Icon, label, to }: BottomBarItemProps) => {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            'flex flex-col items-center justify-center h-full p-1 transition-colors',
            isActive
              ? 'text-[var(--clay-blueberry)]'
              : 'text-[var(--clay-text)]/60 hover:text-[var(--clay-blueberry)]',
          )
        }
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs mt-1">{label}</span>
      </NavLink>
    </li>
  );
};

export default BottomBar;
