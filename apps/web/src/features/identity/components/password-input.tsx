import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  readonly toggleLabelShow?: string;
  readonly toggleLabelHide?: string;
};

export function PasswordInput({
  className,
  id,
  toggleLabelShow = 'Show password',
  toggleLabelHide = 'Hide password',
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        className={cn('pr-10', className)}
        id={inputId}
        type={visible ? 'text' : 'password'}
        {...props}
      />
      <button
        aria-controls={inputId}
        aria-label={visible ? toggleLabelHide : toggleLabelShow}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => {
          setVisible((current) => !current);
        }}
        type="button"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
