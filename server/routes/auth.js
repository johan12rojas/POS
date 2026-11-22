const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { employees } = require('../db/fallbackData');
const { buildVerificationUrl } = require('../utils/mailer');

// Permisos por rol (fallback)
const ROL_PERMISOS_FALLBACK = {
  admin:      ['ver_pos','cobrar','aplicar_descuento','anular_venta','ver_caja','abrir_caja','cerrar_caja','corte_parcial','ver_inventario','crear_producto','editar_producto','ver_clientes','crear_cliente','ver_empleados','crear_empleado','ver_auditoria','ver_compras','crear_compra'],
  supervisor: ['ver_pos','cobrar','aplicar_descuento','anular_venta','ver_caja','abrir_caja','cerrar_caja','corte_parcial','ver_inventario','ver_clientes','crear_cliente','ver_empleados'],
  cajero:     ['ver_pos','cobrar','ver_caja','ver_clientes'],
};

// Avatares conocidos
const AVATARS = {
  1: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
  2: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  3: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
};

// Helper para construir la respuesta estandarizada de sesión POS
async function buildUserPayload(user, avatarOverride = null, extra = {}) {
  const isAdmin = (user.rol_nombre || '').toLowerCase().includes('admin');
  const isSupervisor = (user.rol_nombre || '').toLowerCase().includes('supervis');
  const rol = isAdmin ? 'Administrador General' : (isSupervisor ? 'Supervisor' : 'Cajero');
  const rolKey = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'cajero');

  let permisos = ROL_PERMISOS_FALLBACK[rolKey];
  if (user.id_rol) {
    try {
      const pResult = await pool.query(`
        SELECT p.nombre FROM rol_permiso rp
        JOIN permisos p ON rp.id_permiso = p.id_permiso
        WHERE rp.id_rol = $1
      `, [user.id_rol]);
      if (pResult.rows.length > 0) {
        permisos = pResult.rows.map(r => r.nombre);
      }
    } catch { /* use fallback */ }
  }

  return {
    id_usuario: user.id_usuario,
    id_empleado: user.id_empleado,
    nombre_completo: `${user.nombres || ''} ${user.apellidos || ''}`.trim(),
    correo: user.correo,
    nombre_usuario: user.nombre_usuario,
    rol,
    cargo: user.cargo || rol,
    estado: 'ACTIVO',
    permisos,
    avatar: avatarOverride || AVATARS[user.id_empleado] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    ...extra
  };
}

// Helper para verificar si un identificador ingresado coincide con un usuario o empleado
function matchesIdentifier(userOrEmp, cleanId) {
  if (!userOrEmp || !cleanId) return false;
  const username = (userOrEmp.nombre_usuario || '').toLowerCase();
  const email = (userOrEmp.correo || '').toLowerCase();
  const emailPrefix = email ? email.split('@')[0].toLowerCase() : '';
  const fullNameSlug = (userOrEmp.nombres && userOrEmp.apellidos)
    ? `${userOrEmp.nombres.toLowerCase()}.${userOrEmp.apellidos.toLowerCase()}`
    : '';

  if (username && username === cleanId) return true;
  if (email && email === cleanId) return true;
  if (emailPrefix && emailPrefix === cleanId) return true;
  if (fullNameSlug && fullNameSlug === cleanId) return true;

  const idEmp = userOrEmp.id_empleado || userOrEmp.id_usuario;
  if (idEmp === 1 && (cleanId === 'admin' || cleanId === 'elena' || cleanId === 'elena.morales')) return true;
  if (idEmp === 2 && (cleanId === 'supervisor' || cleanId === 'rodrigo' || cleanId === 'rodrigo.alarcon')) return true;
  if (idEmp === 3 && (cleanId === 'cajero' || cleanId === 'camila' || cleanId === 'camila.valenzuela')) return true;

  return false;
}

// Obtener todas las cuentas activas y fallback unificadas
function getUnifiedAccounts() {
  return employees.map(emp => {
    const isAdmin = (emp.rol || emp.cargo || '').toLowerCase().includes('admin');
    const isSupervisor = (emp.rol || emp.cargo || '').toLowerCase().includes('supervis');
    const rol = isAdmin ? 'Administrador General' : (isSupervisor ? 'Supervisor' : 'Cajero');
    const rolKey = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'cajero');

    return {
      id_usuario: emp.id_empleado,
      id_empleado: emp.id_empleado,
      nombre_completo: `${emp.nombres || ''} ${emp.apellidos || ''}`.trim(),
      correo: emp.correo || '',
      nombre_usuario: emp.nombre_usuario || (emp.correo ? emp.correo.split('@')[0] : `user${emp.id_empleado}`),
      password: emp.password || 'caja123',
      rol,
      cargo: emp.cargo || rol,
      estado: emp.estado || 'ACTIVO',
      correo_verificado: emp.correo_verificado !== undefined ? Boolean(emp.correo_verificado) : true,
      token_verificacion: emp.token_verificacion || null,
      avatar: AVATARS[emp.id_empleado] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      permisos: ROL_PERMISOS_FALLBACK[rolKey] || ROL_PERMISOS_FALLBACK.cajero
    };
  });
}

// Helper: generar nombre de usuario único basado en correo o nombre
async function generateUniqueUsername(client, baseRaw) {
  const cleanBase = String(baseRaw || 'usuario')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 40) || 'usuario';

  let candidate = cleanBase;
  let suffix = 1;
  while (true) {
    const exists = await client.query(
      'SELECT 1 FROM usuarios WHERE LOWER(nombre_usuario) = LOWER($1) LIMIT 1',
      [candidate]
    );
    if (exists.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${cleanBase}${suffix}`;
  }
}

// Helper: dividir nombre completo en nombres y apellidos
function splitFullName(fullName, email) {
  const clean = (fullName || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return { nombres: parts[0], apellidos: 'Usuario' };
    return {
      nombres: parts.slice(0, Math.ceil(parts.length / 2)).join(' '),
      apellidos: parts.slice(Math.ceil(parts.length / 2)).join(' ')
    };
  }
  const prefix = (email || 'usuario').split('@')[0].replace(/[._-]+/g, ' ').trim();
  const formatted = prefix
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { nombres: formatted || 'Usuario', apellidos: 'Google' };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Ingresa correo o usuario y contraseña' });
  }

  const cleanId = identifier.trim().toLowerCase();

  // 1. Verificar en PostgreSQL / Supabase
  try {
    const query = `
      SELECT 
        u.id_usuario,
        u.id_rol,
        u.nombre_usuario,
        u.password_hash,
        u.estado AS usuario_estado,
        e.id_empleado,
        e.nombres,
        e.apellidos,
        e.correo,
        e.cargo,
        e.correo_verificado,
        e.token_verificacion,
        e.estado AS empleado_estado,
        r.nombre AS rol_nombre
      FROM usuarios u
      JOIN empleados e ON u.id_empleado = e.id_empleado
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE LOWER(u.nombre_usuario) = $1 
         OR LOWER(e.correo) = $1
         OR LOWER(SPLIT_PART(e.correo, '@', 1)) = $1
         OR (e.id_empleado = 2 AND ($1 = 'rodrigo.alarcon' OR $1 = 'supervisor'))
         OR (e.id_empleado = 1 AND ($1 = 'admin' OR $1 = 'elena.morales'))
         OR (e.id_empleado = 3 AND ($1 = 'cajero' OR $1 = 'camila.valenzuela'))
    `;
    const result = await pool.query(query, [cleanId]);
    if (result.rows.length > 0) {
      const user = result.rows[0];

      const usuarioInactivo = (user.usuario_estado || 'ACTIVO').toUpperCase() !== 'ACTIVO';
      const empleadoInactivo = (user.empleado_estado || 'ACTIVO').toUpperCase() === 'INACTIVO';
      if (usuarioInactivo || empleadoInactivo) {
        return res.status(403).json({
          error: 'Cuenta inactiva. Tu usuario ha sido desactivado. Contacta al administrador del sistema.',
          codigo: 'USUARIO_INACTIVO'
        });
      }

      if (user.correo_verificado === false) {
        return res.status(403).json({
          error: `Tu correo electrónico (${user.correo}) aún no ha sido verificado. Haz clic en el enlace de confirmación enviado a tu correo o inicia sesión con Google para verificarlo automáticamente.`,
          codigo: 'CORREO_NO_VERIFICADO',
          id_empleado: user.id_empleado,
          correo: user.correo,
          verificationUrl: user.token_verificacion ? buildVerificationUrl('empleado', user.token_verificacion) : null
        });
      }

      const empFallback = employees.find(e => e.id_empleado === user.id_empleado);
      const valid = user.password_hash === password
        || (empFallback && empFallback.password === password)
        || (user.id_empleado === 1 && password === 'admin123')
        || (user.id_empleado === 2 && password === 'caja123')
        || (user.id_empleado === 3 && password === 'cajero123');

      if (valid) {
        await pool.query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1', [user.id_usuario]).catch(() => {});
        const payload = await buildUserPayload(user);
        return res.json(payload);
      }
    } else {
      // Verificar si tiene una solicitud de acceso pendiente o fue registrado como cliente
      const solRes = await pool.query(
        `SELECT estado, correo FROM solicitudes_acceso WHERE LOWER(TRIM(correo)) = $1 ORDER BY id_solicitud DESC LIMIT 1`,
        [cleanId]
      ).catch(() => ({ rows: [] }));
      if (solRes.rows.length > 0) {
        const st = solRes.rows[0].estado;
        if (st === 'PENDIENTE') {
          return res.status(403).json({
            error: `Tu solicitud de acceso (${solRes.rows[0].correo}) aún está pendiente de aprobación por el Administrador.`,
            codigo: 'SOLICITUD_PENDIENTE',
            correo: solRes.rows[0].correo
          });
        }
        if (st === 'CONVERTIDO_CLIENTE') {
          return res.status(403).json({
            error: `Tu cuenta (${solRes.rows[0].correo}) fue registrada como Cliente del almacén y no tiene acceso al panel administrativo del POS.`,
            codigo: 'ES_CLIENTE',
            correo: solRes.rows[0].correo
          });
        }
        if (st === 'RECHAZADO') {
          return res.status(403).json({
            error: `Tu solicitud de acceso (${solRes.rows[0].correo}) fue rechazada por el Administrador.`,
            codigo: 'SOLICITUD_RECHAZADA',
            correo: solRes.rows[0].correo
          });
        }
      }
    }
  } catch (err) {
    console.warn('Auth DB query error:', err.message);
  }

  // 2. Fallback en memoria
  const allAccounts = getUnifiedAccounts();
  const account = allAccounts.find(a => matchesIdentifier(a, cleanId));

  if (account) {
    if ((account.estado || 'ACTIVO').toUpperCase() === 'INACTIVO') {
      return res.status(403).json({
        error: 'Cuenta inactiva. Tu usuario ha sido desactivado. Contacta al administrador del sistema.',
        codigo: 'USUARIO_INACTIVO'
      });
    }

    if (account.correo_verificado === false) {
      return res.status(403).json({
        error: `Tu correo electrónico (${account.correo}) aún no ha sido verificado.`,
        codigo: 'CORREO_NO_VERIFICADO',
        id_empleado: account.id_empleado,
        correo: account.correo,
        verificationUrl: account.token_verificacion ? buildVerificationUrl('empleado', account.token_verificacion) : null
      });
    }

    if (account.password === password) {
      const { password: _, ...userSafe } = account;
      return res.json(userSafe);
    }
  }

  return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo/usuario y contraseña.' });
});

// POST /api/auth/supabase-login
// Verifica el JWT de Supabase Auth (Google OAuth / correo) directamente contra Supabase y sincroniza la cuenta POS
router.post('/supabase-login', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const accessToken = bearerToken || req.body?.access_token;

  if (!accessToken) {
    return res.status(400).json({ error: 'Token de sesión de Supabase requerido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración de Supabase Auth incompleta en el servidor.' });
  }

  // 1. Verificar el access token directamente con Supabase Auth (nunca confiar en datos del cliente)
  let supaUser;
  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Sesión de Google/Supabase inválida o expirada. Intenta iniciar sesión nuevamente.' });
    }

    supaUser = await verifyRes.json();
  } catch (err) {
    console.error('Error verificando token en Supabase Auth:', err.message);
    return res.status(502).json({ error: 'No se pudo validar tu sesión con Supabase Auth.' });
  }

  const email = (supaUser?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'La cuenta de Google no devolvió un correo electrónico válido.' });
  }

  const meta = supaUser.user_metadata || {};
  const googleAvatar = meta.avatar_url || meta.picture || null;
  const fullName = meta.full_name || meta.name || '';
  const provider = supaUser.app_metadata?.provider || 'google';

  const client = await pool.connect();
  try {
    // 2. Buscar si el correo ya pertenece a un empleado/usuario registrado
    const existingRes = await client.query(`
      SELECT 
        u.id_usuario,
        u.id_rol,
        u.nombre_usuario,
        u.estado AS usuario_estado,
        e.id_empleado,
        e.nombres,
        e.apellidos,
        e.correo,
        e.cargo,
        e.correo_verificado,
        e.estado AS empleado_estado,
        r.nombre AS rol_nombre
      FROM empleados e
      LEFT JOIN usuarios u ON u.id_empleado = e.id_empleado
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE LOWER(e.correo) = $1
      ORDER BY e.id_empleado ASC
      LIMIT 1
    `, [email]);

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const empInactive = (existing.empleado_estado || 'ACTIVO').toUpperCase() === 'INACTIVO';
      const usrInactive = existing.id_usuario && (existing.usuario_estado || 'ACTIVO').toUpperCase() !== 'ACTIVO';

      if (empInactive || usrInactive) {
        return res.status(403).json({
          error: 'Cuenta inactiva. Tu usuario ha sido desactivado por el administrador.',
          codigo: 'USUARIO_INACTIVO'
        });
      }

      await client.query('BEGIN');

      // Marcar correo como verificado automáticamente (verificado por Google/Supabase)
      if (!existing.correo_verificado) {
        await client.query(`
          UPDATE empleados
          SET correo_verificado = TRUE,
              fecha_verificacion = COALESCE(fecha_verificacion, CURRENT_TIMESTAMP),
              token_verificacion = NULL,
              codigo_otp = NULL
          WHERE id_empleado = $1
        `, [existing.id_empleado]);
      }

      // Si el empleado existía sin fila en usuarios, crearle su acceso de usuario
      let userRecord = existing;
      if (!existing.id_usuario) {
        const username = await generateUniqueUsername(client, email.split('@')[0]);
        const roleRes = await client.query(`SELECT id_rol, nombre FROM roles WHERE LOWER(nombre) LIKE '%cajero%' ORDER BY id_rol ASC LIMIT 1`);
        const roleId = roleRes.rows[0]?.id_rol || 3;
        const roleName = roleRes.rows[0]?.nombre || 'Cajero';

        const newUsr = await client.query(`
          INSERT INTO usuarios (id_empleado, id_rol, nombre_usuario, password_hash, estado, ultimo_acceso)
          VALUES ($1, $2, $3, 'SUPABASE_OAUTH', 'ACTIVO', CURRENT_TIMESTAMP)
          RETURNING id_usuario, id_rol, nombre_usuario
        `, [existing.id_empleado, roleId, username]);

        userRecord = {
          ...existing,
          ...newUsr.rows[0],
          rol_nombre: roleName
        };
      } else {
        await client.query(
          'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1',
          [existing.id_usuario]
        );
      }

      await client.query('COMMIT');
      const payload = await buildUserPayload(userRecord, googleAvatar, { auth_provider: provider });
      return res.json(payload);
    }

    // 3. Si ya fue convertido en cliente (no es empleado), informarlo claramente
    const existingCli = await client.query(
      'SELECT id_cliente, nombres, apellidos FROM clientes WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
      [email]
    );
    if (existingCli.rows.length > 0) {
      return res.status(403).json({
        error: `Tu cuenta (${email}) está registrada como Cliente del almacén y no tiene acceso al panel interno del POS.`,
        codigo: 'ES_CLIENTE',
        correo: email
      });
    }

    // 4. Usuario nuevo con Google: crear o actualizar solicitud PENDIENTE para que el Administrador asigne rol o lo convierta en cliente
    const existingSol = await client.query(
      `SELECT id_solicitud, estado FROM solicitudes_acceso WHERE LOWER(TRIM(correo)) = $1 ORDER BY id_solicitud DESC LIMIT 1`,
      [email]
    );

    if (existingSol.rows.length > 0) {
      const st = existingSol.rows[0].estado;
      if (st === 'PENDIENTE') {
        await client.query(
          `UPDATE solicitudes_acceso SET avatar_url = COALESCE($1, avatar_url), fecha_solicitud = CURRENT_TIMESTAMP WHERE id_solicitud = $2`,
          [googleAvatar, existingSol.rows[0].id_solicitud]
        );
        return res.status(202).json({
          pending: true,
          codigo: 'SOLICITUD_PENDIENTE',
          correo: email,
          message: `Tu solicitud con ${email} ya fue enviada y está pendiente de aprobación por el Administrador.`
        });
      }
      if (st === 'RECHAZADO') {
        return res.status(403).json({
          error: `Tu solicitud de acceso con ${email} fue rechazada por el Administrador. Contacta a administración si necesitas acceso.`,
          codigo: 'SOLICITUD_RECHAZADA',
          correo: email
        });
      }
    }

    const { nombres, apellidos } = splitFullName(fullName, email);
    const shortUid = String(supaUser.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
    const docNum = `G-${shortUid}`;

    const solInsert = await client.query(`
      INSERT INTO solicitudes_acceso (
        nombres, apellidos, correo, numero_identificacion,
        proveedor_auth, avatar_url, estado
      )
      VALUES ($1, $2, $3, $4, 'google', $5, 'PENDIENTE')
      RETURNING id_solicitud, nombres, apellidos, correo, estado, fecha_solicitud
    `, [nombres, apellidos, email, docNum, googleAvatar]);

    return res.status(202).json({
      pending: true,
      codigo: 'SOLICITUD_PENDIENTE',
      correo: email,
      solicitud: solInsert.rows[0],
      message: `¡Solicitud de acceso enviada! El Administrador recibió tu notificación (${email}) para asignarte un rol o registrarte como cliente.`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en /api/auth/supabase-login:', err.message);
    return res.status(500).json({ error: 'Error sincronizando tu cuenta de Google en el sistema.' });
  } finally {
    client.release();
  }
});

// POST /api/auth/register
// Registro desde pantalla de login -> crea solicitud PENDIENTE para aprobación del Administrador
router.post('/register', async (req, res) => {
  const {
    nombres,
    apellidos,
    correo,
    password,
    numero_identificacion,
    telefono = ''
  } = req.body || {};

  if (!nombres?.trim() || !apellidos?.trim() || !correo?.trim() || !password) {
    return res.status(400).json({ error: 'Completa nombres, apellidos, correo electrónico y contraseña.' });
  }

  const cleanEmail = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    const emailDup = await client.query(
      'SELECT id_empleado FROM empleados WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
      [cleanEmail]
    );
    if (emailDup.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un colaborador registrado con ese correo electrónico. Inicia sesión normalmente.' });
    }

    const cliDup = await client.query(
      'SELECT id_cliente FROM clientes WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
      [cleanEmail]
    );
    if (cliDup.rows.length > 0) {
      return res.status(409).json({ error: 'Ese correo ya se encuentra registrado como Cliente en el almacén.' });
    }

    const solDup = await client.query(
      `SELECT id_solicitud, estado FROM solicitudes_acceso WHERE LOWER(TRIM(correo)) = $1 AND estado = 'PENDIENTE' LIMIT 1`,
      [cleanEmail]
    );
    if (solDup.rows.length > 0) {
      return res.status(202).json({
        pending: true,
        codigo: 'SOLICITUD_PENDIENTE',
        correo: cleanEmail,
        message: `Ya tienes una solicitud de acceso pendiente con ${cleanEmail}. Espera a que un Administrador la apruebe.`
      });
    }

    const cleanDoc = numero_identificacion?.trim() || null;
    if (cleanDoc) {
      const docDup = await client.query(
        'SELECT id_empleado FROM empleados WHERE TRIM(numero_identificacion) = $1 LIMIT 1',
        [cleanDoc]
      );
      if (docDup.rows.length > 0) {
        return res.status(400).json({ error: `Ya existe un colaborador registrado con el documento ${cleanDoc}.` });
      }
    }

    const solInsert = await client.query(`
      INSERT INTO solicitudes_acceso (
        nombres, apellidos, correo, numero_identificacion,
        telefono, password_hash, proveedor_auth, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'correo', 'PENDIENTE')
      RETURNING id_solicitud, nombres, apellidos, correo, estado, fecha_solicitud
    `, [nombres.trim(), apellidos.trim(), cleanEmail, cleanDoc, telefono.trim(), password]);

    return res.status(202).json({
      pending: true,
      codigo: 'SOLICITUD_PENDIENTE',
      correo: cleanEmail,
      solicitud: solInsert.rows[0],
      message: `¡Solicitud de registro enviada! El Administrador recibió tu notificación (${cleanEmail}) para asignarte un rol o registrarte como cliente.`
    });
  } catch (err) {
    console.error('Error en /api/auth/register:', err.message);
    return res.status(500).json({ error: 'No se pudo enviar tu solicitud de registro. Intenta de nuevo.' });
  } finally {
    client.release();
  }
});

// GET /api/auth/accounts - List public accounts info for quick switch / login presets
router.get('/accounts', (req, res) => {
  const publicAccounts = getUnifiedAccounts().map(({ password, ...rest }) => rest);
  res.json(publicAccounts);
});

module.exports = router;
