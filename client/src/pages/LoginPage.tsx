import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Field } from '../components/Field';
import { tintStyle } from '../lib/tint';
import { useAuth } from '../state/AuthContext';

const DEMO_ACCOUNTS = [
  { studentNo: '2021001', name: '林可' },
  { studentNo: '2021002', name: '周小满' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [studentNo, setStudentNo] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await login(studentNo.trim(), name.trim() || undefined);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '登录失败，请稍后重试');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="relative z-10 mx-auto grid min-h-screen max-w-[1180px] grid-cols-[1.05fr_0.95fr] items-center gap-10 px-8 py-16">
      <section>
        <p className="label text-[11px] uppercase tracking-[0.18em] text-muted">
          Campus canteen · pickup
        </p>
        <h1 className="mt-4 font-display text-[54px] leading-[1.03] tracking-display">
          点好菜，
          <br />
          踩着点去取。
        </h1>
        <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-ink-2">
          六个档口、二十多道菜，先看再点。下单后 25 秒内可以反悔，之后按
          「已支付 → 备餐中 → 待取餐 → 已完成」自己往下走，不用一直盯着手机。
        </p>

        <dl className="mt-9 grid max-w-[430px] grid-cols-3 gap-3">
          {[
            { label: '档口', value: '06' },
            { label: '菜品', value: '24' },
            { label: '免配送', value: '¥20' },
          ].map((item) => (
            <div
              key={item.label}
              style={tintStyle(item.label)}
              className="plastic rounded-card px-3 py-2.5"
            >
              <dt className="label text-[10px] uppercase text-ink-2">{item.label}</dt>
              <dd className="mt-1 font-display text-[22px] tabular-nums tracking-display">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card px-7 py-8">
        <h2 className="font-display text-[22px] tracking-display">用学号进店</h2>
        <p className="mt-1 text-[12.5px] text-muted">首次登录自动建档，不需要注册与密码。</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <Field label="学号" htmlFor="studentNo" required hint="6~12 位数字">
            <input
              id="studentNo"
              className="input label"
              inputMode="numeric"
              autoComplete="username"
              placeholder="2021001"
              value={studentNo}
              onChange={(event) => setStudentNo(event.target.value)}
            />
          </Field>

          <Field label="姓名" htmlFor="name" hint="选填">
            <input
              id="name"
              className="input"
              autoComplete="name"
              placeholder="不填则显示为「同学 + 学号后四位」"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-[9px] bg-paper-3 px-3 py-2 text-[12.5px] text-accent-deep">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary h-12 w-full" disabled={pending}>
            {pending ? '正在进店…' : '进店点菜'}
          </button>
        </form>

        <div className="mt-6 border-t border-dashed border-rule pt-4">
          <p className="label text-[10px] uppercase text-muted">演示账号</p>
          <div className="mt-2 flex gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.studentNo}
                type="button"
                className="btn btn--sm flex-1"
                onClick={() => {
                  setStudentNo(account.studentNo);
                  setName(account.name);
                  setError(null);
                }}
              >
                {account.name} · {account.studentNo}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
