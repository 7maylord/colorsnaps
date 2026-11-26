import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { zamaSepolia } from './chains'
import { SEPOLIA_CONTRACTS } from '@/contracts'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID?.trim()

export const walletConfigured = Boolean(projectId && !/your_|placeholder|^0+$|^demo$/i.test(projectId))

export const networks = [zamaSepolia] as [AppKitNetwork, ...AppKitNetwork[]]

// Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId: projectId || 'unconfigured',
  networks
})

export const config = wagmiAdapter.wagmiConfig

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  ZAMA_SEPOLIA: SEPOLIA_CONTRACTS.game,
  ZAMA_CHALLENGE_SEPOLIA: SEPOLIA_CONTRACTS.challenge,
  ZAMA_DAILY_SEPOLIA: SEPOLIA_CONTRACTS.daily,
  ZAMA_TEST_TOKEN_SEPOLIA: SEPOLIA_CONTRACTS.testToken,
  ZAMA_DUEL_ESCROW_SEPOLIA: SEPOLIA_CONTRACTS.duelEscrow,
  ZAMA_DUEL_SEPOLIA: SEPOLIA_CONTRACTS.duel,
  BASE: process.env.NEXT_PUBLIC_BASE_CONTRACT_ADDRESS,
  BASE_SEPOLIA: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS,
  SOMNIA: process.env.NEXT_PUBLIC_SOMNIA_CONTRACT_ADDRESS,
  ELECTRONEUM: process.env.NEXT_PUBLIC_ETN_CONTRACT_ADDRESS
}
