import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { AppTheme } from '../../shared/types/app';
import './theme-switcher.css';

const OPTIONS: Array<{ value: AppTheme; icon: string; label: string }> = [
  { value: 'system', icon: '🖥️', label: '跟随设备' },
  { value: 'dark', icon: '🌙', label: '暗黑' },
  { value: 'light', icon: '☀️', label: '日间' }
];

export function ThemeSwitcher() {
  const theme = useAppPreferences((s) => s.theme);
  const setTheme = useAppPreferences((s) => s.setTheme);

  return (
    <div className="theme-switcher" aria-label="主题切换">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={theme === option.value ? 'theme-icon-btn active' : 'theme-icon-btn'}
          onClick={() => setTheme(option.value)}
          title={option.label}
          aria-label={option.label}
        >
          <span>{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
