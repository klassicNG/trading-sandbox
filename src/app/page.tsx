"use client";

import { useState, useEffect } from "react";

type Asset = {
  id: string;
  name: string;
  ticker: string;
  price: number;
  change24h: number;
};

export default function Simulator() {
  // --- STATE MACHINE ---
  const [cash, setCash] = useState<number>(15.0); // Your 20k NGN target
  const [holdings, setHoldings] = useState<Record<string, number>>({
    bitcoin: 0,
    ethereum: 0,
    solana: 0,
    pepe: 0,
  });

  const [market, setMarket] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tradeAmount, setTradeAmount] = useState<number>(5.0); // Default trade size

  // --- LIFECYCLE: Load Bank Data & Fetch Market ---
  useEffect(() => {
    // 1. Pull saved bank data from local browser memory
    const savedCash = localStorage.getItem("dusk_cash");
    const savedHoldings = localStorage.getItem("dusk_holdings");

    if (savedCash) setCash(parseFloat(savedCash));
    if (savedHoldings) setHoldings(JSON.parse(savedHoldings));

    // 2. Ignite Market Feed
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // 30 sec refresh
    return () => clearInterval(interval);
  }, []);

  // --- LIFECYCLE: Save Bank Data on Change ---
  useEffect(() => {
    localStorage.setItem("dusk_cash", cash.toString());
    localStorage.setItem("dusk_holdings", JSON.stringify(holdings));
  }, [cash, holdings]);

  // --- API: The Data Pipeline ---
  const fetchMarketData = async () => {
    try {
      const url =
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,pepe&vs_currencies=usd&include_24hr_change=true";
      const res = await fetch(url);
      const data = await res.json();

      setMarket([
        {
          id: "bitcoin",
          name: "Bitcoin",
          ticker: "BTC",
          price: data.bitcoin.usd,
          change24h: data.bitcoin.usd_24h_change,
        },
        {
          id: "ethereum",
          name: "Ethereum",
          ticker: "ETH",
          price: data.ethereum.usd,
          change24h: data.ethereum.usd_24h_change,
        },
        {
          id: "solana",
          name: "Solana",
          ticker: "SOL",
          price: data.solana.usd,
          change24h: data.solana.usd_24h_change,
        },
        {
          id: "pepe",
          name: "Pepe",
          ticker: "PEPE",
          price: data.pepe.usd,
          change24h: data.pepe.usd_24h_change,
        },
      ]);
      setLoading(false);
    } catch (err) {
      console.error("Market feed offline", err);
    }
  };

  // --- EXECUTION: The Trading Math ---
  const executeTrade = (
    assetId: string,
    price: number,
    type: "BUY" | "SELL",
  ) => {
    const amountUsd = Number(tradeAmount);
    if (amountUsd <= 0) return alert("Enter a valid amount");

    if (type === "BUY") {
      if (cash < amountUsd) return alert("Insufficient USD cash balance!");
      const coinsBought = amountUsd / price; // The Fractional Math

      setCash((prev) => prev - amountUsd);
      setHoldings((prev) => ({
        ...prev,
        [assetId]: (prev[assetId] || 0) + coinsBought,
      }));
    } else {
      const coinsToSell = amountUsd / price;
      if ((holdings[assetId] || 0) < coinsToSell)
        return alert("Insufficient coin balance to sell!");

      setHoldings((prev) => ({
        ...prev,
        [assetId]: prev[assetId] - coinsToSell,
      }));
      setCash((prev) => prev + amountUsd);
    }
  };

  // --- CALCULATIONS ---
  const portfolioValue = market.reduce((total, asset) => {
    return total + (holdings[asset.id] || 0) * asset.price;
  }, 0);
  const totalNetWorth = cash + portfolioValue;

  const formatPrice = (price: number) =>
    price < 1 ? price.toFixed(8) : price.toLocaleString();

  if (loading)
    return (
      <div className="min-h-screen bg-black text-green-500 flex items-center justify-center font-mono">
        Initializing Core Engine...
      </div>
    );

  return (
    <main className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
            Klassic Simulator
          </h1>
          <p className="text-gray-500 text-sm">
            Paper Trading Engine & Risk Sandbox
          </p>
        </header>

        {/* LEDGER & BANK */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Available Cash
            </p>
            <p className="text-3xl font-mono text-green-400">
              ${cash.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Asset Value
            </p>
            <p className="text-3xl font-mono text-blue-400">
              ${portfolioValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Total Net Worth
            </p>
            <p className="text-3xl font-mono text-white">
              ${totalNetWorth.toFixed(2)}
            </p>
          </div>
        </div>

        {/* TRADE EXECUTION PANEL */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg mb-8">
          <label className="text-xs text-gray-400 uppercase tracking-widest block mb-3">
            Order Size (USD)
          </label>
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Number(e.target.value))}
            className="bg-black border border-gray-700 text-white p-3 rounded-md w-full md:w-1/3 focus:border-green-500 focus:outline-none"
          />
        </div>

        {/* LIVE MARKET GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {market.map((asset) => (
            <div
              key={asset.id}
              className="bg-gray-950 border border-gray-800 p-6 rounded-lg flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {asset.name}{" "}
                    <span className="text-gray-500 text-sm">
                      {asset.ticker}
                    </span>
                  </h2>
                  <p className="text-2xl font-mono mt-1">
                    ${formatPrice(asset.price)}
                  </p>
                </div>
                <div
                  className={`text-lg font-bold font-mono ${asset.change24h >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {asset.change24h > 0 ? "+" : ""}
                  {asset.change24h.toFixed(2)}%
                </div>
              </div>

              <div className="bg-gray-900 p-3 rounded text-sm mb-4 border border-gray-800">
                <span className="text-gray-500">You Own:</span>
                <span className="text-white font-mono ml-2">
                  {holdings[asset.id] < 1
                    ? holdings[asset.id].toFixed(6)
                    : holdings[asset.id].toFixed(2)}{" "}
                  {asset.ticker}
                </span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => executeTrade(asset.id, asset.price, "BUY")}
                  className="flex-1 bg-green-900 hover:bg-green-700 text-green-100 py-3 rounded font-bold tracking-widest transition-colors"
                >
                  BUY
                </button>
                <button
                  onClick={() => executeTrade(asset.id, asset.price, "SELL")}
                  className="flex-1 bg-red-900 hover:bg-red-700 text-red-100 py-3 rounded font-bold tracking-widest transition-colors"
                >
                  SELL
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
