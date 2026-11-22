import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/api';
import { formatCOP } from '../../utils/format';

export const StockView = () => {
  const {
    products = [],
    setProducts,
    addToCart,
    setCurrentView,
    openModal,
    openDetailProduct,
    openEditProduct,
    openDeactivateProduct,
    openPurchaseModal,
    showToast,
    currentUser,
    isAdmin,
    hasPermiso = () => true,
  } = useApp();

  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'movimientos'
  const [filterEstado, setFilterEstado] = useState('ACTIVO'); // 'ACTIVO' | 'AGOTADO' | 'STOCK_BAJO' | 'INACTIVO' | 'TODOS'
  const [tableSearch, setTableSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const scrollContainerRef = useRef(null);

  // Estado para modal de Ajuste Manual de Stock (RF-14 / RF-41)
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('SALIDA'); // 'SALIDA' | 'ENTRADA' | 'AJUSTE' | 'DEVOLUCION'
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const openAdjustModal = (product) => {
    setAdjustProduct(product);
    setAdjustType('SALIDA');
    setAdjustQty('1');
    setAdjustReason('');
    setAdjustError('');
  };

  const closeAdjustModal = () => {
    setAdjustProduct(null);
    setAdjustError('');
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustProduct) return;
    setAdjustError('');

    const qtyNum = parseInt(adjustQty, 10);
    const currentStock = adjustProduct.stock !== undefined ? parseInt(adjustProduct.stock, 10) : 0;

    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      setAdjustError('La cantidad debe ser un número entero mayor a 0.');
      return;
    }
    if (adjustType === 'SALIDA' && qtyNum > currentStock) {
      setAdjustError(`No puedes descontar ${qtyNum} und. porque el stock actual es ${currentStock}.`);
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('Debes redactar una justificación para el ajuste de stock.');
      return;
    }

    setAdjustLoading(true);
    try {
      const mov = await api.createInventoryAdjustment({
        id_producto: adjustProduct.id_producto,
        tipo_movimiento: adjustType,
        cantidad: qtyNum,
        observacion: adjustReason.trim(),
        id_usuario: currentUser?.id_usuario || 1,
      });

      const newStockVal =
        mov?.existencia_nueva !== undefined
          ? parseInt(mov.existencia_nueva, 10)
          : adjustType === 'ENTRADA' || adjustType === 'DEVOLUCION'
          ? currentStock + qtyNum
          : adjustType === 'SALIDA'
          ? Math.max(0, currentStock - qtyNum)
          : qtyNum;

      if (typeof setProducts === 'function') {
        setProducts((prev) =>
          prev.map((item) =>
            item.id_producto === adjustProduct.id_producto
              ? { ...item, stock: newStockVal }
              : item
          )
        );
      }

      // Refrescar Kardex en segundo plano
      api.getInventoryMovements().then((data) => setMovimientos(data)).catch(() => {});

      showToast(
        `Ajuste registrado (${adjustType} ${qtyNum}): "${adjustProduct.nombre}" pasó de ${currentStock} → ${newStockVal} und.`,
        'tune'
      );
      closeAdjustModal();
    } catch (err) {
      const msg = err.message || 'No se pudo registrar el ajuste de inventario.';
      setAdjustError(msg);
      showToast(msg, 'error');
    } finally {
      setAdjustLoading(false);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Estado para historial de movimientos
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [filtroTipoMov, setFiltroTipoMov] = useState('TODOS');
  const [searchMov, setSearchMov] = useState('');

  // Cargar movimientos al cambiar a la pestaña
  useEffect(() => {
    if (activeTab === 'movimientos') {
      setLoadingMovs(true);
      api.getInventoryMovements()
        .then(data => setMovimientos(data))
        .catch(() => {})
        .finally(() => setLoadingMovs(false));
    }
  }, [activeTab]);

  const handleSellInPos = (product) => {
    addToCart(product);
    setCurrentView('pos');
  };

  const outOfStockCount = (products || []).filter(
    p => (p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO' && (p.stock !== undefined ? p.stock : 0) <= 0
  ).length;

  const lowStockCount = (products || []).filter(p => {
    const isAct = (p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';
    const st = p.stock !== undefined ? p.stock : 0;
    const minSt = p.stock_minimo ?? 5;
    return isAct && st > 0 && st <= minSt;
  }).length;

  const filteredProducts = products.filter((p) => {
    const estado = (p.estado || 'ACTIVO').toUpperCase();
    const stock = p.stock !== undefined ? p.stock : 0;
    const minStock = p.stock_minimo ?? 5;

    let matchEstado = true;
    if (filterEstado === 'AGOTADO') {
      matchEstado = estado === 'ACTIVO' && stock <= 0;
    } else if (filterEstado === 'STOCK_BAJO') {
      matchEstado = estado === 'ACTIVO' && stock > 0 && stock <= minStock;
    } else if (filterEstado !== 'TODOS') {
      matchEstado = estado === filterEstado;
    }

    const q = tableSearch.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo && p.codigo.toLowerCase().includes(q)) ||
      (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(q));
    return matchEstado && matchSearch;
  });

  const filteredMovimientos = movimientos.filter(m => {
    const matchTipo = filtroTipoMov === 'TODOS' || m.tipo_movimiento === filtroTipoMov;
    const q = searchMov.toLowerCase().trim();
    const matchQ = !q ||
      m.producto_nombre?.toLowerCase().includes(q) ||
      m.codigo_sku?.toLowerCase().includes(q) ||
      m.observacion?.toLowerCase().includes(q) ||
      m.usuario_nombre?.toLowerCase().includes(q) ||
      m.origen?.toLowerCase().includes(q);
    return matchTipo && matchQ;
  });

  const activeCount = products.filter(p => (p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO').length;
  const inactiveCount = products.filter(p => (p.estado || 'ACTIVO').toUpperCase() === 'INACTIVO').length;

  return (
    <section className="flex flex-col gap-2.5 h-full min-h-0 overflow-y-auto lg:overflow-hidden" id="view-stock">
      {/* Header con Pestañas */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">inventory_2</span>
              Gestión Integral de Inventario &amp; Stock
            </h2>
            {outOfStockCount > 0 && (
              <span
                onClick={() => {
                  setActiveTab('catalogo');
                  setFilterEstado('AGOTADO');
                }}
                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded-full border border-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Ver productos agotados (stock 0)"
              >
                <span className="material-symbols-outlined text-xs text-rose-700">error</span>
                {outOfStockCount} Agotado{outOfStockCount > 1 ? 's' : ''}
              </span>
            )}
            {lowStockCount > 0 && (
              <span 
                onClick={() => {
                  setActiveTab('catalogo');
                  setFilterEstado('STOCK_BAJO');
                }}
                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Ver productos con alerta de stock bajo"
              >
                <span className="material-symbols-outlined text-xs text-amber-700">warning</span>
                {lowStockCount} en Stock Bajo
              </span>
            )}
          </div>
          
          {/* Navegación entre Pestañas */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'catalogo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">inventory</span>
              Catálogo de Existencias ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('movimientos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'movimientos'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">history</span>
              Historial de Movimientos (Kardex)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'catalogo' && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en tabla"
              >
                <span className="material-symbols-outlined text-sm">table_rows</span> Tabla
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en tarjetas"
              >
                <span className="material-symbols-outlined text-sm">grid_view</span> Tarjetas
              </button>
            </div>
          )}

          {(hasPermiso('crear_producto') || isAdmin) && (
            <button
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
              onClick={() => openModal('new-product')}
              id="btn-new-product"
            >
              <span className="material-symbols-outlined text-sm">add</span> Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: CATÁLOGO DE PRODUCTOS */}
      {activeTab === 'catalogo' && (
        <>
          {/* Alerta de Productos Agotados (stock 0) */}
          {outOfStockCount > 0 && filterEstado !== 'AGOTADO' && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-rose-900 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-base">error</span>
                <span>
                  Hay <strong>{outOfStockCount} producto{outOfStockCount > 1 ? 's' : ''} agotado{outOfStockCount > 1 ? 's' : ''}</strong> (stock en 0) que requiere{outOfStockCount > 1 ? 'n' : ''} reposición urgente.
                </span>
              </div>
              <button
                onClick={() => setFilterEstado('AGOTADO')}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Ver Agotados
              </button>
            </div>
          )}

          {/* Alerta de Stock Bajo (si hay productos que lo requieren) */}
          {lowStockCount > 0 && filterEstado !== 'STOCK_BAJO' && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">warning</span>
                <span>
                  Hay <strong>{lowStockCount} producto{lowStockCount > 1 ? 's' : ''}</strong> con existencias iguales o por debajo del stock mínimo recomendado.
                </span>
              </div>
              <button
                onClick={() => setFilterEstado('STOCK_BAJO')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Ver Alertas de Stock
              </button>
            </div>
          )}

          {/* Buscador y Filtros de Estado */}
          <div className="flex items-center gap-2 flex-wrap text-xs shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre, código SKU o categoría..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-slate-400 focus:outline-none transition-colors shadow-xs"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs overflow-x-auto max-w-full">
              <button
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  filterEstado === 'ACTIVO' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setFilterEstado('ACTIVO')}
              >
                Activos ({activeCount})
              </button>
              <button
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  filterEstado === 'AGOTADO'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
                onClick={() => setFilterEstado('AGOTADO')}
              >
                <span className="material-symbols-outlined text-xs">error</span>
                Agotados ({outOfStockCount})
              </button>
              <button
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  filterEstado === 'STOCK_BAJO'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
                onClick={() => setFilterEstado('STOCK_BAJO')}
              >
                <span className="material-symbols-outlined text-xs">warning</span>
                Stock Bajo ({lowStockCount})
              </button>
              <button
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  filterEstado === 'INACTIVO' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setFilterEstado('INACTIVO')}
              >
                Inactivos ({inactiveCount})
              </button>
              <button
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  filterEstado === 'TODOS' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setFilterEstado('TODOS')}
              >
                Todos ({products.length})
              </button>
            </div>
          </div>

      {/* Main Content Area (Scrollable Downward) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex-1 min-h-[320px] lg:min-h-0 flex flex-col overflow-hidden">
        {viewMode === 'table' ? (
          /* TABLA CON DESPLAZAMIENTO HACIA ABAJO Y ENCABEZADOS FIJOS */
          <div
            ref={scrollContainerRef}
            className="overflow-auto flex-1 min-h-0 scroll-smooth"
            id="stock-table-scroll-container"
          >
            <table className="w-full text-left text-xs" style={{ minWidth: '900px' }}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="p-3 min-w-[220px]">Producto</th>
                  <th className="p-3 w-[130px]">Categoría</th>
                  <th className="p-3 w-[160px]">Proveedor Asociado</th>
                  <th className="p-3 w-[120px] text-right">PVP (COP)</th>
                  <th className="p-3 w-[100px] text-center">Stock Almacén</th>
                  <th className="p-3 w-[80px] text-center">Estado</th>
                  <th className="p-3 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100" id="inventory-tbody">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      No se encontraron productos coincidentes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const stock = p.stock !== undefined ? p.stock : 0;
                    const minStock = p.stock_minimo ?? 5;
                    const isOutOfStock = stock <= 0;
                    const isLow = !isOutOfStock && stock <= minStock;
                    const isActive = (p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';

                    return (
                      <tr
                        key={p.id_producto}
                        className={`hover:bg-slate-50/80 transition-colors ${!isActive ? 'opacity-55' : ''}`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={p.imagen_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=360&auto=format&fit=crop&q=80'}
                              alt={p.nombre}
                              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=360&auto=format&fit=crop&q=80'; }}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block truncate max-w-[200px] md:max-w-xs" title={p.nombre}>
                                {p.nombre}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {p.codigo}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium border border-slate-200">
                            {p.categoria_nombre || 'General'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="material-symbols-outlined text-xs text-blue-500 shrink-0">local_shipping</span>
                            <span className="truncate max-w-[120px] font-medium text-slate-700" title={p.proveedor_nombre}>
                              {p.proveedor_nombre || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs">
                          {formatCOP(p.precio_venta)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isOutOfStock ? (
                                <>
                                  <span className="material-symbols-outlined text-[12px]">error</span>
                                  Agotado (0)
                                </>
                              ) : isLow ? (
                                <>
                                  <span className="material-symbols-outlined text-[12px]">warning</span>
                                  Stock Bajo ({stock})
                                </>
                              ) : (
                                <>{stock} und.</>
                              )}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-mono">
                              Mín: {minStock}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {/* Consultar */}
                            <button
                              onClick={() => openDetailProduct(p)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
                              title="Consultar ficha técnica"
                            >
                              <span className="material-symbols-outlined text-xs">visibility</span>
                              <span>Consultar</span>
                            </button>

                            {/* Modificar */}
                            {(hasPermiso('editar_producto') || isAdmin) && (
                              <button
                                onClick={() => openEditProduct(p)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
                                title="Modificar producto"
                              >
                                <span className="material-symbols-outlined text-xs">edit</span>
                                <span>Modificar</span>
                              </button>
                            )}

                            {/* Desactivar / Activar */}
                            {(hasPermiso('editar_producto') || isAdmin) && (
                              <button
                                onClick={() => openDeactivateProduct(p)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
                                title={isActive ? 'Desactivar producto' : 'Activar producto'}
                              >
                                <span className="material-symbols-outlined text-xs">
                                  {isActive ? 'remove_shopping_cart' : 'add_shopping_cart'}
                                </span>
                                <span>{isActive ? 'Desactivar' : 'Activar'}</span>
                              </button>
                            )}

                            {/* Ajuste Manual de Stock (RF-14 / RF-41) */}
                            {(hasPermiso('editar_producto') || hasPermiso('ver_inventario') || isAdmin) && (
                              <button
                                id={`btn-ajuste-stock-${p.id_producto}`}
                                onClick={() => openAdjustModal(p)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded text-xs font-semibold transition-colors flex items-center gap-0.5 border border-indigo-200 cursor-pointer"
                                title="Ajuste manual de stock (conteo físico / merma / entrada)"
                              >
                                <span className="material-symbols-outlined text-xs">tune</span>
                                <span>Ajuste de Stock</span>
                              </button>
                            )}

                            {/* Reponer Stock / Comprar */}
                            {(hasPermiso('crear_compra') || isAdmin) && (
                              <button
                                onClick={() => openPurchaseModal(p)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded text-xs font-semibold transition-colors flex items-center gap-0.5 border border-amber-200 cursor-pointer"
                                title="Registrar orden de compra / reponer existencias"
                              >
                                <span className="material-symbols-outlined text-xs">local_shipping</span>
                                <span>Reponer</span>
                              </button>
                            )}

                            {/* Vender en POS */}
                            <button
                              onClick={() => handleSellInPos(p)}
                              disabled={!isActive || stock <= 0}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded text-xs font-semibold transition-colors flex items-center gap-0.5 disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-700 cursor-pointer"
                              title={isActive ? 'Vender en Terminal POS' : 'Producto inactivo'}
                            >
                              <span className="material-symbols-outlined text-xs">point_of_sale</span>
                              <span>Vender</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* VISTA EN TARJETAS VISUALES CON DESPLAZAMIENTO HACIA ABAJO */
          <div
            ref={scrollContainerRef}
            className="overflow-auto flex-1 min-h-0 p-3.5 scroll-smooth"
            id="stock-cards-scroll-container"
          >
            {filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">search_off</span>
                <p className="text-xs font-semibold">No se encontraron productos coincidentes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const stock = p.stock !== undefined ? p.stock : 0;
                  const minStock = p.stock_minimo ?? 5;
                  const isOutOfStock = stock <= 0;
                  const isLow = !isOutOfStock && stock <= minStock;
                  const isActive = (p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';

                  return (
                    <div
                      key={p.id_producto}
                      className={`bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between hover:shadow-md transition-all ${
                        !isActive ? 'opacity-60 bg-slate-50' : ''
                      }`}
                    >
                      <div>
                        <div className="relative w-full h-36 rounded-lg overflow-hidden bg-slate-100 mb-2.5">
                          <img
                            src={p.imagen_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=360&auto=format&fit=crop&q=80'}
                            alt={p.nombre}
                            onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=360&auto=format&fit=crop&q=80'; }}
                            className="w-full h-full object-cover"
                          />
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-xs text-white flex items-center gap-0.5 ${
                              isOutOfStock
                                ? 'bg-rose-600'
                                : isLow
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`}
                          >
                            {isOutOfStock ? 'Agotado (0)' : isLow ? `Stock Bajo: ${stock}` : `Stock: ${stock}`}
                          </span>
                          <span
                            className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold border border-slate-200">
                          {p.categoria_nombre || 'General'}
                        </span>

                        <h4 className="font-bold text-slate-800 text-sm mt-1.5 truncate" title={p.nombre}>
                          {p.nombre}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400">{p.codigo}</p>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-400">PVP:</span>
                          <span className="text-sm font-extrabold text-blue-700 font-mono">
                            {formatCOP(p.precio_venta)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-1 mt-3 pt-2.5 border-t border-slate-100">
                        <button
                          onClick={() => openDetailProduct(p)}
                          className="py-1 px-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                          title="Consultar ficha"
                        >
                          <span className="material-symbols-outlined text-xs">visibility</span>
                        </button>
                        {(hasPermiso('editar_producto') || isAdmin) && (
                          <button
                            onClick={() => openEditProduct(p)}
                            className="py-1 px-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                            title="Modificar"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span>
                          </button>
                        )}
                        {(hasPermiso('editar_producto') || hasPermiso('ver_inventario') || isAdmin) && (
                          <button
                            onClick={() => openAdjustModal(p)}
                            className="py-1 px-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold border border-indigo-200 flex items-center justify-center gap-1 cursor-pointer"
                            title="Ajuste de Stock"
                          >
                            <span className="material-symbols-outlined text-xs">tune</span>
                          </button>
                        )}
                        {(hasPermiso('crear_compra') || isAdmin) && (
                          <button
                            onClick={() => openPurchaseModal(p)}
                            className="py-1 px-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold border border-amber-200 flex items-center justify-center gap-1 cursor-pointer"
                            title="Reponer stock / Comprar"
                          >
                            <span className="material-symbols-outlined text-xs">local_shipping</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleSellInPos(p)}
                          disabled={!isActive || stock <= 0}
                          className="py-1 px-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                          title="Vender en POS"
                        >
                          <span className="material-symbols-outlined text-xs">point_of_sale</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BARRA INFORMATIVA DE PIE DE TABLA Y CONTROL DE DESPLAZAMIENTO */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 font-medium text-[11px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Mostrando <strong className="text-slate-800">{filteredProducts.length}</strong> de{' '}
              <strong className="text-slate-800">{products.length}</strong> productos
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-700 font-medium">{activeCount} activos</span>
            {inactiveCount > 0 && (
              <span className="text-rose-600 font-medium">· {inactiveCount} inactivos</span>
            )}
          </div>

          <button
            onClick={scrollToTop}
            className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer shadow-2xs"
            title="Desplazarse al inicio de la tabla"
          >
            <span className="material-symbols-outlined text-sm">arrow_upward</span> Volver arriba
          </button>
        </div>
      </div>
      </>
      )}

      {/* PESTAÑA 2: HISTORIAL DETALLADO DE MOVIMIENTOS (KARDEX) */}
      {activeTab === 'movimientos' && (
        <>
          {/* Barra de Filtros de Movimientos */}
          <div className="flex items-center gap-2 flex-wrap text-xs shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por producto, SKU, responsable o motivo..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-slate-400 focus:outline-none transition-colors shadow-xs"
                value={searchMov}
                onChange={(e) => setSearchMov(e.target.value)}
              />
            </div>

            <div className="flex gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs overflow-x-auto max-w-full">
              {[
                { id: 'TODOS', label: 'Todos' },
                { id: 'ENTRADA', label: 'Entradas' },
                { id: 'SALIDA', label: 'Salidas' },
                { id: 'DEVOLUCION', label: 'Devoluciones' },
                { id: 'AJUSTE', label: 'Ajustes' }
              ].map((t) => (
                <button
                  key={t.id}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filtroTipoMov === t.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setFiltroTipoMov(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setLoadingMovs(true);
                api.getInventoryMovements()
                  .then(data => setMovimientos(data))
                  .finally(() => setLoadingMovs(false));
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 cursor-pointer shadow-2xs"
              title="Refrescar movimientos"
            >
              <span className={`material-symbols-outlined text-sm ${loadingMovs ? 'animate-spin' : ''}`}>sync</span>
              Actualizar
            </button>
          </div>

          {/* Tabla de Movimientos de Inventario */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-3">Fecha &amp; Hora</th>
                    <th className="p-3">Producto / SKU</th>
                    <th className="p-3 text-center">Tipo Movimiento</th>
                    <th className="p-3 text-center">Cantidad</th>
                    <th className="p-3 text-center">Stock (Previo → Nuevo)</th>
                    <th className="p-3">Origen / Referencia</th>
                    <th className="p-3">Responsable</th>
                    <th className="p-3">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingMovs ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-2xl animate-spin text-blue-600 mb-1 block">sync</span>
                        Cargando historial de movimientos...
                      </td>
                    </tr>
                  ) : filteredMovimientos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No se encontraron registros de movimientos de stock para los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredMovimientos.map((m) => {
                      const isEntrada = m.tipo_movimiento === 'ENTRADA';
                      const isSalida = m.tipo_movimiento === 'SALIDA';
                      const isDevolucion = m.tipo_movimiento === 'DEVOLUCION';

                      let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
                      let icon = 'swap_horiz';

                      if (isEntrada) {
                        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        icon = 'arrow_downward';
                      } else if (isSalida) {
                        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        icon = 'arrow_upward';
                      } else if (isDevolucion) {
                        badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                        icon = 'replay';
                      } else {
                        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        icon = 'tune';
                      }

                      const fecha = m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleString('es-PE', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : 'Reciente';

                      return (
                        <tr key={m.id_movimiento} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {fecha}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800 text-xs">{m.producto_nombre}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {m.codigo_sku} {m.categoria && `· ${m.categoria}`}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                              <span className="material-symbols-outlined text-xs">{icon}</span>
                              {m.tipo_movimiento}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-xs">
                            <span className={isEntrada || isDevolucion ? 'text-emerald-600' : 'text-rose-600'}>
                              {isEntrada || isDevolucion ? `+${m.cantidad}` : `-${m.cantidad}`}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-xs">
                            <span className="text-slate-400">{m.existencia_anterior}</span>
                            <span className="text-slate-300 mx-1.5">→</span>
                            <span className="font-bold text-slate-800">{m.existencia_nueva}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">
                              {m.origen || 'Operación'} {m.id_referencia ? `#${m.id_referencia}` : ''}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 text-xs">
                            {m.usuario_nombre || 'Elena Morales'}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate" title={m.observacion}>
                            {m.observacion || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 text-[11px]">
                Total de movimientos registrados en base de datos: <strong className="text-slate-800">{filteredMovimientos.length}</strong>
              </span>
            </div>
          </div>
        </>
      )}

      {/* MODAL: AJUSTE MANUAL DE STOCK (RF-14 / RF-41) */}
      {adjustProduct && (() => {
        const currentStock = adjustProduct.stock !== undefined ? parseInt(adjustProduct.stock, 10) : 0;
        const qtyInt = parseInt(adjustQty, 10) || 0;
        const projectedStock =
          adjustType === 'ENTRADA' || adjustType === 'DEVOLUCION'
            ? currentStock + qtyInt
            : adjustType === 'SALIDA'
            ? currentStock - qtyInt
            : qtyInt;
        const isInvalidOut = adjustType === 'SALIDA' && qtyInt > currentStock;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">tune</span>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">Ajuste Manual de Stock</h3>
                    <p className="text-[10px] text-slate-300">Conteo físico, merma o corrección de existencias</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleAdjustSubmit} className="p-4 space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{adjustProduct.nombre}</p>
                    <p className="font-mono text-[10px] text-slate-400">{adjustProduct.codigo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Stock actual</span>
                    <span className="text-sm font-mono font-extrabold text-slate-900">{currentStock} und.</span>
                  </div>
                </div>

                {adjustError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-base text-rose-600 shrink-0">error</span>
                    <span>{adjustError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                      Tipo de Movimiento *
                    </label>
                    <select
                      id="select-tipo-ajuste"
                      value={adjustType}
                      onChange={(e) => {
                        setAdjustType(e.target.value);
                        setAdjustError('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    >
                      <option value="SALIDA">SALIDA (Merma / Descuento)</option>
                      <option value="ENTRADA">ENTRADA (Ingreso / Hallazgo)</option>
                      <option value="AJUSTE">AJUSTE (Fijar stock exacto)</option>
                      <option value="DEVOLUCION">DEVOLUCION (Retorno a almacén)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                      {adjustType === 'AJUSTE' ? 'Nueva Existencia *' : 'Cantidad *'}
                    </label>
                    <input
                      id="input-cantidad-ajuste"
                      type="number"
                      min="1"
                      required
                      value={adjustQty}
                      onChange={(e) => {
                        setAdjustQty(e.target.value);
                        setAdjustError('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                    Justificación / Motivo *
                  </label>
                  <textarea
                    id="input-justificacion-ajuste"
                    rows={2}
                    required
                    placeholder="Ej. Conteo físico mensual, merma por daño en bodega, devolución de exhibición..."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-indigo-600 focus:outline-none resize-none"
                  />
                </div>

                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-semibold ${
                    isInvalidOut
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <span>Resultado proyectado en almacén:</span>
                  <span className="font-mono font-extrabold">
                    {currentStock} → {isInvalidOut ? 'Insuficiente' : `${projectedStock} und.`}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeAdjustModal}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirmar-ajuste"
                    type="submit"
                    disabled={adjustLoading || isInvalidOut}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">check</span>
                    {adjustLoading ? 'Aplicando...' : 'Aplicar Ajuste'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </section>
  );
};

