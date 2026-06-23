'use client';

import { useEffect, useState } from 'react';
import { movements as movApi, budgets as budApi } from '@/lib/api';
import type { MovementSummary, BudgetStatus } from '@/lib/types';

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([movApi.summary(), budApi.status()])
      .then(([s, b]) => { setSummary(s); setBudgetStatus(b); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#6b7280' }}>Cargando…</p>;

  return (
    <div>
      <div className="page-header"><h1>Resumen financiero</h1></div>

      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>BALANCE</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: (summary?.balance ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
            {fmt(summary?.balance ?? 0)}
          </p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>INGRESOS</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{fmt(summary?.totalIncome ?? 0)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>EGRESOS</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{fmt(summary?.totalExpense ?? 0)}</p>
        </div>
      </div>

      {/* Budget status */}
      <div className="card">
        <h2 style={{ fontWeight: 600, marginBottom: 14 }}>Presupuestos del mes</h2>
        {budgetStatus.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>No hay presupuestos configurados para este mes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {budgetStatus.map(b => (
              <div key={b.categoryId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{b.categoryName}</span>
                  {b.hasOnlyIncome ? (
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                      Ingresos: {fmt(b.incomeAmount)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {fmt(b.spentAmount)} / {fmt(b.budgetAmount)} · {b.percentage}%
                    </span>
                  )}
                </div>
                {b.hasOnlyIncome ? (
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                    Solo ingresos registrados — los gastos reducen este presupuesto
                  </p>
                ) : (
                  <>
                    <div style={{ height: 8, background: '#e5e7eb', borderRadius: 99 }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${Math.min(b.percentage, 100)}%`,
                        background: b.status === 'exceeded' ? '#dc2626' : b.status === 'warning' ? '#f59e0b' : '#16a34a',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    {b.status !== 'ok' && (
                      <p style={{ fontSize: 12, marginTop: 2, color: b.status === 'exceeded' ? '#dc2626' : '#d97706' }}>
                        {b.status === 'exceeded' ? '⚠ Presupuesto excedido' : '⚠ Cerca del límite (>80%)'}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
