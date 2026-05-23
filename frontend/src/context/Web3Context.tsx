'use client';

import type React from 'react';
import { BrowserProvider } from 'ethers';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { AlertCircle, CheckCircle, Network } from 'lucide-react';

const SEPOLIA_CHAIN_ID = '0xaa36a7';
const SEPOLIA_NETWORK = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Ethereum Sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'SepoliaETH',
    decimals: 18,
  },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

interface WalletConnectOptions {
  forceSelection?: boolean;
}

interface Web3ContextType {
  currentAccount: string | null;
  chainId: string | null;
  isConnecting: boolean;
  isMetaMaskInstalled: boolean;
  isNetworkConnected: boolean;
  isTokenAdded: boolean;
  connectWallet: (options?: WalletConnectOptions) => Promise<string | null>;
  disconnectWallet: () => void;
  signMessage: (message: string) => Promise<string | null>;
  addTokenToMetaMask: () => Promise<boolean>;
  addHoLiHuNetwork: () => Promise<boolean>;
  checkAndSwitchNetwork: () => Promise<boolean>;
  checkAndAddToken: () => Promise<boolean>;
  ensureNetworkAndToken: () => Promise<boolean>;
  showSetupModal: () => void;
  setupEnvironment: () => Promise<boolean>;
}

const Web3Context = createContext<Web3ContextType>({
  currentAccount: null,
  chainId: null,
  isConnecting: false,
  isMetaMaskInstalled: false,
  isNetworkConnected: false,
  isTokenAdded: false,
  connectWallet: async () => null,
  disconnectWallet: () => {},
  signMessage: async () => null,
  addTokenToMetaMask: async () => false,
  addHoLiHuNetwork: async () => false,
  checkAndSwitchNetwork: async () => false,
  checkAndAddToken: async () => false,
  ensureNetworkAndToken: async () => false,
  showSetupModal: () => {},
  setupEnvironment: async () => false,
});

export const useWeb3 = () => useContext(Web3Context);

interface Web3ProviderProps {
  children: ReactNode;
}

const getEthereumProvider = (): EthereumProvider | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
};

const getFirstAccount = (accounts: unknown): string | null =>
  Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0]) : null;

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const ethereum = useMemo(() => getEthereumProvider(), []);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [isNetworkConnected, setIsNetworkConnected] = useState(false);
  const [isTokenAdded, setIsTokenAdded] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  const syncNetworkState = useCallback(async (): Promise<boolean> => {
    if (!ethereum) {
      setChainId(null);
      setIsNetworkConnected(false);
      setIsTokenAdded(false);
      return false;
    }

    try {
      const nextChainId = await ethereum.request({ method: 'eth_chainId' });
      const isSepolia = String(nextChainId).toLowerCase() === SEPOLIA_CHAIN_ID;

      setChainId(nextChainId);
      setIsNetworkConnected(isSepolia);
      setIsTokenAdded(isSepolia);

      return isSepolia;
    } catch (error) {
      console.error('Không thể đọc chainId từ MetaMask:', error);
      setChainId(null);
      setIsNetworkConnected(false);
      setIsTokenAdded(false);
      return false;
    }
  }, [ethereum]);

  const syncAccounts = useCallback(async (): Promise<string | null> => {
    if (!ethereum) {
      setCurrentAccount(null);
      return null;
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      const nextAccount = getFirstAccount(accounts);
      setCurrentAccount(nextAccount);
      return nextAccount;
    } catch (error) {
      console.error('Không thể đọc danh sách ví MetaMask:', error);
      setCurrentAccount(null);
      return null;
    }
  }, [ethereum]);

  useEffect(() => {
    setIsMetaMaskInstalled(Boolean(ethereum?.isMetaMask));

    if (!ethereum) {
      return;
    }

    void syncNetworkState();
    void syncAccounts();

    const handleAccountsChanged = (accounts: string[]) => {
      setCurrentAccount(getFirstAccount(accounts));
    };

    const handleChainChanged = (nextChainId: string) => {
      setChainId(nextChainId);
      const isSepolia = String(nextChainId).toLowerCase() === SEPOLIA_CHAIN_ID;
      setIsNetworkConnected(isSepolia);
      setIsTokenAdded(isSepolia);
    };

    ethereum.on?.('accountsChanged', handleAccountsChanged);
    ethereum.on?.('chainChanged', handleChainChanged);

    const syncFromMetaMask = () => {
      void syncAccounts();
      void syncNetworkState();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncFromMetaMask();
      }
    };

    window.addEventListener('focus', syncFromMetaMask);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      ethereum.removeListener?.('chainChanged', handleChainChanged);
      window.removeEventListener('focus', syncFromMetaMask);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ethereum, syncAccounts, syncNetworkState]);

  const addHoLiHuNetwork = useCallback(async (): Promise<boolean> => {
    if (!ethereum) {
      toast.error('MetaMask chưa được cài đặt.');
      return false;
    }

    try {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [SEPOLIA_NETWORK],
      });

      await syncNetworkState();
      toast.success('Đã thêm mạng Ethereum Sepolia vào MetaMask.');
      return true;
    } catch (error) {
      console.error('Không thể thêm mạng Sepolia vào MetaMask:', error);
      toast.error('Không thể thêm mạng Ethereum Sepolia.');
      return false;
    }
  }, [ethereum, syncNetworkState]);

  const checkAndSwitchNetwork = useCallback(async (): Promise<boolean> => {
    if (!ethereum) {
      toast.error('MetaMask chưa được cài đặt.');
      return false;
    }

    try {
      const currentChain = await ethereum.request({ method: 'eth_chainId' });
      if (String(currentChain).toLowerCase() === SEPOLIA_CHAIN_ID) {
        setChainId(currentChain);
        setIsNetworkConnected(true);
        setIsTokenAdded(true);
        return true;
      }

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });

      await syncNetworkState();
      toast.success('Đã chuyển sang mạng Ethereum Sepolia.');
      return true;
    } catch (error: any) {
      if (error?.code === 4902) {
        return addHoLiHuNetwork();
      }

      console.error('Không thể chuyển sang Sepolia:', error);
      toast.error('Không thể chuyển sang mạng Ethereum Sepolia.');
      return false;
    }
  }, [addHoLiHuNetwork, ethereum, syncNetworkState]);

  const addTokenToMetaMask = useCallback(async (): Promise<boolean> => {
    setIsTokenAdded(true);
    toast.success('Luồng mới không còn yêu cầu thêm token HLU. Chỉ cần ví MetaMask trên Sepolia.');
    return true;
  }, []);

  const checkAndAddToken = useCallback(async (): Promise<boolean> => {
    setIsTokenAdded(true);
    return true;
  }, []);

  const ensureNetworkAndToken = useCallback(async (): Promise<boolean> => {
    const networkReady = await checkAndSwitchNetwork();
    if (!networkReady) {
      return false;
    }

    return checkAndAddToken();
  }, [checkAndAddToken, checkAndSwitchNetwork]);

  const connectWallet = useCallback(async (options: WalletConnectOptions = {}): Promise<string | null> => {
    if (!ethereum) {
      toast.error('MetaMask chưa được cài đặt.');
      return null;
    }

    setIsConnecting(true);
    try {
      if (options.forceSelection) {
        try {
          await ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (permissionError: any) {
          if (permissionError?.code === 4001) {
            throw permissionError;
          }
        }
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const selectedAccount = getFirstAccount(accounts);

      setCurrentAccount(selectedAccount);

      if (selectedAccount) {
        await ensureNetworkAndToken();
      }

      return selectedAccount;
    } catch (error) {
      console.error('Không thể kết nối MetaMask:', error);
      toast.error('Không thể kết nối ví MetaMask.');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [ensureNetworkAndToken, ethereum]);

  const disconnectWallet = useCallback(() => {
    setCurrentAccount(null);
    setChainId(null);
    setIsNetworkConnected(false);
    setIsTokenAdded(false);
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<string | null> => {
      if (!ethereum) {
        toast.error('MetaMask chưa được cài đặt.');
        return null;
      }

      try {
        const account = (await syncAccounts()) ?? (await connectWallet());
        if (!account) {
          return null;
        }

        const networkReady = await ensureNetworkAndToken();
        if (!networkReady) {
          return null;
        }

        const provider = new BrowserProvider(ethereum as any);
        const signer = await provider.getSigner(account);
        return await signer.signMessage(message);
      } catch (error) {
        console.error('Không thể ký thông điệp bằng MetaMask:', error);
        toast.error('Không thể ký thông điệp bằng MetaMask.');
        return null;
      }
    },
    [connectWallet, ensureNetworkAndToken, ethereum, syncAccounts],
  );

  const setupEnvironment = useCallback(async (): Promise<boolean> => {
    if (!ethereum) {
      window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer');
      return false;
    }

    const account = (await syncAccounts()) ?? (await connectWallet());
    if (!account) {
      return false;
    }

    return ensureNetworkAndToken();
  }, [connectWallet, ensureNetworkAndToken, ethereum, syncAccounts]);

  const contextValue = useMemo<Web3ContextType>(
    () => ({
      currentAccount,
      chainId,
      isConnecting,
      isMetaMaskInstalled,
      isNetworkConnected,
      isTokenAdded,
      connectWallet,
      disconnectWallet,
      signMessage,
      addTokenToMetaMask,
      addHoLiHuNetwork,
      checkAndSwitchNetwork,
      checkAndAddToken,
      ensureNetworkAndToken,
      showSetupModal: () => setShowSetupDialog(true),
      setupEnvironment,
    }),
    [
      addHoLiHuNetwork,
      addTokenToMetaMask,
      chainId,
      checkAndAddToken,
      checkAndSwitchNetwork,
      connectWallet,
      currentAccount,
      disconnectWallet,
      ensureNetworkAndToken,
      isConnecting,
      isMetaMaskInstalled,
      isNetworkConnected,
      isTokenAdded,
      setupEnvironment,
      signMessage,
    ],
  );

  return (
    <Web3Context.Provider value={contextValue}>
      {children}

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thiết lập ví cho Sepolia</DialogTitle>
            <DialogDescription>
              Luồng mới chỉ cần MetaMask và mạng Ethereum Sepolia. Token HLU và chain HoLiHu cũ
              không còn cần cho đăng nhập hoặc thao tác với ElectionV1.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              {isMetaMaskInstalled ? (
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
              )}
              <div>
                <div className="font-medium">MetaMask</div>
                <div>{isMetaMaskInstalled ? 'Đã phát hiện MetaMask.' : 'Cần cài MetaMask.'}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              {isNetworkConnected ? (
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-500" />
              ) : (
                <Network className="mt-0.5 h-5 w-5 text-blue-500" />
              )}
              <div>
                <div className="font-medium">Mạng Ethereum Sepolia</div>
                <div>
                  {isNetworkConnected
                    ? 'Ví hiện đã ở Sepolia và sẵn sàng dùng ElectionV1.'
                    : 'Cần chuyển ví sang mạng Ethereum Sepolia.'}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Đóng
            </Button>
            <Button
              onClick={async () => {
                const ok = await setupEnvironment();
                if (ok) {
                  setShowSetupDialog(false);
                }
              }}
            >
              Thiết lập ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Web3Context.Provider>
  );
};
