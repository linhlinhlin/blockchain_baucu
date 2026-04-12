'use client';

import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import BlockchainNodes from '../components/ui/blockchain-nodes';
import HexagonBackground from '../components/ui/hexagon-background';
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0A0F18] via-[#121A29] to-[#0D1321] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <HexagonBackground density={10} opacity={0.05} />
        <BlockchainNodes nodeCount={10} />
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-blue-500 opacity-10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-500 opacity-10 blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            to="/main"
            className="inline-flex items-center text-blue-300 transition-colors duration-200 hover:text-blue-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Quay lại trang chính</span>
          </Link>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex rounded-full border border-blue-500/20 bg-slate-900/50 p-4 backdrop-blur-sm">
              <Layers className="h-8 w-8 text-blue-400" />
            </div>
            <h1 className="mb-4 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Thiết lập ví Sepolia
            </h1>
            <p className="mx-auto max-w-2xl text-blue-100/80">
              Hệ thống hiện tại đã bỏ phụ thuộc vào HoLiHu chain và HLU token ở active path. Để
              đăng nhập ví và thao tác với ElectionV1, anh chỉ cần MetaMask và mạng Ethereum
              Sepolia.
            </p>
          </div>

          <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-blue-300/70">
                  Setup Progress
                </div>
                <div className="mt-1 text-2xl font-semibold">{readyCount}/3 bước hoàn tất</div>
              </div>
              <button
                onClick={handleSetupAll}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Thiết lập tự động
              </button>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
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

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6"
          >
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="text-lg font-semibold text-emerald-200">Điểm thay đổi quan trọng</h2>
                <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
                  <li>Không còn yêu cầu thêm token HLU vào MetaMask.</li>
                  <li>Không còn yêu cầu chain HoLiHu `210` ở active path.</li>
                  <li>Đăng nhập ví và ElectionV1 đều bám Ethereum Sepolia.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/main')}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-blue-400 hover:text-blue-200"
            >
              Quay lại dashboard
            </button>
            <a
              href="https://sepolia.etherscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-blue-500/30 px-5 py-3 text-sm font-medium text-blue-200 transition hover:bg-blue-500/10"
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
    <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-4 inline-flex rounded-2xl border border-slate-800 bg-slate-900 p-3 text-blue-300">
        {icon}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {status === 'done' && <CheckCircle className="h-5 w-5 text-emerald-400" />}
      </div>
      <p className="min-h-[60px] text-sm leading-6 text-slate-300">{description}</p>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium transition ${
          disabled
            ? 'cursor-not-allowed bg-slate-800 text-slate-400'
            : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
};

export default BlockchainSetupPage;
