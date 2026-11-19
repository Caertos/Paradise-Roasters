import "./form.css";

// Mirrors the backend password rules (breach check can only run server-side).
const rules = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "A lowercase letter", test: (v: string) => /\p{Ll}/u.test(v) },
  { label: "An uppercase letter", test: (v: string) => /\p{Lu}/u.test(v) },
  { label: "A number", test: (v: string) => /\p{N}/u.test(v) },
];

export default function PasswordHint({ password }: { password: string }) {
  return (
    <div className="password-hint">
      <ul className="password-hint__list" aria-label="Password requirements">
        {rules.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.label}
              className={`password-hint__rule${met ? " password-hint__rule--met" : ""}`}
            >
              <span aria-hidden="true">{met ? "✓" : "•"}</span> {rule.label}
              <span className="visually-hidden">
                {met ? " (met)" : " (not met)"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="password-hint__note">
        It must not appear in a known data breach.
      </p>
    </div>
  );
}
