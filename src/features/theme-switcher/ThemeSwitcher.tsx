import { useCallback } from 'react';
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

  const handleThemeChange = useCallback((newTheme: AppTheme) => {
    // 添加平滑过渡类
    document.body.classList.add('theme-transition');
    
    // 切换主题
    setTheme(newTheme);
    
    // 延迟移除过渡类，让动画完成
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 500);
  }, [setTheme]);

  return (
    <div className="theme-switcher" aria-label="主题切换">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={theme === option.value ? 'theme-icon-btn active' : 'theme-icon-btn'}
          onClick={() => handleThemeChange(option.value)}
          title={option.label}
          aria-label={option.label}
        >
          <span>{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
