import React from 'react';
import { useApp } from '../../context/AppContext';
import logoImg from '../../assets/img/logo.png';

export const Sidebar = ({ mobileOpen = false, onCloseMobile = () => {} }) => {
  const {
    currentView,
    setCurrentView,
    openModal,
    showToast,
    hasPermiso,
    isAdmin,
    accessRequests = [],
  } = useApp();

  const pendingRequestsCount = isAdmin
    ? accessRequests.filter((s) => (s.estado || '').toUpperCase() === 'PENDIENTE').length
    : 0;

  const isCurrent = (view) => currentView === view;

  const handleNav = (view, label, requiredPermiso) => {
    if (requiredPermiso && !hasPermiso(requiredPermiso)) {
      showToast(`Acceso restringido: No tienes permiso para acceder a ${label}`, 'warning');
      return;
    }
    setCurrentView(view);
    onCloseMobile();
    showToast(`Módulo: ${label}`, 'tab');
  };

  const renderNavItem = (view, label, icon, requiredPermiso, id, badgeCount = 0) => {
    const allowed = !requiredPermiso || hasPermiso(requiredPermiso);
    const active = isCurrent(view);

    return (
      <button
        key={view}
        id={id}
        onClick={() => handleNav(view, label, requiredPermiso)}
        title={!allowed ? `Acceso restringido (requiere: ${requiredPermiso})` : label}
        className={`nav-btn w-full flex items-center justify-between px-2.5 py-2.5 lg:py-2 rounded-lg font-medium transition-all cursor-pointer ${
          active
            ? 'bg-blue-600 text-white shadow-xs'
            : allowed
            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            : 'text-slate-400 hover:bg-slate-50 opacity-60 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-outlined text-base shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {badgeCount > 0 && allowed && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                active ? 'bg-white text-blue-600' : 'bg-indigo-600 text-white'
              }`}
            >
              {badgeCount}
            </span>
          )}
          {!allowed && (
            <span className="material-symbols-outlined text-[13px] text-slate-400 shrink-0" title="Acceso restringido">
              lock
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Backdrop en móvil / tablet */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] lg:static lg:w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-xl lg:shadow-xs transform transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between gap-2 border-b border-slate-100 select-none">
          <div
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
            onClick={() => handleNav('pos', 'POS', 'ver_pos')}
          >
            <img src={logoImg} alt="NexPOS Logo" className="w-8 h-8 object-contain shrink-0 drop-shadow-xs" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                Nex<span className="text-blue-600">POS</span>
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                RETAIL SUITE &amp; ERP
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Cerrar menú"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3.5 text-xs">
          {/* Operaciones */}
          <div>
            <span className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Operaciones
            </span>
            <div className="space-y-0.5">
              {renderNavItem('pos', 'Terminal POS', 'point_of_sale', 'ver_pos', 'nav-pos')}
              {renderNavItem('caja', 'Facturación & Caja', 'receipt_long', 'ver_caja', 'nav-caja')}
            </div>
          </div>

          {/* Inventario y Compras */}
          <div>
            <span className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Inventario y Compras
            </span>
            <div className="space-y-0.5">
              {renderNavItem('stock', 'Catálogo & Stock', 'inventory_2', 'ver_inventario', 'nav-stock')}
              {renderNavItem('categorias', 'Categorías', 'category', 'ver_inventario', 'nav-categorias')}
              {renderNavItem('proveedores', 'Proveedores', 'local_shipping', 'ver_compras', 'nav-proveedores')}
              {renderNavItem('compras', 'Historial de Compras', 'shopping_bag', 'ver_compras', 'nav-compras')}
            </div>
          </div>

          {/* Gestión Comercial */}
          <div>
            <span className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Gestión Comercial
            </span>
            <div className="space-y-0.5">
              {renderNavItem('clientes', 'Clientes', 'group', 'ver_clientes', 'nav-clientes')}
            </div>
          </div>

          {/* Administración */}
          <div>
            <span className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Administración
            </span>
            <div className="space-y-0.5">
              {renderNavItem('estadisticas', 'Panel de Estadísticas', 'insights', 'ver_auditoria', 'nav-estadisticas')}
              {renderNavItem('empleados', 'Empleados & Permisos', 'badge', 'ver_empleados', 'nav-empleados', pendingRequestsCount)}
              {renderNavItem('auditoria', 'Auditoría del Sistema', 'history_toggle_off', 'ver_auditoria', 'nav-auditoria')}
            </div>
          </div>
        </div>

        {/* Terminal Footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px]">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
            onClick={() => {
              onCloseMobile();
              openModal('turno');
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-700">Terminal 01</span>
          </div>
          <span className="text-slate-400">v4.8.2</span>
        </div>
      </aside>
    </>
  );
};
