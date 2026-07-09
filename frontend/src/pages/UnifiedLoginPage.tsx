import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, BookOpen } from 'lucide-react';
import { login as cafeLogin } from '../api/endpoints';
import { login as studyLogin } from '../api/studyEndpoints';
import { useAuth } from '../lib/auth';
import { useStudyAuth } from '../lib/studyAuth';
import { apiErrorMessage } from '../lib/api';
import { Button, Input, Label } from '../components/ui';
import clsx from 'clsx';

type System = 'CAFE' | 'STUDY';

export function UnifiedLoginPage() {
  const [system, setSystem] = useState<System>('CAFE');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: cafeSetToken } = useAuth();
  const { login: studySetToken } = useStudyAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (system === 'CAFE') {
        const { token } = await cafeLogin(username, password);
        cafeSetToken(token);
        navigate('/pos', { replace: true });
      } else {
        const { token } = await studyLogin(username, password);
        studySetToken(token);
        navigate('/study/board', { replace: true });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-10 text-center shadow-[var(--shadow-elevated)]">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-ink text-white">
          {system === 'CAFE' ? <Coffee className="size-6" strokeWidth={2} /> : <BookOpen className="size-6" strokeWidth={2} />}
        </div>
        <div className="mb-1.5 text-xl font-bold tracking-tight text-ink">Studio Cafe</div>
        <div className="mb-6 text-sm text-muted">Choose a system, then sign in</div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-bg p-1">
          <button
            type="button"
            onClick={() => setSystem('CAFE')}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              system === 'CAFE' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <Coffee className="size-4" />
            Cafe
          </button>
          <button
            type="button"
            onClick={() => setSystem('STUDY')}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              system === 'STUDY' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <BookOpen className="size-4" />
            Study Booking
          </button>
        </div>

        <div className="mb-3 text-left">
          <Label>Username</Label>
          <Input autoFocus placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="mb-5 text-left">
          <Label>Password</Label>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {loading ? 'Checking…' : `Login to ${system === 'CAFE' ? 'Cafe' : 'Study Booking'}`}
        </Button>
        <div className="mt-3 min-h-[20px] text-sm text-danger">{error}</div>
      </form>
    </div>
  );
}
