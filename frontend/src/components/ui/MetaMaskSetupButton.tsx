'use client';

import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';
import { useWeb3 } from '../../context/Web3Context';

interface MetaMaskSetupButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MetaMaskSetupButton: React.FC<MetaMaskSetupButtonProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const { currentAccount, isMetaMaskInstalled, isNetworkConnected, showSetupModal } = useWeb3();
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const getSetupProgress = () => {
    if (!isMetaMaskInstalled) return 0;
    if (!currentAccount) return 1;
    if (!isNetworkConnected) return 2;
    return 3;
  };

  const setupProgress = getSetupProgress();
  const isSetupComplete = setupProgress === 3;

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const variantClasses = {
    default: isSetupComplete
      ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
      : 'bg-gradient-to-r from-[#0288D1] to-[#0EA5E9] text-white hover:shadow-[0_0_15px_rgba(2,136,209,0.3)]',
    outline: isSetupComplete
      ? 'bg-transparent text-green-400 border border-green-500/30 hover:bg-green-500/10'
      : 'bg-transparent text-blue-400 border border-blue-500/30 hover:bg-blue-500/10',
    ghost: isSetupComplete
      ? 'bg-transparent text-green-400 hover:bg-green-500/10'
      : 'bg-transparent text-blue-400 hover:bg-blue-500/10',
    link: isSetupComplete
      ? 'bg-transparent text-green-400 hover:underline p-0'
      : 'bg-transparent text-blue-400 hover:underline p-0',
  };

  const handleClick = () => {
    if (isSetupComplete) {
      navigate('/blockchain-setup');
      return;
    }

    showSetupModal();
  };

  return (
    <button
      className={`relative flex items-center rounded-lg transition-all duration-300 ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isSetupComplete ? (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          <span>Ví Sepolia đã sẵn sàng</span>
        </>
      ) : (
        <>
          <FaEthereum className="mr-2 h-4 w-4" />
          <span>Thiết lập ví Sepolia</span>
          {setupProgress > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-xs">
              {setupProgress}/3
            </span>
          )}
        </>
      )}

      {isHovered && !isSetupComplete && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-[#334155] bg-[#1E293B] p-3 shadow-lg">
          <div className="mb-2 text-xs text-blue-200/80">Trạng thái thiết lập:</div>
          <div className="space-y-1.5">
            <StatusItem
              ok={isMetaMaskInstalled}
              label={isMetaMaskInstalled ? 'MetaMask đã cài đặt' : 'Cài đặt MetaMask'}
            />
            <StatusItem
              ok={Boolean(currentAccount)}
              label={currentAccount ? 'Ví đã kết nối' : 'Kết nối ví MetaMask'}
            />
            <StatusItem
              ok={isNetworkConnected}
              label={
                isNetworkConnected
                  ? 'Đã chuyển sang Ethereum Sepolia'
                  : 'Chuyển MetaMask sang Ethereum Sepolia'
              }
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#334155] pt-2">
            <span className="text-xs text-blue-300">Nhấn để thiết lập</span>
            <ExternalLink className="h-3 w-3 text-blue-300" />
          </div>
        </div>
      )}
    </button>
  );
};

const StatusItem: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => {
  return (
    <div className="flex items-center">
      <div className="mr-2 h-4 w-4 flex-shrink-0">
        {ok ? (
          <CheckCircle className="h-4 w-4 text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-400" />
        )}
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
};

export default MetaMaskSetupButton;
