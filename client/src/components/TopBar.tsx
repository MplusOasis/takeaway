import { NavLink } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { useCart } from '../state/CartContext';

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-3 py-1.5 rounded-pill text-sm transition-colors',
    isActive ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-3',
  ].join(' ');

export function TopBar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-accent-ink shadow-moulded font-display text-[15px]"
          >
            食
          </span>
          <div className="leading-tight">
            <div className="font-display text-[17px] tracking-display">校园食堂</div>
            <div className="label text-[10px] uppercase text-muted">到点自取 · 仅用户端</div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            点餐
          </NavLink>
          <NavLink to="/orders" className={navClass}>
            我的订单
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-pill bg-paper-2 px-3 py-1.5">
            <span className="label text-[11px] text-muted">已选</span>
            <span className="label text-sm font-medium tabular-nums text-ink">
              {cart?.count ?? 0} 件
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="label text-[11px] text-muted">{user.studentNo}</div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void logout()}>
                退出
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
