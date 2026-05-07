"use client";

import { useState, useEffect } from "react";

type Asset = {
  id: string;
  name: string;
  ticker: string;
  price: number;
  change24h: number;
};
// Upgraded Architecture: amount parameter now handles both Coins (for selling) and USD (for buying)
type PendingOrder = {
  id: string;
  assetId: string;
  type: "TP" | "SL" | "BUY";
  triggerPrice: number;
  amount: number;
};

export default function Simulator() {
  const [cash, setCash] = useState<number>(15.0);
  const [holdings, setHoldings] = useState<Record<string, number>>({
    bitcoin: 0,
    ethereum: 0,
    solana: 0,
    pepe: 0,
    dogecoin: 0,
    "shiba-inu": 0,
    dogwifcoin: 0,
  });
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [market, setMarket] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // UI States
  const [tradeAmount, setTradeAmount] = useState<number>(5.0);
  const [targetPrice, setTargetPrice] = useState<Record<string, number>>({});
  const [limitAmount, setLimitAmount] = useState<Record<string, number>>({});

  // --- LIFECYCLE: Load Bank Data ---
  useEffect(() => {
    const savedCash = localStorage.getItem("klassic_cash");
    const savedHoldings = localStorage.getItem("klassic_holdings");
    const savedOrders = localStorage.getItem("klassic_orders");

    if (savedCash) setCash(parseFloat(savedCash));
    if (savedHoldings) setHoldings(JSON.parse(savedHoldings));
    if (savedOrders) setOrders(JSON.parse(savedOrders));

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // 60s to prevent rate limits
    return () => clearInterval(interval);
  }, []);

  // --- LIFECYCLE: Save Data ---
  useEffect(() => {
    localStorage.setItem("klassic_cash", cash.toString());
    localStorage.setItem("klassic_holdings", JSON.stringify(holdings));
    localStorage.setItem("klassic_orders", JSON.stringify(orders));
  }, [cash, holdings, orders]);

  // --- THE EXECUTION ENGINE ---
  useEffect(() => {
    if (market.length === 0 || orders.length === 0) return;

    let triggeredOrders: string[] = [];
    let cashToAdd = 0;
    let updatedHoldings = { ...holdings };

    orders.forEach((order) => {
      const asset = market.find((a) => a.id === order.assetId);
      if (!asset) return;

      let isTriggered = false;

      // TAKE PROFIT: Trigger when price goes ABOVE target
      if (order.type === "TP" && asset.price >= order.triggerPrice) {
        if (updatedHoldings[order.assetId] >= order.amount) {
          updatedHoldings[order.assetId] -= order.amount;
          cashToAdd += order.amount * asset.price;
          alert(
            `✅ AUTOMATED TAKE PROFIT: Sold ${asset.ticker} at $${asset.price.toLocaleString()}!`,
          );
          isTriggered = true;
        }
      }

      // STOP LOSS: Trigger when price goes BELOW target
      else if (order.type === "SL" && asset.price <= order.triggerPrice) {
        if (updatedHoldings[order.assetId] >= order.amount) {
          updatedHoldings[order.assetId] -= order.amount;
          cashToAdd += order.amount * asset.price;
          alert(
            `🛑 AUTOMATED STOP LOSS: Sold ${asset.ticker} at $${asset.price.toLocaleString()}!`,
          );
          isTriggered = true;
        }
      }

      // LIMIT BUY: Trigger when price goes BELOW target
      else if (order.type === "BUY" && asset.price <= order.triggerPrice) {
        // Amount is in USD. We buy at the limit trigger price.
        const coinsBought = order.amount / order.triggerPrice;
        updatedHoldings[order.assetId] =
          (updatedHoldings[order.assetId] || 0) + coinsBought;
        alert(
          `🚨 AUTOMATED LIMIT BUY: Bought ${asset.ticker} for $${order.amount} at $${order.triggerPrice.toLocaleString()}!`,
        );
        isTriggered = true;
      }

      if (isTriggered) triggeredOrders.push(order.id);
    });

    if (triggeredOrders.length > 0) {
      setCash((prev) => prev + cashToAdd);
      setHoldings(updatedHoldings);
      setOrders((prev) => prev.filter((o) => !triggeredOrders.includes(o.id)));
    }
  }, [market]);

  // --- API DATA PIPELINE ---
  // --- API DATA PIPELINE ---
  const fetchMarketData = async () => {
    try {
      // 1. Expanded URL
      const url =
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,pepe,dogecoin,shiba-inu,dogwifcoin&vs_currencies=usd&include_24hr_change=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Throttled");
      const data = await res.json();

      // 2. Expanded Mapping
      setMarket([
        {
          id: "bitcoin",
          name: "Bitcoin",
          ticker: "BTC",
          price: data.bitcoin?.usd,
          change24h: data.bitcoin?.usd_24h_change,
        },
        {
          id: "ethereum",
          name: "Ethereum",
          ticker: "ETH",
          price: data.ethereum?.usd,
          change24h: data.ethereum?.usd_24h_change,
        },
        {
          id: "solana",
          name: "Solana",
          ticker: "SOL",
          price: data.solana?.usd,
          change24h: data.solana?.usd_24h_change,
        },
        {
          id: "dogecoin",
          name: "Dogecoin",
          ticker: "DOGE",
          price: data.dogecoin?.usd,
          change24h: data.dogecoin?.usd_24h_change,
        },
        {
          id: "shiba-inu",
          name: "Shiba Inu",
          ticker: "SHIB",
          price: data["shiba-inu"]?.usd,
          change24h: data["shiba-inu"]?.usd_24h_change,
        },
        {
          id: "pepe",
          name: "Pepe",
          ticker: "PEPE",
          price: data.pepe?.usd,
          change24h: data.pepe?.usd_24h_change,
        },
        {
          id: "dogwifcoin",
          name: "Dogwifhat",
          ticker: "WIF",
          price: data.dogwifcoin?.usd,
          change24h: data.dogwifcoin?.usd_24h_change,
        },
      ]);
      setLoading(false);
    } catch (err) {
      console.warn("Market feed offline - using cached state.");
    }
  };

  // --- MANUAL EXECUTIONS ---
  const executeMarketTrade = (
    assetId: string,
    price: number,
    type: "BUY" | "SELL",
  ) => {
    const amountUsd = Number(tradeAmount);
    if (amountUsd <= 0) return alert("Enter a valid amount");

    if (type === "BUY") {
      if (cash < amountUsd) return alert("Insufficient Available Cash!");
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

  // --- AUTOMATED EXECUTIONS ---
  const placeLimitOrder = (
    assetId: string,
    currentPrice: number,
    type: "TP" | "SL" | "BUY",
  ) => {
    const trigger = targetPrice[assetId];
    if (!trigger || trigger <= 0) return alert("Set a valid target price.");

    if (type === "BUY") {
      const usdAmount = limitAmount[assetId];
      if (!usdAmount || usdAmount <= 0)
        return alert("Set a valid USD amount to buy.");
      if (trigger >= currentPrice)
        return alert("Limit Buy must be LOWER than current price.");
      if (cash < usdAmount)
        return alert("Insufficient Available Cash for Limit Order!");

      // Lock the cash immediately
      setCash((prev) => prev - usdAmount);
      setOrders((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          assetId,
          type,
          triggerPrice: trigger,
          amount: usdAmount,
        },
      ]);
    } else {
      // Selling limits (TP / SL)
      const currentHolding = holdings[assetId] || 0;
      if (currentHolding <= 0)
        return alert("You must own the coin to set a limit sell.");
      if (type === "TP" && trigger <= currentPrice)
        return alert("Take Profit must be HIGHER than current price.");
      if (type === "SL" && trigger >= currentPrice)
        return alert("Stop Loss must be LOWER than current price.");

      setOrders((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          assetId,
          type,
          triggerPrice: trigger,
          amount: currentHolding,
        },
      ]);
    }

    // Clear inputs
    setTargetPrice((prev) => ({ ...prev, [assetId]: 0 }));
    setLimitAmount((prev) => ({ ...prev, [assetId]: 0 }));
  };

  const cancelOrder = (orderId: string, type: string, amount: number) => {
    if (type === "BUY") {
      // Refund locked cash
      setCash((prev) => prev + amount);
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // --- FINANCIAL CALCULATIONS ---
  const portfolioValue = market.reduce(
    (total, asset) => total + (holdings[asset.id] || 0) * asset.price,
    0,
  );
  const lockedCash = orders
    .filter((o) => o.type === "BUY")
    .reduce((total, order) => total + order.amount, 0);
  const totalNetWorth = cash + lockedCash + portfolioValue;

  const formatPrice = (price: number) =>
    price < 1
      ? price.toFixed(8)
      : price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  if (loading)
    return (
      <div className="min-h-screen bg-black text-green-500 flex items-center justify-center font-mono">
        Initializing Exchange Engine...
      </div>
    );

  return (
    <main className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
            Klassic Exchange Simulator
          </h1>
          <p className="text-gray-500 text-sm">
            Advanced Limit Order & Execution Sandbox
          </p>
        </header>

        {/* THE BANK */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Available Cash
            </p>
            <p className="text-2xl font-mono text-green-400">
              ${cash.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              In Orders (Locked)
            </p>
            <p className="text-2xl font-mono text-yellow-500">
              ${lockedCash.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Asset Value
            </p>
            <p className="text-2xl font-mono text-blue-400">
              ${portfolioValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">
              Net Worth
            </p>
            <p className="text-2xl font-mono text-white">
              ${totalNetWorth.toFixed(2)}
            </p>
          </div>
        </div>

        {/* MARKET GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {market.map((asset) => (
            <div
              key={asset.id}
              className="bg-gray-950 border border-gray-800 p-6 rounded-lg flex flex-col justify-between space-y-6"
            >
              <div className="flex justify-between items-start">
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

              <div className="bg-gray-900 p-3 rounded text-sm border border-gray-800 flex justify-between items-center">
                <span>
                  <span className="text-gray-500">You Own:</span>{" "}
                  <span className="text-white font-mono ml-2">
                    {(holdings[asset.id] || 0) < 1
                      ? (holdings[asset.id] || 0).toFixed(6)
                      : (holdings[asset.id] || 0).toFixed(2)}{" "}
                    {asset.ticker}
                  </span>
                </span>
              </div>

              {/* MANUAL MARKET ORDERS */}
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase tracking-widest block">
                  Instant Market Trade
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="USD $"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(Number(e.target.value))}
                    className="bg-black border border-gray-700 text-white p-2 rounded w-1/3 focus:border-green-500 outline-none"
                  />
                  <button
                    onClick={() =>
                      executeMarketTrade(asset.id, asset.price, "BUY")
                    }
                    className="flex-1 bg-green-900 hover:bg-green-700 text-green-100 rounded font-bold transition-colors"
                  >
                    BUY
                  </button>
                  <button
                    onClick={() =>
                      executeMarketTrade(asset.id, asset.price, "SELL")
                    }
                    className="flex-1 bg-red-900 hover:bg-red-700 text-red-100 rounded font-bold transition-colors"
                  >
                    SELL
                  </button>
                </div>
              </div>

              {/* AUTOMATED LIMIT ORDERS */}
              <div className="border-t border-gray-800 pt-4 space-y-2">
                <label className="text-xs text-gray-500 uppercase tracking-widest block">
                  Automated Limit Execution
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
                    className="bg-black border border-gray-700 text-white p-2 rounded w-1/2 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Limit Buy $"
                    value={limitAmount[asset.id] || ""}
                    onChange={(e) =>
                      setLimitAmount((prev) => ({
                        ...prev,
                        [asset.id]: Number(e.target.value),
                      }))
                    }
                    className="bg-black border border-gray-700 text-white p-2 rounded w-1/2 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() =>
                      placeLimitOrder(asset.id, asset.price, "BUY")
                    }
                    className="flex-1 bg-blue-900 hover:bg-blue-700 text-blue-100 text-xs py-2 rounded font-bold transition-colors"
                  >
                    Set LIMIT BUY
                  </button>
                  <button
                    onClick={() => placeLimitOrder(asset.id, asset.price, "TP")}
                    className="flex-1 bg-green-900/50 hover:bg-green-800 text-green-100 text-xs py-2 rounded font-bold transition-colors"
                  >
                    Set TAKE PROFIT
                  </button>
                  <button
                    onClick={() => placeLimitOrder(asset.id, asset.price, "SL")}
                    className="flex-1 bg-orange-900/50 hover:bg-orange-800 text-orange-100 text-xs py-2 rounded font-bold transition-colors"
                  >
                    Set STOP LOSS
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PENDING ORDERS DASHBOARD */}
        {orders.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg mt-8">
            <h3 className="text-sm text-gray-400 uppercase tracking-widest mb-4">
              Open Orders Book
            </h3>
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center bg-black p-4 rounded border border-gray-800"
                >
                  <span className="text-white font-mono font-bold w-16">
                    {order.assetId.toUpperCase()}
                  </span>

                  <span
                    className={`font-bold w-32 ${order.type === "TP" ? "text-green-500" : order.type === "SL" ? "text-orange-500" : "text-blue-500"}`}
                  >
                    {order.type === "TP"
                      ? "Take Profit"
                      : order.type === "SL"
                        ? "Stop Loss"
                        : "Limit Buy"}
                  </span>

                  <span className="text-gray-400 font-mono text-sm w-32">
                    {order.type === "BUY"
                      ? `Spend $${order.amount}`
                      : `Sell ${order.amount.toFixed(4)}`}
                  </span>

                  <span className="text-white font-mono text-lg flex-1 text-right pr-4">
                    @ ${order.triggerPrice.toLocaleString()}
                  </span>

                  <button
                    onClick={() =>
                      cancelOrder(order.id, order.type, order.amount)
                    }
                    className="text-xs bg-red-900/20 text-red-500 hover:bg-red-900/50 px-3 py-2 rounded transition-colors"
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
