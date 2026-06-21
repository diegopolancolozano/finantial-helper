'use client';

import { useEffect, useState } from 'react';
import { categories as catApi, budgets as budApi } from '@/lib/api';
import type { Category, BudgetStatus } from '@/lib/types';

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}

const now = new Date();

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [budgetEdit, setBudgetEdit] = useState<{ categoryId: string; amount: string } | null>(null);
  const [error, setError] = useState('');

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  async function load() {
    const [c, b] = await Promise.all([catApi.list(), budApi.status(month, year)]);
    setCats(c); setBudgets(b);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await catApi.create(newName.trim());
      setNewName('');
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    try {
      await catApi.update(id, editName.trim());
      setEditId(null); setEditName('');
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar categoría? Los movimientos pasados se conservan.')) return;
    await catApi.remove(id);
    load();
  }

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetEdit) return;
    try {
      await budApi.set(budgetEdit.categoryId, Number(budgetEdit.amount), month, year);
      setBudgetEdit(null);
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
  }

  function getBudget(categoryId: string) {
    return budgets.find(b => b.categoryId === categoryId);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Categorías y presupuestos</h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
        Presupuestos del mes: <strong>{new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(now)}</strong>
      </p>

      {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Create form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontWeight: 600, marginBottom: 12 }}>Nueva categoría</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" placeholder="Nombre (ej. Alimentación)" minLength={2} maxLength={50}
            value={newName} onChange={e => setNewName(e.target.value)} required
          />
          <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Crear</button>
        </form>
      </div>

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cats.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin categorías. Crea una arriba.</p>}
        {cats.map(cat => {
          const bud = getBudget(cat.id);
          return (
            <div key={cat.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: bud ? 10 : 0 }}>
                {editId === cat.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1 }} autoFocus />
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleUpdate(cat.id)}>Guardar</button>
                    <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setEditId(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 500 }}>{cat.name}</span>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>Renombrar</button>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setBudgetEdit({ categoryId: cat.id, amount: String(bud?.budgetAmount ?? '') })}>
                      {bud ? 'Editar presupuesto' : 'Asignar presupuesto'}
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(cat.id)}>Eliminar</button>
                  </>
                )}
              </div>

              {/* Budget bar */}
              {bud && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Gastado: {fmt(bud.spentAmount)}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Presupuesto: {fmt(bud.budgetAmount)} · {bud.percentage}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.min(bud.percentage, 100)}%`,
                      background: bud.status === 'exceeded' ? '#dc2626' : bud.status === 'warning' ? '#f59e0b' : '#16a34a',
                    }} />
                  </div>
                  {bud.status !== 'ok' && (
                    <p style={{ fontSize: 11, color: bud.status === 'exceeded' ? '#dc2626' : '#d97706', marginTop: 2 }}>
                      {bud.status === 'exceeded' ? '⚠ Excedido' : '⚠ Cerca del límite'}
                    </p>
                  )}
                </div>
              )}

              {/* Budget form inline */}
              {budgetEdit?.categoryId === cat.id && (
                <form onSubmit={handleSetBudget} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="number" min="1" step="1" placeholder="Monto presupuesto (COP)"
                    value={budgetEdit.amount}
                    onChange={e => setBudgetEdit(b => b ? { ...b, amount: e.target.value } : null)}
                    required style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '6px 12px' }}>Guardar</button>
                  <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setBudgetEdit(null)}>Cancelar</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
