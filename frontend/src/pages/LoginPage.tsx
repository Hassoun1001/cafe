import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { login as loginRequest } from '../api/endpoints';
import { useAuth } from '../lib/auth';
import { apiErrorMessage } from '../lib/api';
import { Button, Input } from '../components/ui';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await loginRequest(password);
      login(token);
      navigate('/pos', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-[380px] rounded-2xl border border-border bg-surface p-10 text-center shadow-[var(--shadow-elevated)]">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-ink text-white">
          <Coffee className="size-6" strokeWidth={2} />
        </div>
        <div className="mb-1.5 text-xl font-bold tracking-tight text-ink">Studio Cafe</div>
        <div className="mb-8 text-sm text-muted">Enter password to continue</div>
        <Input
          type="password"
          autoFocus
          maxLength={20}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 py-3.5 text-center text-xl tracking-[6px]"
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {loading ? 'Checking…' : 'Login'}
        </Button>
        <div className="mt-3 min-h-[20px] text-sm text-danger">{error}</div>
      </form>
    </div>
  );
}
