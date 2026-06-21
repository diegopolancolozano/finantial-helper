'use client';

import { useEffect, useState, useCallback } from 'react';
import { movements as movApi, categories as catApi } from '@/lib/api';
import type { Movement, Category, MovementFilters, BudgetAlert } from '@/lib/types';

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}

const EMPTY_FORM = { type: 'expense' as const, amount: '', description: '', categoryId: '', date: new Date().toISOString().slice(0, 10) };

export default function MovementsPage() {
  const [data, setData] = useState<Movement[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<MovementFilters>({ page: 1, limit: 10, order: 'desc', sortBy: 'date' });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [alert, setAlert] = useState<BudgetAlert | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await movApi.list(filters);
    setData(res.data);
    setMeta(res.meta);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { catApi.list().then(setCategories); }, []);

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setAlert(null); setError(''); setShowForm(true); }
  function openEdit(m: Movement) {
    setForm({ type: m.type, amount: String(m.amount), description: m.description, categoryId: m.categoryId, date: m.date.slice(0, 10) });
    setEditId(m.id); setAlert(null); setError(''); setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editId) {
        await movApi.update(editId, payload);
        setShowForm(false);
      } else {
        const res = await movApi.create({ ...payload, categoryId: form.categoryId });
        if (res.budgetAlert) setAlert(res.budgetAlert as BudgetAlert);
        else setShowForm(false);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await movApi.remove(id);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Movimientos</h1>
        <button className="btn-primary" onClick={openCreate}>+ Nuevo</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 140px' }}>
          <label>Tipo</label>
          <select value={filters.type ?? ''} onChange={e => setFilters(f => ({ ...f, type: e.target.value as Movement['type'] || undefined, page: 1 }))}>
            <option value="">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Egresos</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 140px' }}>
          <label>Categoría</label>
          <select value={filters.categoryId ?? ''} onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value || undefined, page: 1 }))}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 130px' }}>
          <label>Desde</label>
          <input type="date" value={filters.dateFrom ?? ''} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} />
        </div>
        <div className="form-group" style={{ flex: '1 1 130px' }}>
          <label>Hasta</label>
          <input type="date" value={filters.dateTo ?? ''} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} />
        </div>
        <button className="btn-ghost" onClick={() => setFilters({ page: 1, limit: 10, order: 'desc', sortBy: 'date' })}>Limpiar</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Fecha</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Descripción</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Categoría</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>Monto</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Sin movimientos</td></tr>
            )}
            {data.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{m.date.slice(0, 10)}</td>
                <td style={{ padding: '10px 14px' }}>{m.description}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{m.category.name}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <span className={m.type === 'income' ? 'badge-income' : 'badge-expense'}>
                    {m.type === 'income' ? '+' : '-'}{fmt(m.amount)}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(m)}>Editar</button>
                  <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(m.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 12 }}>
            <button className="btn-ghost" style={{ padding: '4px 12px' }} disabled={meta.page <= 1} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>‹</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Página {meta.page} de {meta.totalPages} · {meta.total} total</span>
            <button className="btn-ghost" style={{ padding: '4px 12px' }} disabled={meta.page >= meta.totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>›</button>
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 400, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontWeight: 600, marginBottom: 16 }}>{editId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
            {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
            {alert && (
              <div className={alert.level === 'exceeded' ? 'alert-exceeded' : 'alert-warning'} style={{ marginBottom: 12 }}>
                <strong>{alert.level === 'exceeded' ? '⚠ Presupuesto excedido' : '⚠ Cerca del límite'}</strong>
                <br />{alert.categoryName}: {alert.percentage}% usado ({fmt(alert.spentAmount)} / {fmt(alert.budgetAmount)})
              </div>
            )}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}>
                  <option value="expense">Egreso</option>
                  <option value="income">Ingreso</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto (COP)</label>
                <input type="number" min="1" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input type="text" maxLength={200} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
                  <option value="">Selecciona…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
