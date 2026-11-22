import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/api';
import { formatCOP } from '../../utils/format';

export const ComprasView = () => {
  const { purchases = [], providers = [], openPurchaseModal, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleNewOrder = () => {
    openPurchaseModal();
  };

  const handleViewPurchase = async (ord) => {
    setSelectedPurchase(ord);
    showToast(`Consultando detalle de Compra #OC-2026-${String(ord.id_compra).padStart(4, '0')}`, 'info');
    if (!Array.isArray(ord.items) || ord.items.length === 0) {
      setLoadingDetail(true);
      try {
        const full = await api.getPurchase(ord.id_compra);
        if (full && full.id_compra) {
          setSelectedPurchase(full);
        }
      } catch {
        // mantener datos existentes si falla la recarga
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  // Filtrado de compras (también permite buscar por nombre o código de producto recibido)
  const filteredPurchases = useMemo(() => {
    return purchases.filter((ord) => {
      const q = searchTerm.toLowerCase().trim();
      const items = Array.isArray(ord.items) ? ord.items : [];
      const matchItem = items.some(
        (it) =>
          (it.producto_nombre && it.producto_nombre.toLowerCase().includes(q)) ||
          (it.codigo && it.codigo.toLowerCase().includes(q))
      );

      const matchSearch =
        !q ||
        (ord.proveedor && ord.proveedor.toLowerCase().includes(q)) ||
        String(ord.id_compra || '').includes(q) ||
        (ord.usuario && ord.usuario.toLowerCase().includes(q)) ||
        matchItem;

      const matchStatus =
        statusFilter === 'TODAS' ||
        (ord.estado || 'REGISTRADA').toUpperCase() === statusFilter.toUpperCase();

      return matchSearch && matchStatus;
    });
  }, [purchases, searchTerm, statusFilter]);

  // Métricas
  const totalInvertido = useMemo(() => {
    return purchases.reduce((acc, p) => acc + parseFloat(p.total || 0), 0);
  }, [purchases]);

  return (
    <section className="flex flex-col gap-3 h-full overflow-hidden" id="view-compras">
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">local_shipping</span>
            Historial de Compras &amp; Abastecimiento
          </h2>
          <p className="text-xs text-slate-500">
            Registro de recepciones de mercancías, productos ingresados, costos de compra y auditoría de proveedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            onClick={handleNewOrder}
          >
            <span className="material-symbols-outlined text-sm">add_shopping_cart</span> Nueva Compra
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Invertido (Compras)
            </span>
            <span className="text-lg font-mono font-extrabold text-slate-900">
              {formatCOP(totalInvertido)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">payments</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Órdenes Registradas
            </span>
            <span className="text-lg font-mono font-extrabold text-slate-900">
              {purchases.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">receipt_long</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Proveedores Vinculados
            </span>
            <span className="text-lg font-mono font-extrabold text-slate-900">
              {providers.length || 3}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">business</span>
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por proveedor, producto, SKU, folio #OC o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 mr-1">Estado:</span>
          {['TODAS', 'REGISTRADA', 'ANULADA'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Historial de Compras */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="p-3">Folio Compra</th>
                <th className="p-3">Fecha de Registro</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3">Productos y Cantidades</th>
                <th className="p-3">Registrado Por</th>
                <th className="p-3 text-right">Total ($)</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron órdenes de compra registradas con los filtros indicados.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((ord) => {
                  const isCompleted = (ord.estado || 'REGISTRADA') === 'REGISTRADA';
                  const items = Array.isArray(ord.items) ? ord.items : [];
                  const totalUnidades = ord.total_unidades ?? items.reduce((s, it) => s + (parseInt(it.cantidad, 10) || 0), 0);

                  return (
                    <tr key={ord.id_compra} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        #OC-2026-{String(ord.id_compra).padStart(4, '0')}
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {ord.fecha_compra
                          ? new Date(ord.fecha_compra).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {ord.proveedor || 'Proveedor Mayorista'}
                      </td>
                      <td className="p-3">
                        {items.length > 0 ? (
                          <div className="space-y-0.5 max-w-[260px]">
                            {items.slice(0, 2).map((it, idx) => (
                              <div key={it.id_detalle_compra || idx} className="flex items-center gap-1.5 text-[11px]">
                                <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-bold shrink-0">
                                  {it.cantidad}x
                                </span>
                                <span className="text-slate-700 font-medium truncate" title={it.producto_nombre}>
                                  {it.producto_nombre}
                                </span>
                              </div>
                            ))}
                            {items.length > 2 && (
                              <span className="text-[10px] text-blue-600 font-semibold">
                                +{items.length - 2} producto(s) más · {totalUnidades} und. totales
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Ver detalle</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                          {ord.usuario || 'Elena Morales'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-blue-700 text-sm whitespace-nowrap">
                        {formatCOP(ord.total || 0)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {ord.estado || 'REGISTRADA'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleViewPurchase(ord)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ml-auto shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-xs">visibility</span>
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Compra con Productos y Cantidades Recibidas (RF-12) */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">receipt_long</span>
                <span className="font-bold text-sm">
                  Detalle de Compra #OC-2026-{String(selectedPurchase.id_compra).padStart(4, '0')}
                </span>
              </div>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Proveedor</span>
                  <span className="font-bold text-slate-800">{selectedPurchase.proveedor}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Recibido Por</span>
                  <span className="font-bold text-slate-800">{selectedPurchase.usuario || 'Elena Morales'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha y Hora</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {selectedPurchase.fecha_compra ? new Date(selectedPurchase.fecha_compra).toLocaleString('es-CO') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Estado</span>
                  <span className="font-bold text-emerald-600">{selectedPurchase.estado}</span>
                </div>
              </div>

              {/* Tabla de Productos y Cantidades Recibidas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-600">inventory_2</span>
                    Mercancía Recibida
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    {(selectedPurchase.items || []).length} producto(s) ·{' '}
                    {(selectedPurchase.items || []).reduce((acc, it) => acc + (parseInt(it.cantidad, 10) || 0), 0)} und. totales
                  </span>
                </div>

                {loadingDetail ? (
                  <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    Cargando productos recibidos...
                  </div>
                ) : (selectedPurchase.items || []).length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    No se encontraron ítems registrados para esta orden de compra.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5 text-center">Cant. Recibida</th>
                        <th className="p-2.5 text-right">Costo Unit.</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedPurchase.items || []).map((it, idx) => (
                        <tr key={it.id_detalle_compra || idx} className="hover:bg-slate-50/70">
                          <td className="p-2.5">
                            <span className="font-bold text-slate-800 block">{it.producto_nombre}</span>
                            {it.codigo && (
                              <span className="font-mono text-[10px] text-slate-400">{it.codigo}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono font-bold">
                              +{it.cantidad} und.
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600">
                            {formatCOP(it.costo_unitario || 0)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCOP(it.subtotal || (it.cantidad * it.costo_unitario) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <span className="font-bold text-blue-900 text-xs">Monto Total de Compra:</span>
                <span className="text-base font-mono font-extrabold text-blue-900">
                  {formatCOP(selectedPurchase.total || 0)}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Las existencias de esta compra fueron ingresadas y asentadas en la tabla movimientos_inventario (Kardex).
              </p>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
