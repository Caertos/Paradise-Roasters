import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../../components/button/Button";
import AuthLayout from "../../components/form/AuthLayout";
import FormAlert from "../../components/form/FormAlert";
import FormField from "../../components/form/FormField";
import PasswordHint from "../../components/form/PasswordHint";
import { useApiForm } from "../../components/form/useApiForm";
import { resetPassword } from "../../lib/authApi";

import "./reset-password.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { submitting, fieldErrors, error, submit } = useApiForm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(async () => {
      const { message } = await resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmation,
      });
      setNotice(message);
      setPassword("");
      setConfirmation("");
    });
  }

  if (!token) {
    return (
      <AuthLayout
        className="reset-password"
        title="Reset your password"
        subtitle="This reset link is incomplete or invalid."
      >
        <p className="reset-password__text">
          Request a new link and use the most recent email we send you.
        </p>
        <p className="form__links">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      className="reset-password"
      title="Reset your password"
      subtitle="Choose a new password for your account."
    >
      {notice ? (
        <div className="form">
          <FormAlert message={notice} tone="success" />
          <p className="form__links">
            <Link to="/login">Log in with your new password</Link>
          </p>
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit} noValidate>
          <FormAlert message={error} />
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            errors={fieldErrors.email}
            disabled={submitting}
          />
          <FormField
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={setPassword}
            errors={fieldErrors.password}
            disabled={submitting}
            hint={<PasswordHint password={password} />}
          />
          <FormField
            label="Confirm new password"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={setConfirmation}
            errors={fieldErrors.password_confirmation}
            disabled={submitting}
          />
          {fieldErrors.token && (
            <FormAlert message={fieldErrors.token.join(" ")} />
          )}
          <div className="form__actions">
            <Button type="submit" disabled={submitting}>
              Reset password
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
