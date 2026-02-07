import type { AccountPreset } from '../model/accountTypes';

interface AccountPresetPickerProps {
  presets: AccountPreset[];
  onSelect: (preset: AccountPreset) => void;
}

export function AccountPresetPicker({ presets, onSelect }: AccountPresetPickerProps) {
  return (
    <div className="account-preset-picker">
      {presets.map((preset) => (
        <button
          key={preset.name}
          type="button"
          className="account-preset-chip"
          onClick={() => onSelect(preset)}
          title={`快速添加: ${preset.name}`}
        >
          <span className="preset-icon">{preset.icon}</span>
          {preset.name}
        </button>
      ))}
    </div>
  );
}
