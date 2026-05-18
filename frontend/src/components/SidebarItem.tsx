'use client';

import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isCollapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  icon,
  label,
  onClick,
  isCollapsed = false,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <li className="relative">
      <NavLink
        to={to}
        end={to === '/app'}
        aria-label={isCollapsed ? label : undefined}
        className={({ isActive }) => `
          relative flex min-h-11 items-center rounded-full px-2 py-2 transition-colors duration-150
          ${isCollapsed ? 'justify-center' : 'justify-start'}
          ${
            isActive
              ? 'bg-[var(--clay-bg)] text-black'
              : 'text-[var(--clay-muted)] hover:bg-[var(--clay-surface-soft)] hover:text-black'
          }
        `}
        onClick={onClick}
      >
        {({ isActive }) => (
          <>
            <span
              aria-hidden="true"
              className={`
                flex shrink-0 items-center justify-center rounded-full transition-colors duration-150
                ${isCollapsed ? 'h-11 w-11' : 'mr-3 h-9 w-9'}
                ${isActive ? 'bg-[var(--clay-primary-light)] text-[var(--clay-primary)]' : 'bg-transparent text-current'}
              `}
            >
              {React.cloneElement(icon as React.ReactElement, {
                className: 'h-4 w-4',
              })}
            </span>

            {!isCollapsed && (
              <span className={`text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>
                {label}
              </span>
            )}

            {isActive &&
              !isCollapsed &&
              (prefersReducedMotion ? (
                <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--clay-primary)]" />
              ) : (
                <motion.span
                  layoutId="activeSidebarIndicator"
                  className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--clay-primary)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16 }}
                />
              ))}
          </>
        )}
      </NavLink>
    </li>
  );
};

export default React.memo(SidebarItem);
