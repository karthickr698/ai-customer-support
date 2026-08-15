import { type FormEvent } from 'react';

export function IdentifyForm({
  title,
  name,
  email,
  error,
  required,
  onNameChange,
  onEmailChange,
  onSubmit,
}: {
  readonly title: string;
  readonly name: string;
  readonly email: string;
  readonly error: string | null;
  readonly required: boolean;
  readonly onNameChange: (value: string) => void;
  readonly onEmailChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="flex flex-1 flex-col justify-center gap-3 px-4 py-6" onSubmit={submit}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {required
            ? 'Share your name and email so we can continue this conversation.'
            : 'Add your contact details so we can follow up if needed.'}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="acs-name">
          Name
        </label>
        <input
          autoComplete="name"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          id="acs-name"
          onChange={(event) => {
            onNameChange(event.target.value);
          }}
          required={required}
          value={name}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="acs-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          id="acs-email"
          onChange={(event) => {
            onEmailChange(event.target.value);
          }}
          required={required}
          type="email"
          value={email}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="mt-1 h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        type="submit"
      >
        Start chat
      </button>
    </form>
  );
}
