import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { getElectionV1PublicConfig, type ElectionV1PublicConfig } from '../api/electionV1Api';

const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

type SepoliaWalletSummaryState = {
  publicConfig: ElectionV1PublicConfig | null;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: SepoliaWalletSummaryState = {
  publicConfig: null,
  balance: null,
  isLoading: false,
  error: null,
};

function getErrorMessage(error: unknown) {
  const maybeError = error as { message?: string };
  return maybeError?.message ?? 'Không thể tải thông tin ví Sepolia.';
}

export function useSepoliaWalletSummary(walletAddress?: string | null) {
  const [state, setState] = useState<SepoliaWalletSummaryState>(initialState);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!walletAddress) {
        setState((current) => ({
          ...current,
          balance: null,
          error: null,
          isLoading: false,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));

      try {
        const publicConfig = await getElectionV1PublicConfig();
        const provider = new ethers.JsonRpcProvider(publicConfig.rpcUrl ?? DEFAULT_RPC_URL);
        const balance = await provider.getBalance(walletAddress);

        if (cancelled) {
          return;
        }

        setState({
          publicConfig,
          balance: ethers.formatEther(balance),
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: getErrorMessage(error),
        }));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, refreshToken]);

  return {
    ...state,
    refresh: () => setRefreshToken((current) => current + 1),
  };
}
