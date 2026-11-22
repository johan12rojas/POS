import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import cajeroImg from '../../assets/img/cajero.webp';
import adminImg from '../../assets/img/admin.webp';
import superImg from '../../assets/img/super.webp';

const getRoleAvatar = (rol = '') => {
  const r = rol.toLowerCase();
  if (r.includes('super')) return superImg;
  if (r.includes('admin')) return adminImg;
  return cajeroImg;
};

export const EmpleadosView = () => {
  const {
    employees,
    openModal,
    openDetailEmployee,
    openEditEmployee,
    openDeactivateEmployee,
    resendVerification,
    refreshVerificationStatus,
    accessRequests = [],
    refreshAccessRequests,
    empleadosInitialTab,
    setEmpleadosInitialTab,
    approveAccessRequestAsEmployee,
    convertAccessRequestToClient,
    rejectAccessRequest,
    isAdmin,
    hasPermiso
  } = useApp();

  const [activeTab, setActiveTab] = useState(empleadosInitialTab || 'colaboradores'); // 'colaboradores' | 'solicitudes'
  const [filterEstado, setFilterEstado] = useState('ACTIVO');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado de solicitudes
  const [reqFilter, setReqFilter] = useState('PENDIENTE'); // 'PENDIENTE' | 'TODAS'
  const [selectedRoles, setSelectedRoles] = useState({});
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (empleadosInitialTab && isAdmin) {
      setActiveTab(empleadosInitialTab);
      if (empleadosInitialTab === 'solicitudes') {
        refreshAccessRequests?.();
      }
      setEmpleadosInitialTab?.('colaboradores');
    }
  }, [empleadosInitialTab, isAdmin, refreshAccessRequests, setEmpleadosInitialTab]);

  const getRoleBadge = (role = '') => {
    if (role.includes('Admin')) return { dot: '#6b7280', label: 'Admin' };
    if (role.includes('Supervis')) return { dot: '#9ca3af', label: 'Supervisor' };
    return { dot: '#d1d5db', label: 'Cajero' };
  };

  const filtered = employees.filter((emp) => {
    const estado = (emp.estado || 'ACTIVO').toUpperCase();
    const matchEstado = filterEstado === 'TODOS' || estado === filterEstado;
    const q = searchTerm.trim().toLowerCase();
    const matchSearch =
      !q ||
      (emp.nombres && emp.nombres.toLowerCase().includes(q)) ||
      (emp.apellidos && emp.apellidos.toLowerCase().includes(q)) ||
      (emp.rol && emp.rol.toLowerCase().includes(q)) ||
      (emp.cargo && emp.cargo.toLowerCase().includes(q)) ||
      (emp.correo && emp.correo.toLowerCase().includes(q)) ||
      (emp.numero_identificacion && emp.numero_identificacion.includes(q));
    return matchEstado && matchSearch;
  });

  const activeCount = employees.filter(e => (e.estado || 'ACTIVO').toUpperCase() === 'ACTIVO').length;
  const inactiveCount = employees.filter(e => (e.estado || 'ACTIVO').toUpperCase() === 'INACTIVO').length;
  const pendingRequests = (accessRequests || []).filter(s => (s.estado || '').toUpperCase() === 'PENDIENTE');
  const filteredRequests = reqFilter === 'PENDIENTE' ? pendingRequests : (accessRequests || []);

  const handleApprove = async (reqItem) => {
    const rol = selectedRoles[reqItem.id_solicitud] || 'Cajero';
    setProcessingId(reqItem.id_solicitud);
    await approveAccessRequestAsEmployee(reqItem.id_solicitud, rol, rol);
    setProcessingId(null);
  };

  const handleConvertClient = async (reqItem) => {
    setProcessingId(reqItem.id_solicitud);
    await convertAccessRequestToClient(reqItem.id_solicitud);
    setProcessingId(null);
  };

  const handleReject = async (reqItem) => {
    setProcessingId(reqItem.id_solicitud);
    await rejectAccessRequest(reqItem.id_solicitud, 'Solicitud rechazada desde el panel de Administración');
    setProcessingId(null);
  };

  return (
    <section className="flex flex-col gap-3 h-full overflow-y-auto pr-1" id="view-empleados">
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-500" style={{fontSize:'18px'}}>badge</span>
              Colaboradores &amp; Usuarios del Sistema
            </h2>
            {isAdmin && pendingRequests.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('solicitudes');
                  refreshAccessRequests?.();
                }}
                className="px-2.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-bold rounded-full border border-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                {pendingRequests.length} solicitud{pendingRequests.length > 1 ? 'es' : ''} pendiente{pendingRequests.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeCount} activo{activeCount !== 1 ? 's' : ''}
            {inactiveCount > 0 && ` · ${inactiveCount} inactivo${inactiveCount !== 1 ? 's' : ''}`}
            {' · '}Los colaboradores creados por el administrador quedan activos de inmediato
          </p>

          {/* Tabs (para Admin: Colaboradores + Solicitudes de Acceso) */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('colaboradores')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'colaboradores'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">group</span>
                Colaboradores ({employees.length})
              </button>
              <button
                type="button"
                id="tab-solicitudes-acceso"
                onClick={() => {
                  setActiveTab('solicitudes');
                  refreshAccessRequests?.();
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'solicitudes'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">notifications_active</span>
                Solicitudes de Acceso
                {pendingRequests.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'solicitudes' ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && activeTab === 'solicitudes' && (
            <button
              type="button"
              onClick={() => refreshAccessRequests?.()}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Actualizar
            </button>
          )}
          {hasPermiso('crear_empleado') && (
            <button
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              onClick={() => openModal('new-user')}
              id="btn-new-employee"
            >
              <span className="material-symbols-outlined" style={{fontSize:'15px'}}>person_add</span>
              Nuevo colaborador
            </button>
          )}
        </div>
      </div>

      {/* BANDEJA DE SOLICITUDES DE ACCESO (ADMIN) */}
      {isAdmin && activeTab === 'solicitudes' ? (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="material-symbols-outlined text-indigo-600 text-base">admin_panel_settings</span>
              <span>
                Aprueba nuevos usuarios asignándoles un <strong>rol de empleado</strong>, conviértelos en <strong>Cliente</strong> del almacén o rechaza la solicitud.
              </span>
            </div>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setReqFilter('PENDIENTE')}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  reqFilter === 'PENDIENTE' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setReqFilter('TODAS')}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  reqFilter === 'TODAS' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial ({accessRequests.length})
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">inbox</span>
              <p className="text-xs font-semibold text-slate-600">
                {reqFilter === 'PENDIENTE'
                  ? 'No hay solicitudes de acceso pendientes en este momento.'
                  : 'Aún no se han registrado solicitudes de acceso.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Cuando alguien cree una cuenta o ingrese con un correo de Google nuevo, aparecerá aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredRequests.map((reqItem) => {
                const isPending = (reqItem.estado || '').toUpperCase() === 'PENDIENTE';
                const isBusy = processingId === reqItem.id_solicitud;
                const chosenRole = selectedRoles[reqItem.id_solicitud] || 'Cajero';

                const statusConfig = {
                  PENDIENTE: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Pendiente de revisión' },
                  APROBADO_EMPLEADO: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: `Aprobado (${reqItem.rol_asignado || 'Empleado'})` },
                  CONVERTIDO_CLIENTE: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Convertido en Cliente' },
                  RECHAZADO: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Rechazado' },
                }[reqItem.estado] || { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: reqItem.estado };

                return (
                  <div
                    key={reqItem.id_solicitud}
                    className={`bg-white rounded-xl border p-4 space-y-3 text-xs shadow-2xs ${
                      isPending ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {reqItem.avatar_url ? (
                          <img
                            src={reqItem.avatar_url}
                            alt={reqItem.nombres}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
                            {(reqItem.nombres || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {reqItem.nombres} {reqItem.apellidos}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">mail</span>
                            {reqItem.correo}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.bg}`}>
                          {statusConfig.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {reqItem.proveedor_auth === 'google' ? 'Google OAuth' : 'Registro web'} ·{' '}
                          {reqItem.fecha_solicitud
                            ? new Date(reqItem.fecha_solicitud).toLocaleString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : ''}
                        </span>
                      </div>
                    </div>

                    {reqItem.numero_identificacion && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs text-slate-400">badge</span>
                        <span>Documento: <strong className="font-mono text-slate-700">{reqItem.numero_identificacion}</strong></span>
                      </div>
                    )}

                    {isPending ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <select
                            value={chosenRole}
                            onChange={(e) =>
                              setSelectedRoles(prev => ({ ...prev, [reqItem.id_solicitud]: e.target.value }))
                            }
                            disabled={isBusy}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="Cajero">Rol: Cajero</option>
                            <option value="Supervisor">Rol: Supervisor</option>
                            <option value="Administrador General">Rol: Administrador General</option>
                          </select>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleApprove(reqItem)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-sm">verified_user</span>
                            Aprobar Rol
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConvertClient(reqItem)}
                            className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">storefront</span>
                            Convertir en Cliente
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReject(reqItem)}
                            className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 text-[10.5px] text-slate-500 flex items-center justify-between">
                        <span>
                          Revisado por: <strong>{reqItem.revisor_nombre || 'Administrador'}</strong>
                        </span>
                        {reqItem.fecha_revision && (
                          <span className="font-mono">
                            {new Date(reqItem.fecha_revision).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Banner de aviso si hay solicitudes pendientes */}
          {isAdmin && pendingRequests.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 px-3 flex items-center justify-between gap-2 text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-base">person_add</span>
                <span>
                  Tienes <strong>{pendingRequests.length} solicitud{pendingRequests.length > 1 ? 'es' : ''} de acceso</strong> pendiente{pendingRequests.length > 1 ? 's' : ''} por asignar rol o convertir en cliente.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('solicitudes');
                  refreshAccessRequests?.();
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer shrink-0"
              >
                Revisar Solicitudes
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{fontSize:'15px'}}>search</span>
              <input
                className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                placeholder="Buscar por nombre, rol, correo o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
              {['ACTIVO', 'INACTIVO', 'TODOS'].map((est) => (
                <button
                  key={est}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filterEstado === est
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setFilterEstado(est)}
                >
                  {est.charAt(0) + est.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 py-12 gap-2">
              <span className="material-symbols-outlined text-3xl text-slate-300">manage_accounts</span>
              <p className="text-xs">Sin colaboradores que coincidan con los filtros</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 text-xs" id="team-cards-grid">
              {filtered.map((emp) => {
                const role = emp.rol || emp.cargo || 'Cajero';
                const { dot, label } = getRoleBadge(role);
                const isActive = (emp.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';
                const isVerified = emp.correo_verificado !== undefined ? Boolean(emp.correo_verificado) : true;

                return (
                  <div
                    key={emp.id_empleado}
                    className={`bg-white rounded-xl border p-3.5 space-y-3 transition-opacity ${
                      !isActive ? 'opacity-55 border-slate-200' : isVerified ? 'border-slate-200' : 'border-amber-200 bg-amber-50/15'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden border-2 border-slate-200 shadow-sm">
                        <img
                          src={getRoleAvatar(emp.rol || emp.cargo)}
                          alt={emp.rol || 'empleado'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">
                          {emp.nombres} {emp.apellidos || ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                          <span className="text-[10px] text-slate-500">{label}</span>
                          {!isActive && (
                            <span className="text-[10px] text-slate-400 border border-slate-200 px-1 rounded">inactivo</span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border flex items-center gap-0.5 ${
                              isVerified
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>
                              {isVerified ? 'verified' : 'mark_email_unread'}
                            </span>
                            {isVerified ? 'Habilitado' : 'Sin Verificar'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    {emp.correo && (
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                        <span className="material-symbols-outlined" style={{fontSize:'12px'}}>mail</span>
                        {emp.correo}
                      </p>
                    )}

                    {/* Acciones de verificación de correo si aún hubiera alguno antiguo pendiente */}
                    {!isVerified && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-amber-800 font-semibold truncate">
                          Acceso bloqueado hasta verificar
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {emp.verificationUrl && (
                            <button
                              type="button"
                              onClick={() => window.open(emp.verificationUrl, '_blank')}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Confirmar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => resendVerification('empleado', emp.id_empleado)}
                            className="p-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer"
                            title="Reenviar enlace al correo"
                          >
                            <span className="material-symbols-outlined text-xs">forward_to_inbox</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => refreshVerificationStatus('empleado', emp.id_empleado)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                            title="Actualizar estado"
                          >
                            <span className="material-symbols-outlined text-xs">sync</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Usuario de acceso — solo visible para admin */}
                    {isAdmin && emp.nombre_usuario && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="material-symbols-outlined text-slate-400" style={{fontSize:'12px'}}>manage_accounts</span>
                        <span className="text-[10px] text-slate-500">Usuario:</span>
                        <span className="text-[10px] font-mono font-semibold text-slate-700">{emp.nombre_usuario}</span>
                      </div>
                    )}
                    {isAdmin && !emp.nombre_usuario && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="material-symbols-outlined text-amber-500" style={{fontSize:'12px'}}>warning</span>
                        <span className="text-[10px] text-amber-600">Sin usuario de acceso asignado</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-slate-100" />

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openDetailEmployee(emp)}
                        className="flex-1 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium text-[10px] cursor-pointer"
                      >
                        <span className="material-symbols-outlined" style={{fontSize:'12px'}}>visibility</span>
                        Consultar
                      </button>
                      {(isAdmin || hasPermiso('modificar_empleado')) && (
                        <button
                          onClick={() => openEditEmployee(emp)}
                          className="flex-1 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium text-[10px] cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{fontSize:'12px'}}>edit</span>
                          Modificar
                        </button>
                      )}
                      {hasPermiso('desactivar_empleado') && (
                        <button
                          onClick={() => openDeactivateEmployee(emp)}
                          className="flex-1 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium text-[10px] cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{fontSize:'12px'}}>
                            {isActive ? 'person_off' : 'how_to_reg'}
                          </span>
                          {isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
