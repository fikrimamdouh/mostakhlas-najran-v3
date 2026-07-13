interface NajranDialogDetail {
  label: string;
  value: unknown;
}

interface NajranDialogOptions {
  mode?: 'alert' | 'confirm' | 'prompt';
  kind?: 'info' | 'success' | 'warning' | 'danger' | 'error';
  eyebrow?: string;
  title?: string;
  message?: string;
  note?: string;
  details?: NajranDialogDetail[];
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  dismissOnBackdrop?: boolean;
  inputLabel?: string;
  inputType?: 'text' | 'password' | 'number' | 'email' | 'tel';
  defaultValue?: string;
}

interface Window {
  NajranDialogs: {
    version: string;
    open(options: NajranDialogOptions): Promise<boolean | string | null>;
    alert(message: unknown | NajranDialogOptions, options?: NajranDialogOptions): Promise<boolean>;
    confirm(message: unknown, options?: NajranDialogOptions): Promise<boolean>;
    prompt(message: unknown, defaultValue?: unknown, options?: NajranDialogOptions): Promise<string | null>;
  };
}
