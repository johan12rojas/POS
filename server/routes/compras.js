const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { purchases, providers } = require('../db/fallbackData');
const { registrarOperacion } = require('./auditoria');

// GET /api/compras - Incluye detalle de productos y cantidades recibidas (RF-12)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        p.nombre AS proveedor,
        COALESCE(NULLIF(TRIM(e.nombres || ' ' || e.apellidos), ''), u.nombre_usuario) AS usuario,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id_detalle_compra', dc.id_detalle_compra,
                'id_producto', dc.id_producto,
                'codigo', pr.codigo,
                'producto_nombre', pr.nombre,
                'cantidad', dc.cantidad,
                'costo_unitario', dc.costo_unitario,
                'subtotal', dc.subtotal
              ) ORDER BY dc.id_detalle_compra ASC
            )
            FROM detalle_compra dc
            JOIN productos pr ON dc.id_producto = pr.id_producto
            WHERE dc.id_compra = c.id_compra
          ),
          '[]'::json
        ) AS items
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN empleados e ON u.id_empleado = e.id_empleado
      ORDER BY c.id_compra DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(row => {
      const items = Array.isArray(row.items) ? row.items : [];
      const total_unidades = items.reduce((acc, it) => acc + (parseInt(it.cantidad, 10) || 0), 0);
      return {
        ...row,
        items,
        total_productos: items.length,
        total_unidades
      };
    }));
  } catch (err) {
    console.error('Error fetching compras:', err.message);
    res.json(purchases);
  }
});

// GET /api/compras/:id - Detalle individual de una compra
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const compRes = await pool.query(`
      SELECT 
        c.*,
        p.nombre AS proveedor,
        COALESCE(NULLIF(TRIM(e.nombres || ' ' || e.apellidos), ''), u.nombre_usuario) AS usuario
      FROM compras c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN empleados e ON u.id_empleado = e.id_empleado
      WHERE c.id_compra = $1
    `, [parseInt(id, 10)]);

    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    const itemsRes = await pool.query(`
      SELECT 
        dc.id_detalle_compra,
        dc.id_producto,
        pr.codigo,
        pr.nombre AS producto_nombre,
        dc.cantidad,
        dc.costo_unitario,
        dc.subtotal
      FROM detalle_compra dc
      JOIN productos pr ON dc.id_producto = pr.id_producto
      WHERE dc.id_compra = $1
      ORDER BY dc.id_detalle_compra ASC
    `, [parseInt(id, 10)]);

    const items = itemsRes.rows;
    const total_unidades = items.reduce((acc, it) => acc + (parseInt(it.cantidad, 10) || 0), 0);
    return res.json({
      ...compRes.rows[0],
      items,
      total_productos: items.length,
      total_unidades
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar detalle de compra' });
  }
});

// POST /api/compras - Registrar nueva orden de compra
router.post('/', async (req, res) => {
  const { id_proveedor, items, total, observacion, id_usuario } = req.body;
  if (!id_proveedor || !items || items.length === 0) {
    return res.status(400).json({ error: 'Proveedor e items son requeridos' });
  }

  const usuarioId = parseInt(id_usuario) || 1;

  const client = await pool.connect().catch(() => null);
  if (client) {
    try {
      await client.query('BEGIN');
      const compRes = await client.query(
        `INSERT INTO compras (id_proveedor, id_usuario, subtotal, total, estado)
         VALUES ($1, $2, $3, $4, 'REGISTRADA') RETURNING *`,
        [id_proveedor, usuarioId, total, total]
      );
      const newComp = compRes.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO detalle_compra (id_compra, id_producto, cantidad, costo_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [newComp.id_compra, item.id_producto, item.cantidad, item.costo_unitario, item.subtotal]
        );
        const invPrev = await client.query('SELECT cantidad_actual FROM inventario WHERE id_producto = $1', [item.id_producto]);
        const stockPrevio = invPrev.rows.length > 0 ? parseInt(invPrev.rows[0].cantidad_actual) : 0;
        const nuevoStock = stockPrevio + parseInt(item.cantidad);
        await client.query(
          `UPDATE inventario SET cantidad_actual = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_producto = $2`,
          [nuevoStock, item.id_producto]
        );
        await client.query(
          `INSERT INTO movimientos_inventario
           (id_producto, id_usuario, tipo_movimiento, cantidad, existencia_anterior, existencia_nueva, origen, id_referencia, observacion)
           VALUES ($1, $2, 'ENTRADA', $3, $4, $5, 'COMPRA', $6, $7)`,
          [item.id_producto, usuarioId, item.cantidad, stockPrevio, nuevoStock, newComp.id_compra,
           `Entrada por Orden de Compra #${newComp.id_compra}`]
        );
      }
      await client.query('COMMIT');

      // Datos para auditoria (post-commit, no bloqueante)
      const provRes = await pool.query('SELECT nombre FROM proveedores WHERE id_proveedor = $1', [id_proveedor]).catch(() => ({ rows: [] }));
      const provNombre = provRes.rows[0]?.nombre || `Proveedor #${id_proveedor}`;
      const userRes = await pool.query(
        `SELECT u.nombre_usuario, COALESCE(NULLIF(TRIM(e.nombres || ' ' || e.apellidos), ''), u.nombre_usuario) AS nombre_completo, r.nombre AS rol 
         FROM usuarios u 
         LEFT JOIN empleados e ON u.id_empleado = e.id_empleado
         LEFT JOIN roles r ON u.id_rol = r.id_rol 
         WHERE u.id_usuario = $1`,
        [usuarioId]
      ).catch(() => ({ rows: [] }));
      const usuarioNombre = userRes.rows[0]?.nombre_completo || userRes.rows[0]?.nombre_usuario || 'admin';
      const usuarioRol = userRes.rows[0]?.rol || 'Usuario';

      await registrarOperacion({
        id_usuario: usuarioId,
        usuario: usuarioNombre,
        rol: usuarioRol,
        operacion: 'CREAR',
        tabla_afectada: 'compras',
        id_registro_afectado: newComp.id_compra,
        descripcion: `Orden de compra #OC-${String(newComp.id_compra).padStart(4,'0')} registrada — Proveedor: ${provNombre} — Total: $${parseFloat(total).toFixed(2)} — ${items.length} producto(s)`,
        datos_nuevos: { id_compra: newComp.id_compra, proveedor: provNombre, total: parseFloat(total), items_count: items.length }
      });

      const enrichedItemsRes = await pool.query(`
        SELECT 
          dc.id_detalle_compra,
          dc.id_producto,
          pr.codigo,
          pr.nombre AS producto_nombre,
          dc.cantidad,
          dc.costo_unitario,
          dc.subtotal
        FROM detalle_compra dc
        JOIN productos pr ON dc.id_producto = pr.id_producto
        WHERE dc.id_compra = $1
        ORDER BY dc.id_detalle_compra ASC
      `, [newComp.id_compra]).catch(() => ({ rows: [] }));
      const enrichedItems = enrichedItemsRes.rows || [];
      const totalUnidades = enrichedItems.reduce((acc, it) => acc + (parseInt(it.cantidad, 10) || 0), 0);

      return res.status(201).json({
        ...newComp,
        proveedor: provNombre,
        usuario: usuarioNombre,
        items: enrichedItems,
        total_productos: enrichedItems.length,
        total_unidades: totalUnidades
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('DB error recording purchase:', err.message);
    } finally {
      client.release();
    }
  }

  // Fallback local (sin BD)
  const prov = providers.find(p => p.id_proveedor === parseInt(id_proveedor));
  const provNombre = prov ? prov.nombre : 'Proveedor General';
  const newPurchase = {
    id_compra: purchases.length + 1,
    proveedor: provNombre,
    fecha_compra: new Date().toISOString(),
    total: parseFloat(total || 0),
    estado: 'REGISTRADA',
    observacion: observacion || '',
    usuario: `usuario_${usuarioId}`
  };
  purchases.unshift(newPurchase);

  await registrarOperacion({
    id_usuario: usuarioId,
    usuario: `usuario_${usuarioId}`,
    rol: 'Usuario',
    operacion: 'CREAR',
    tabla_afectada: 'compras',
    id_registro_afectado: newPurchase.id_compra,
    descripcion: `Orden de compra #OC-${String(newPurchase.id_compra).padStart(4,'0')} registrada (local) — Proveedor: ${provNombre} — Total: $${parseFloat(total).toFixed(2)} — ${items.length} producto(s)`,
    datos_nuevos: { proveedor: provNombre, total: parseFloat(total), items_count: items.length }
  }).catch(() => {});

  res.status(201).json(newPurchase);
});

module.exports = router;
