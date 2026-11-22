const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { registrarOperacion } = require('./auditoria');

const getRoleInfo = (roleName = '') => {
  const r = String(roleName).toLowerCase();
  if (r.includes('admin')) return { id: 1, nombre: 'Administrador General' };
  if (r.includes('supervis')) return { id: 2, nombre: 'Supervisor' };
  return { id: 3, nombre: 'Cajero' };
};

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

async function generateUniqueDoc(client, table, preferredDoc, prefix) {
  const clean = String(preferredDoc || '').trim();
  if (clean) {
    const exists = await client.query(
      `SELECT 1 FROM ${table} WHERE TRIM(numero_identificacion) = $1 LIMIT 1`,
      [clean]
    );
    if (exists.rows.length === 0) return clean;
  }
  let attempt = `${prefix}-${Date.now().toString().slice(-7)}`;
  let counter = 1;
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM ${table} WHERE TRIM(numero_identificacion) = $1 LIMIT 1`,
      [attempt]
    );
    if (exists.rows.length === 0) return attempt;
    counter += 1;
    attempt = `${prefix}-${Date.now().toString().slice(-6)}${counter}`;
  }
}

// GET /api/solicitudes - Listar solicitudes de acceso (pendientes primero)
router.get('/', async (req, res) => {
  const { estado } = req.query;
  try {
    let query = `
      SELECT 
        s.id_solicitud,
        s.nombres,
        s.apellidos,
        s.correo,
        s.numero_identificacion,
        s.telefono,
        s.proveedor_auth,
        s.avatar_url,
        s.estado,
        s.rol_asignado,
        s.id_usuario_revisor,
        s.observacion,
        s.fecha_solicitud,
        s.fecha_revision,
        COALESCE(NULLIF(TRIM(e.nombres || ' ' || e.apellidos), ''), u.nombre_usuario) AS revisor_nombre
      FROM solicitudes_acceso s
      LEFT JOIN usuarios u ON s.id_usuario_revisor = u.id_usuario
      LEFT JOIN empleados e ON u.id_empleado = e.id_empleado
      WHERE 1=1
    `;
    const params = [];
    if (estado && estado !== 'TODAS') {
      params.push(estado.toUpperCase());
      query += ` AND s.estado = $${params.length}`;
    }
    query += ` ORDER BY CASE WHEN s.estado = 'PENDIENTE' THEN 0 ELSE 1 END, s.fecha_solicitud DESC LIMIT 100`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error listando solicitudes:', err.message);
    return res.status(500).json({ error: 'No se pudieron cargar las solicitudes de acceso.' });
  }
});

// POST /api/solicitudes/:id/aprobar-empleado - Aprobar solicitud y asignar rol de empleado
router.post('/:id/aprobar-empleado', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rol = 'Cajero', cargo, id_usuario = 1 } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de solicitud inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solRes = await client.query(
      'SELECT * FROM solicitudes_acceso WHERE id_solicitud = $1 FOR UPDATE',
      [id]
    );
    if (solRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    const sol = solRes.rows[0];
    if (sol.estado !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Esta solicitud ya fue procesada (${sol.estado}).` });
    }

    const cleanEmail = String(sol.correo || '').trim().toLowerCase();
    const roleInfo = getRoleInfo(rol);
    const cargoFinal = (cargo || '').trim() || roleInfo.nombre;

    // Verificar si ya existe un empleado con ese correo
    const existingEmpRes = await client.query(
      'SELECT * FROM empleados WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
      [cleanEmail]
    );

    let empRecord;
    let username;

    if (existingEmpRes.rows.length > 0) {
      empRecord = existingEmpRes.rows[0];
      await client.query(
        `UPDATE empleados SET estado = 'ACTIVO', cargo = $1, correo_verificado = TRUE, fecha_verificacion = COALESCE(fecha_verificacion, CURRENT_TIMESTAMP) WHERE id_empleado = $2`,
        [cargoFinal, empRecord.id_empleado]
      );
      const usrCheck = await client.query('SELECT * FROM usuarios WHERE id_empleado = $1 LIMIT 1', [empRecord.id_empleado]);
      if (usrCheck.rows.length > 0) {
        username = usrCheck.rows[0].nombre_usuario;
        await client.query(
          `UPDATE usuarios SET id_rol = $1, estado = 'ACTIVO' WHERE id_usuario = $2`,
          [roleInfo.id, usrCheck.rows[0].id_usuario]
        );
      } else {
        username = await generateUniqueUsername(client, cleanEmail.split('@')[0]);
        await client.query(
          `INSERT INTO usuarios (id_empleado, id_rol, nombre_usuario, password_hash, estado)
           VALUES ($1, $2, $3, $4, 'ACTIVO')`,
          [empRecord.id_empleado, roleInfo.id, username, sol.password_hash || 'SUPABASE_OAUTH']
        );
      }
    } else {
      const docNum = await generateUniqueDoc(client, 'empleados', sol.numero_identificacion, 'EMP');
      username = await generateUniqueUsername(client, cleanEmail.split('@')[0]);

      const empInsert = await client.query(
        `INSERT INTO empleados (
          tipo_identificacion, numero_identificacion, nombres, apellidos,
          telefono, correo, cargo, correo_verificado, fecha_verificacion,
          estado, fecha_ingreso, fecha_registro
        )
        VALUES ('CC', $1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP, 'ACTIVO', CURRENT_DATE, CURRENT_TIMESTAMP)
        RETURNING *`,
        [docNum, sol.nombres, sol.apellidos, sol.telefono || '', cleanEmail, cargoFinal]
      );
      empRecord = empInsert.rows[0];

      await client.query(
        `INSERT INTO usuarios (id_empleado, id_rol, nombre_usuario, password_hash, estado)
         VALUES ($1, $2, $3, $4, 'ACTIVO')`,
        [empRecord.id_empleado, roleInfo.id, username, sol.password_hash || 'SUPABASE_OAUTH']
      );
    }

    const updatedSolRes = await client.query(
      `UPDATE solicitudes_acceso
       SET estado = 'APROBADO_EMPLEADO',
           rol_asignado = $1,
           id_usuario_revisor = $2,
           fecha_revision = CURRENT_TIMESTAMP
       WHERE id_solicitud = $3
       RETURNING *`,
      [roleInfo.nombre, parseInt(id_usuario, 10) || 1, id]
    );

    await client.query('COMMIT');

    await registrarOperacion({
      id_usuario: parseInt(id_usuario, 10) || 1,
      operacion: 'CREAR',
      tabla_afectada: 'empleados',
      id_registro_afectado: empRecord.id_empleado,
      descripcion: `Solicitud #${id} aprobada como ${roleInfo.nombre}: ${sol.nombres} ${sol.apellidos} (${cleanEmail})`,
      datos_nuevos: { id_solicitud: id, rol: roleInfo.nombre, correo: cleanEmail }
    });

    return res.json({
      solicitud: updatedSolRes.rows[0],
      empleado: {
        ...empRecord,
        rol: roleInfo.nombre,
        nombre_usuario: username,
        correo_verificado: true
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error aprobando solicitud como empleado:', err.message);
    return res.status(500).json({ error: 'Error al aprobar la solicitud: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/solicitudes/:id/convertir-cliente - Convertir solicitud en Cliente registrado (sin acceso al POS)
router.post('/:id/convertir-cliente', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { id_usuario = 1 } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de solicitud inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solRes = await client.query(
      'SELECT * FROM solicitudes_acceso WHERE id_solicitud = $1 FOR UPDATE',
      [id]
    );
    if (solRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    const sol = solRes.rows[0];
    if (sol.estado !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Esta solicitud ya fue procesada (${sol.estado}).` });
    }

    const cleanEmail = String(sol.correo || '').trim().toLowerCase();

    // Si ya existe en clientes, reactivarlo; si no, insertarlo
    const existingCli = await client.query(
      'SELECT * FROM clientes WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
      [cleanEmail]
    );

    let clienteRecord;
    if (existingCli.rows.length > 0) {
      const upd = await client.query(
        `UPDATE clientes SET estado = 'ACTIVO', correo_verificado = TRUE, fecha_verificacion = COALESCE(fecha_verificacion, CURRENT_TIMESTAMP) WHERE id_cliente = $1 RETURNING *`,
        [existingCli.rows[0].id_cliente]
      );
      clienteRecord = upd.rows[0];
    } else {
      const docNum = await generateUniqueDoc(client, 'clientes', sol.numero_identificacion, 'CLI');
      const cliInsert = await client.query(
        `INSERT INTO clientes (
          tipo_identificacion, numero_identificacion, nombres, apellidos,
          telefono, correo, direccion, correo_verificado, fecha_verificacion,
          estado, fecha_registro
        )
        VALUES ('CC', $1, $2, $3, $4, $5, '', TRUE, CURRENT_TIMESTAMP, 'ACTIVO', CURRENT_TIMESTAMP)
        RETURNING *`,
        [docNum, sol.nombres, sol.apellidos, sol.telefono || '', cleanEmail]
      );
      clienteRecord = cliInsert.rows[0];
    }

    const updatedSolRes = await client.query(
      `UPDATE solicitudes_acceso
       SET estado = 'CONVERTIDO_CLIENTE',
           rol_asignado = 'Cliente',
           id_usuario_revisor = $1,
           fecha_revision = CURRENT_TIMESTAMP
       WHERE id_solicitud = $2
       RETURNING *`,
      [parseInt(id_usuario, 10) || 1, id]
    );

    await client.query('COMMIT');

    await registrarOperacion({
      id_usuario: parseInt(id_usuario, 10) || 1,
      operacion: 'CREAR',
      tabla_afectada: 'clientes',
      id_registro_afectado: clienteRecord.id_cliente,
      descripcion: `Solicitud #${id} convertida en Cliente: ${sol.nombres} ${sol.apellidos} (${cleanEmail})`,
      datos_nuevos: { id_solicitud: id, id_cliente: clienteRecord.id_cliente, correo: cleanEmail }
    });

    return res.json({
      solicitud: updatedSolRes.rows[0],
      cliente: {
        ...clienteRecord,
        correo_verificado: true
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error convirtiendo solicitud en cliente:', err.message);
    return res.status(500).json({ error: 'Error al convertir en cliente: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/solicitudes/:id/rechazar - Rechazar solicitud de acceso
router.post('/:id/rechazar', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { observacion = '', id_usuario = 1 } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de solicitud inválido.' });
  }

  try {
    const updRes = await pool.query(
      `UPDATE solicitudes_acceso
       SET estado = 'RECHAZADO',
           observacion = COALESCE(NULLIF($1, ''), 'Rechazada por el administrador'),
           id_usuario_revisor = $2,
           fecha_revision = CURRENT_TIMESTAMP
       WHERE id_solicitud = $3 AND estado = 'PENDIENTE'
       RETURNING *`,
      [String(observacion || '').trim(), parseInt(id_usuario, 10) || 1, id]
    );
    if (updRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud pendiente no encontrada.' });
    }

    await registrarOperacion({
      id_usuario: parseInt(id_usuario, 10) || 1,
      operacion: 'DESACTIVAR',
      tabla_afectada: 'solicitudes_acceso',
      id_registro_afectado: id,
      descripcion: `Solicitud de acceso #${id} rechazada (${updRes.rows[0].correo})`,
      datos_nuevos: updRes.rows[0]
    });

    return res.json({ solicitud: updRes.rows[0] });
  } catch (err) {
    console.error('Error rechazando solicitud:', err.message);
    return res.status(500).json({ error: 'Error al rechazar la solicitud.' });
  }
});

module.exports = router;
