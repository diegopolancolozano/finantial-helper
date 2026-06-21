'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { accessToken } = await auth.register(email, password);
      localStorage.setItem('access_token', accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Crear cuenta</h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
          La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert-error">{error}</div>}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Registrando…' : 'Crear cuenta'}
          </button>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#2563eb' }}>Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
