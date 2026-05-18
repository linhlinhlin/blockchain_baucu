'use client';

import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Layers,
  Network,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';
import { useWeb3 } from '../context/Web3Context';

const BlockchainSetupPage: React.FC = () => {
  const {
    currentAccount,
    isConnecting,
    isMetaMaskInstalled,
    isNetworkConnected,
    connectWallet,
    checkAndSwitchNetwork,
    setupEnvironment,
  } = useWeb3();
  const navigate = useNavigate();

  const readyCount = [isMetaMaskInstalled, Boolean(currentAccount), isNetworkConnected].filter(Boolean)
    .length;

  const handleConnectWallet = async () => {
    const account = await connectWallet();
    if (account) {
      toast.success('Đã kết nối ví MetaMask.');
    }
  };

  const handleSwitchNetwork = async () => {
    const ok = await checkAndSwitchNetwork();
    if (ok) {
      toast.success('Ví đã sẵn sàng trên Ethereum Sepolia.');
    }
  };

  const handleSetupAll = async () => {
    const ok = await setupEnvironment();
    if (ok) {
      toast.success('Môi trường ví Sepolia đã sẵn sàng.');
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            to="/app"
            className="inline-flex items-center text-[#0288D1] hover:text-blue-700 transition-colors duration-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Quay lại trang chính</span>
          </Link>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex rounded-full border border-blue-100 bg-blue-50 p-4">
              <Layers className="h-8 w-8 text-blue-400" />
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Thiết lập ví Sepolia
            </h1>
            <p className="mx-auto max-w-2xl text-gray-600">
              Hệ thống hiện tại đã bỏ phụ thuộc vào HoLiHu chain và HLU token ở active path. Để
              đăng nhập ví và thao tác với ElectionV1, anh chỉ cần MetaMask và mạng Ethereum
              Sepolia.
            </p>
          </div>

          <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-gray-500">
                  Setup Progress
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{readyCount}/3 bước hoàn tất</div>
              </div>
              <button
                onClick={handleSetupAll}
                className="rounded-xl bg-[#0288D1] px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Thiết lập tự động
              </button>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-[#0288D1] transition-all duration-500"
                style={{ width: `${(readyCount / 3) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <SetupCard
              icon={<FaEthereum className="h-5 w-5" />}
              title="MetaMask"
              description="Cài MetaMask để ký nonce và thao tác on-chain."
              status={isMetaMaskInstalled ? 'done' : 'pending'}
              actionLabel={isMetaMaskInstalled ? 'Đã cài đặt' : 'Tải MetaMask'}
              onAction={() =>
                window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer')
              }
              disabled={isMetaMaskInstalled}
            />

            <SetupCard
              icon={<Wallet className="h-5 w-5" />}
              title="Kết nối ví"
              description={
                currentAccount
                  ? `Ví hiện tại: ${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`
                  : 'Kết nối ví để đăng nhập bằng chữ ký.'
              }
              status={currentAccount ? 'done' : 'pending'}
              actionLabel={currentAccount ? 'Đã kết nối' : isConnecting ? 'Đang kết nối...' : 'Kết nối ví'}
              onAction={handleConnectWallet}
              disabled={Boolean(currentAccount) || isConnecting}
            />

            <SetupCard
              icon={<Network className="h-5 w-5" />}
              title="Ethereum Sepolia"
              description="Luồng mới chỉ chạy trên Sepolia cho đến khi chuyển sang private staging."
              status={isNetworkConnected ? 'done' : 'pending'}
              actionLabel={isNetworkConnected ? 'Đã sẵn sàng' : 'Chuyển sang Sepolia'}
              onAction={handleSwitchNetwork}
              disabled={isNetworkConnected}
            />
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 text-emerald-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Điểm thay đổi quan trọng</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  <li>Không còn yêu cầu thêm token HLU vào MetaMask.</li>
                  <li>Không còn yêu cầu chain HoLiHu `210` ở active path.</li>
                  <li>Đăng nhập ví và ElectionV1 đều bám Ethereum Sepolia.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/app')}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-[#0288D1] hover:text-[#0288D1]"
            >
              Quay lại dashboard
            </button>
            <a
              href="https://sepolia.etherscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-blue-200 px-5 py-3 text-sm font-medium text-[#0288D1] transition hover:bg-blue-50"
            >
              Mở Sepolia Etherscan
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SetupCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'done' | 'pending';
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

const SetupCard: React.FC<SetupCardProps> = ({
  icon,
  title,
  description,
  status,
  actionLabel,
  onAction,
  disabled = false,
}) => {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[#0288D1]">
        {icon}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {status === 'done' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
      </div>
      <p className="min-h-[60px] text-sm leading-6 text-gray-600">{description}</p>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium transition ${
          disabled
            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
            : 'bg-[#0288D1] text-white hover:bg-blue-700'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
};

export default BlockchainSetupPage;
