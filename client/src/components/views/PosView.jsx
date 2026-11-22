import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CategoryFilter } from '../pos/CategoryFilter';
import { ProductGrid } from '../pos/ProductGrid';
import { ClientSelector } from '../pos/ClientSelector';
import { CartPanel } from '../pos/CartPanel';
import { PaymentPanel } from '../pos/PaymentPanel';
import { formatCOP } from '../../utils/format';

export const PosView = () => {
  const {
    searchQuery,
    setSearchQuery,
    openModal,
    showToast,
    products,
    addToCart,
    lastItemAdded,
    ticketCounter,
    cart = [],
    totalUnits = 0,
    grandTotal = 0,
  } = useApp();

  const searchInputRef = useRef(null);
  const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'checkout'

  const triggerScanSimulation = () => {
    if (products.length > 0) {
      const randomProd = products[Math.floor(Math.random() * products.length)];
      addToCart(randomProd);
      showToast(`Escáner EAN: + ${randomProd.nombre}`, 'qr_code_scanner');
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;
      const match = products.find(
        (p) =>
          p.codigo.toLowerCase() === q ||
          p.nombre.toLowerCase().includes(q)
      );
      if (match) {
        addToCart(match);
        setSearchQuery('');
      } else {
        showToast('Producto no encontrado por código', 'warning');
      }
    }
  };

  return (
    <section className="h-full flex flex-col gap-2 min-h-0" id="view-pos">
      {/* Selector rápido móvil: Catálogo vs Ticket / Cobrar */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'catalog'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">grid_view</span>
          <span>Catálogo</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('checkout')}
          className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'checkout'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">shopping_cart</span>
          <span>Ticket</span>
          {totalUnits > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono ${
                mobileTab === 'checkout' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
              }`}
            >
              {totalUnits} · {formatCOP(grandTotal)}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: Catalog and Grid (8 columns on lg+, tab on mobile) */}
        <div
          className={`${
            mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
          } col-span-12 lg:col-span-8 flex-col gap-2 h-full min-h-0`}
        >
          {/* Search bar & operational buttons */}
          <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative flex-1 min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600 text-lg font-bold">
                barcode_scanner
              </span>
              <input
                ref={searchInputRef}
                className="w-full pl-9 pr-20 py-1.5 bg-slate-100 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                id="pos-search-input"
                placeholder="Buscar o escanear producto..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-medium rounded flex items-center gap-1 transition-colors cursor-pointer"
                onClick={triggerScanSimulation}
              >
                <span className="material-symbols-outlined text-[13px]">qr_code_scanner</span>
                <span className="hidden sm:inline">Escanear</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                className="flex-1 sm:flex-none justify-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                onClick={() => openModal('manual-item')}
              >
                <span className="material-symbols-outlined text-blue-600 text-sm">add_circle</span>
                <span>Ítem Manual</span>
              </button>
              <button
                className="flex-1 sm:flex-none justify-center px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                onClick={() => openModal('promo')}
              >
                <span className="material-symbols-outlined text-sm">percent</span>
                <span>Promo</span>
                <span className="hidden sm:inline">(F4)</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <CategoryFilter />

          {/* Product Grid */}
          <ProductGrid />

          {/* Barra móvil flotante para ir directo a Cobrar cuando hay productos */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileTab('checkout')}
              className="lg:hidden w-full py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl shadow-md flex items-center justify-between text-xs font-bold shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                Ver Ticket ({totalUnits} {totalUnits === 1 ? 'und.' : 'uds.'})
              </span>
              <span className="font-mono font-extrabold flex items-center gap-1">
                {formatCOP(grandTotal)}
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </span>
            </button>
          )}

          {/* Bottom scale and turno info (oculto en smartphones muy pequeños) */}
          <div className="hidden sm:flex bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs items-center justify-between text-[11px] text-slate-500 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-slate-700 truncate">
                Última lectura: <span className="text-blue-600 font-mono font-bold" id="metric-last-item">{lastItemAdded}</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
              <span
                className="text-emerald-600 font-medium flex items-center gap-1 cursor-pointer hover:underline shrink-0"
                onClick={() => showToast('Balanza RS232: 0.000 kg (Calibrada)', 'scale')}
              >
                <span className="material-symbols-outlined text-xs">wifi</span> Balanza RS232
              </span>
            </div>
            <span className="font-semibold text-slate-700 shrink-0" id="label-tickets-turno">
              Turno: {ticketCounter - 808} tickets
            </span>
          </div>
        </div>

        {/* Right: Ticket and Payment (4 columns on lg+, full scrollable tab on mobile) */}
        <div
          className={`${
            mobileTab === 'checkout' ? 'flex' : 'hidden lg:flex'
          } col-span-12 lg:col-span-4 flex-col gap-2 h-full min-h-0 overflow-y-auto lg:overflow-hidden pb-2 lg:pb-0`}
        >
          <ClientSelector />
          <CartPanel />
          <PaymentPanel />
        </div>
      </div>
    </section>
  );
};
