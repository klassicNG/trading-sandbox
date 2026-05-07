"use client";

import { useState, useEffect } from "react";

type Asset = {
  id: string;
  name: string;
  ticker: string;
  price: number;
  change24h: number;
};
// 1. The New Architecture for Limit Orders
type PendingOrder = {
  id: string;
  assetId: string;
  type: "TP" | "SL";
  triggerPrice: number;
  amountCoins: number;
};

export default function Simulator() {
  const [cash, setCash] = useState<number>(15.0);
  const [holdings, setHoldings] = useState<Record<string, number>>({
    bitcoin: 0,
    ethereum: 0,
    solana: 0,
    pepe: 0,
  });

  // 2. State Machine for the Execution Engine
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [market, setMarket] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tradeAmount, setTradeAmount] = useState<number>(5.0);
  const [targetPrice, setTargetPrice] = useState<Record<string, number>>({});

  // --- LIFECYCLE: Load Bank Data & Fetch Market ---
  useEffect(() => {
    const savedCash = localStorage.getItem("klassic_cash");
    const savedHoldings = localStorage.getItem("klassic_holdings");
    const savedOrders = localStorage.getItem("klassic_orders");

    if (savedCash) setCash(parseFloat(savedCash));
    if (savedHoldings) setHoldings(JSON.parse(savedHoldings));
    if (savedOrders) setOrders(JSON.parse(savedOrders));

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // --- LIFECYCLE: Save Data ---
  useEffect(() => {
    localStorage.setItem("klassic_cash", cash.toString());
    localStorage.setItem("klassic_holdings", JSON.stringify(holdings));
    localStorage.setItem("klassic_orders", JSON.stringify(orders));
  }, [cash, holdings, orders]);

  // --- 3. THE EXECUTION ENGINE (The automated bot) ---
  useEffect(() => {
    if (market.length === 0 || orders.length === 0) return;

    let triggeredOrders: string[] = [];
    let cashToAdd = 0;
    let updatedHoldings = { ...holdings };

    orders.forEach((order) => {
      const asset = market.find((a) => a.id === order.assetId);
      if (!asset) return;

      let isTriggered = false;
      // If it's a Take Profit, trigger when price goes ABOVE target
      if (order.type === "TP" && asset.price >= order.triggerPrice)
        isTriggered = true;
      // If it's a Stop Loss, trigger when price goes BELOW target
      if (order.type === "SL" && asset.price <= order.triggerPrice)
        isTriggered = true;

      if (isTriggered) {
        if (updatedHoldings[order.assetId] >= order.amountCoins) {
          updatedHoldings[order.assetId] -= order.amountCoins;
          cashToAdd += order.amountCoins * asset.price;
          alert(
            `🚨 AUTOMATED SELL TRIGGERED: ${order.type} for ${asset.ticker} at $${asset.price}!`,
          );
        }
        triggeredOrders.push(order.id); // Mark order for removal
      }
    });

    // Process all triggered orders instantly
    if (triggeredOrders.length > 0) {
      setCash((prev) => prev + cashToAdd);
      setHoldings(updatedHoldings);
      setOrders((prev) => prev.filter((o) => !triggeredOrders.includes(o.id)));
    }
  }, [market]); // This runs every single time the market updates!

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

  // --- EXECUTION: Manual Trades ---
  const executeTrade = (
    assetId: string,
    price: number,
    type: "BUY" | "SELL",
  ) => {
    const amountUsd = Number(tradeAmount);
    if (amountUsd <= 0) return alert("Enter a valid amount");

    if (type === "BUY") {
      if (cash < amountUsd) return alert("Insufficient USD cash balance!");
      setCash((prev) => prev - amountUsd);
      setHoldings((prev) => ({
        ...prev,
        [assetId]: (prev[assetId] || 0) + amountUsd / price,
      }));
    } else {
      const coinsToSell = amountUsd / price;
      if ((holdings[assetId] || 0) < coinsToSell)
        return alert("Insufficient balance to sell!");
      setHoldings((prev) => ({
        ...prev,
        [assetId]: prev[assetId] - coinsToSell,
      }));
      setCash((prev) => prev + amountUsd);
    }
  };

  // --- 4. EXECUTION: Automated Limits ---
  const setLimitOrder = (
    assetId: string,
    currentPrice: number,
    type: "TP" | "SL",
  ) => {
    const trigger = targetPrice[assetId];
    if (!trigger || trigger <= 0)
      return alert("Set a valid target price first.");
    const currentHolding = holdings[assetId] || 0;
    if (currentHolding <= 0)
      return alert("You must own the coin before setting a sell limit.");

    // Safety check logic
    if (type === "TP" && trigger <= currentPrice)
      return alert("Take Profit must be HIGHER than the current price.");
    if (type === "SL" && trigger >= currentPrice)
      return alert("Stop Loss must be LOWER than the current price.");

    setOrders((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        assetId,
        type,
        triggerPrice: trigger,
        amountCoins: currentHolding, // Auto-sell all holdings for simplicity
      },
    ]);

    // Clear input field
    setTargetPrice((prev) => ({ ...prev, [assetId]: 0 }));
  };

  // --- CALCULATIONS ---
  const portfolioValue = market.reduce(
    (total, asset) => total + (holdings[asset.id] || 0) * asset.price,
    0,
  );
  const formatPrice = (price: number) =>
    price < 1 ? price.toFixed(8) : price.toLocaleString();

  if (loading)
    return (
      <div className="min-h-screen bg-black text-green-500 flex items-center justify-center font-mono">
        Initializing Engine...
      </div>
    );

  return (
    <main className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
            Klassic Simulator
          </h1>
          <p className="text-gray-500 text-sm">
            Paper Trading Engine & Automated Risk Management
          </p>
        </header>

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
              ${(cash + portfolioValue).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg">
          <label className="text-xs text-gray-400 uppercase tracking-widest block mb-3">
            Manual Order Size (USD)
          </label>
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Number(e.target.value))}
            className="bg-black border border-gray-700 text-white p-3 rounded-md w-full md:w-1/3 focus:border-green-500 focus:outline-none"
          />
        </div>

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

              <div className="bg-gray-900 p-3 rounded text-sm mb-4 border border-gray-800 flex justify-between items-center">
                <span>
                  <span className="text-gray-500">You Own:</span>{" "}
                  <span className="text-white font-mono ml-2">
                    {holdings[asset.id] < 1
                      ? holdings[asset.id].toFixed(6)
                      : holdings[asset.id].toFixed(2)}{" "}
                    {asset.ticker}
                  </span>
                </span>
              </div>

              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => executeTrade(asset.id, asset.price, "BUY")}
                  className="flex-1 bg-green-900 hover:bg-green-700 text-green-100 py-2 rounded font-bold tracking-widest transition-colors"
                >
                  BUY
                </button>
                <button
                  onClick={() => executeTrade(asset.id, asset.price, "SELL")}
                  className="flex-1 bg-red-900 hover:bg-red-700 text-red-100 py-2 rounded font-bold tracking-widest transition-colors"
                >
                  SELL
                </button>
              </div>

              {/* The New Automation Interface */}
              <div className="border-t border-gray-800 pt-4 mt-2">
                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">
                  Automated Limit Order
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Target Price $"
                    value={targetPrice[asset.id] || ""}
                    onChange={(e) =>
                      setTargetPrice((prev) => ({
                        ...prev,
                        [asset.id]: Number(e.target.value),
                      }))
                    }
                    className="bg-black border border-gray-700 text-white p-2 rounded w-full focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => setLimitOrder(asset.id, asset.price, "TP")}
                    className="bg-blue-900 hover:bg-blue-700 text-xs px-3 rounded font-bold transition-colors"
                  >
                    Set TP
                  </button>
                  <button
                    onClick={() => setLimitOrder(asset.id, asset.price, "SL")}
                    className="bg-orange-900 hover:bg-orange-700 text-xs px-3 rounded font-bold transition-colors"
                  >
                    Set SL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active Orders Tracker */}
        {orders.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg mt-8">
            <h3 className="text-sm text-gray-400 uppercase tracking-widest mb-4">
              Pending Limit Orders
            </h3>
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center bg-black p-3 rounded border border-gray-800"
                >
                  <span className="text-white font-mono">
                    {order.assetId.toUpperCase()}
                  </span>
                  <span
                    className={`font-bold ${order.type === "TP" ? "text-blue-500" : "text-orange-500"}`}
                  >
                    {order.type === "TP" ? "Take Profit" : "Stop Loss"} @ $
                    {order.triggerPrice}
                  </span>
                  <button
                    onClick={() =>
                      setOrders((prev) => prev.filter((o) => o.id !== order.id))
                    }
                    className="text-xs text-gray-500 hover:text-red-500"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
