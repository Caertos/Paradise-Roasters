import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import "./form.css";

interface FormFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  /** Extra content rendered under the input, e.g. a password checklist. */
  hint?: ReactNode;
}

export default function FormField({
  label,
  name,
  value,
  onChange,
  errors,
  hint,
  type = "text",
  ...rest
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = errors !== undefined && errors.length > 0;

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`form-field__input${hasError ? " form-field__input--invalid" : ""}`}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...rest}
      />
      {hint}
      {hasError && (
        <p id={errorId} className="form-field__error">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}
