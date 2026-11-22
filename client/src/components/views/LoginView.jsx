import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logoImg from '../../assets/img/logo.png';
import fondoPOS from '../../assets/img/fondoPOS.png';

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export const LoginView = () => {
  const {
    login,
    loginWithGoogle,
    registerUser,
    oauthLoading,
    oauthError,
    pendingApprovalInfo,
    clearOauthError,
    resendVerification,
  } = useApp();

  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [regNombres, setRegNombres] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCorreo, setRegCorreo] = useState('');
  const [regDoc, setRegDoc] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Shared UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInactiveError, setIsInactiveError] = useState(false);
  const [unverifiedInfo, setUnverifiedInfo] = useState(null);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
    setIsInactiveError(false);
    setUnverifiedInfo(null);
    clearOauthError?.();
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Por favor ingresa tu usuario/correo y contraseña');
      setIsInactiveError(false);
      setUnverifiedInfo(null);
      return;
    }

    setErrorMessage('');
    setIsInactiveError(false);
    setUnverifiedInfo(null);
    clearOauthError?.();
    setIsLoading(true);
    const res = await login(identifier.trim(), password);
    setIsLoading(false);

    if (!res.success) {
      if (res.codigo === 'CORREO_NO_VERIFICADO') {
        setUnverifiedInfo({
          id_empleado: res.id_empleado,
          correo: res.correo,
          verificationUrl: res.verificationUrl,
          message: res.error,
        });
      } else {
        const inactive =
          res.codigo === 'USUARIO_INACTIVO' ||
          res.error?.includes('inactiva') ||
          res.error?.includes('desactivado') ||
          res.error?.includes('INACTIVO');
        setIsInactiveError(inactive);
        setErrorMessage(res.error || 'Credenciales inválidas');
      }
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearOauthError?.();
    setIsInactiveError(false);
    setUnverifiedInfo(null);

    if (!regNombres.trim() || !regApellidos.trim() || !regCorreo.trim() || !regPassword) {
      setErrorMessage('Completa nombres, apellidos, correo electrónico y contraseña.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    const res = await registerUser({
      nombres: regNombres.trim(),
      apellidos: regApellidos.trim(),
      correo: regCorreo.trim(),
      numero_identificacion: regDoc.trim() || undefined,
      password: regPassword,
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'No se pudo completar el registro.');
    } else if (res.pending) {
      setRegNombres('');
      setRegApellidos('');
      setRegCorreo('');
      setRegDoc('');
      setRegPassword('');
      setRegConfirmPassword('');
      setMode('login');
    }
  };

  const handleGoogleClick = async () => {
    setErrorMessage('');
    setIsInactiveError(false);
    setUnverifiedInfo(null);
    await loginWithGoogle();
  };

  const displayError = errorMessage || oauthError;
  const busy = isLoading || oauthLoading;

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4 select-none relative overflow-y-auto"
      style={{ backgroundImage: `url(${fondoPOS})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 overflow-hidden relative z-10 my-4">
        {/* Header Branding */}
        <div className="p-5 pb-4 text-center border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
          <img src={logoImg} alt="NexPOS Logo" className="w-14 h-14 mx-auto mb-2 object-contain drop-shadow-md" />
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Nex<span className="text-blue-600">POS</span> Suite
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            RETAIL SUITE &amp; ERP • SUPABASE CLOUD
          </p>

          {/* Tabs Iniciar Sesión / Registrarse */}
          <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Crear Cuenta
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Botón Google OAuth con Supabase */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={busy}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-300 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 cursor-pointer"
            >
              {oauthLoading ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin text-blue-600">progress_activity</span>
                  <span>Conectando con Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>{mode === 'login' ? 'Continuar con Google' : 'Registrarse con Google'}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center leading-snug">
              Si tu colaborador ya tiene un correo Gmail asignado en el sistema, ingresarás directo con tu rol y permisos.
            </p>
          </div>

          {/* Separador */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              o con correo y contraseña
            </span>
            <div className="border-t border-slate-200 w-full"></div>
          </div>

          {/* Confirmación de Solicitud Enviada al Administrador */}
          {pendingApprovalInfo && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-300 text-indigo-900 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-lg shrink-0">hourglass_top</span>
                <span className="font-bold text-indigo-900">Solicitud de Acceso Pendiente</span>
              </div>
              <p className="text-indigo-800 font-normal text-[11px] leading-snug pl-7">
                {pendingApprovalInfo.message}
              </p>
              <p className="text-[10px] text-indigo-600 pl-7 font-medium">
                El Administrador verá tu solicitud en sus notificaciones para asignarte un rol (Cajero, Supervisor o Admin) o registrarte como Cliente.
              </p>
            </div>
          )}

          {/* Alertas */}
          {unverifiedInfo && (
            <div className="p-3.5 bg-blue-50 border border-blue-300 text-blue-900 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">mark_email_unread</span>
                <span className="font-bold text-blue-900">Verificación de Correo Pendiente</span>
              </div>
              <p className="text-blue-800 font-normal text-[11px] leading-snug pl-7">
                {unverifiedInfo.message}
              </p>
              <div className="flex flex-wrap gap-1.5 pl-7 pt-1">
                {unverifiedInfo.verificationUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(unverifiedInfo.verificationUrl, '_blank')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                    Confirmar mi Correo
                  </button>
                )}
                {unverifiedInfo.id_empleado && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await resendVerification('empleado', unverifiedInfo.id_empleado);
                      if (r?.verificationUrl) {
                        setUnverifiedInfo(prev => ({ ...prev, verificationUrl: r.verificationUrl }));
                      }
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">forward_to_inbox</span>
                    Reenviar Enlace
                  </button>
                )}
              </div>
            </div>
          )}

          {displayError && (
            isInactiveError ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">block</span>
                  <span className="font-bold text-amber-800">Cuenta de Usuario Inactiva</span>
                </div>
                <p className="text-amber-700 font-normal text-[11px] leading-snug pl-7">
                  Tu cuenta ha sido <strong>desactivada por el administrador</strong> y no puede iniciar sesión en el sistema. Contacta a tu supervisor para reactivarla.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <span className="material-symbols-outlined text-base text-rose-600 shrink-0 mt-0.5">error</span>
                <span className="leading-snug">{displayError}</span>
              </div>
            )
          )}

          {mode === 'login' ? (
            <form className="space-y-3.5" onSubmit={handleLoginSubmit}>
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                  Correo Electrónico o Nombre de Usuario
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    person
                  </span>
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all"
                    placeholder="ej. admin o correo@gmail.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px]">Contraseña</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <span>Iniciando sesión...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Ingresar al Sistema</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={handleRegisterSubmit}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Nombres *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Ej. Johan"
                    value={regNombres}
                    onChange={(e) => setRegNombres(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Apellidos *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Ej. Rojas"
                    value={regApellidos}
                    onChange={(e) => setRegApellidos(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                  Correo Electrónico (Gmail o corporativo) *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="tu.correo@gmail.com"
                    value={regCorreo}
                    onChange={(e) => setRegCorreo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                  N° Identificación CC <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="Ej. 1090123456"
                  value={regDoc}
                  onChange={(e) => setRegDoc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Contraseña *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Mín. 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Confirmar *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Repite contraseña"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <span>Creando cuenta...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">person_add</span>
                    <span>Enviar Solicitud de Acceso</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Tu solicitud llegará al <strong>Administrador</strong> para aprobarte con un rol o registrarte como Cliente.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
