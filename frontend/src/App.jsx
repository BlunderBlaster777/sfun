import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { MarketFactory, PredictionMarket } from "./abis";

const RPC = import.meta.env.VITE_RPC;
const FACTORY = import.meta.env.VITE_FACTORY_ADDRESS;

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    const p = new ethers.providers.Web3Provider(window.ethereum || new ethers.providers.JsonRpcProvider(RPC));
    setProvider(p);
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask");
    const p = new ethers.providers.Web3Provider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const s = p.getSigner();
    setProvider(p);
    setSigner(s);
    setAccount(await s.getAddress());
    loadMarkets(p, s);
  }

  async function loadMarkets(p, s) {
    const readProvider = s || p;
    const factory = new ethers.Contract(FACTORY, MarketFactory.abi, readProvider);
    const m = await factory.getMarkets();
    setMarkets(m);
  }

  async function placeBet(marketAddr, side, amountEth="0.01") {
    if (!signer) return alert("Connect wallet");
    const market = new ethers.Contract(marketAddr, PredictionMarket.abi, signer);
    const tx = await market.placeBet(side, { value: ethers.utils.parseEther(amountEth) });
    await tx.wait();
    alert("Bet placed: " + tx.hash);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Markets</h2>
      {!account ? <button onClick={connectWallet}>Connect Wallet</button> : <div>Connected {account}</div>}
      <button onClick={() => loadMarkets(provider, signer)}>Refresh Markets</button>
      <ul>
        {markets.map((m) => (
          <li key={m}>
            {m}
            <button onClick={() => placeBet(m, true)}>Bet YES 0.01</button>
            <button onClick={() => placeBet(m, false)}>Bet NO 0.01</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
