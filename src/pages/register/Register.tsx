import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { safeRedirect } from "../../auth/redirect";
import { useAuth } from "../../auth/useAuth";
import Button from "../../components/button/Button";
import AuthLayout from "../../components/form/AuthLayout";
import FormAlert from "../../components/form/FormAlert";
import FormField from "../../components/form/FormField";
import PasswordHint from "../../components/form/PasswordHint";
import { useApiForm } from "../../components/form/useApiForm";

import "./register.css";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { submitting, fieldErrors, error, submit } = useApiForm();

  const loginHref = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : "/login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(async () => {
      await register({
        name,
        email,
        password,
        password_confirmation: confirmation,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      navigate(safeRedirect(redirect), { replace: true });
    });
  }

  return (
    <AuthLayout
      className="register"
      title="Create your account"
      subtitle="Join Paradise to track your orders and save your favorites."
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormAlert message={error} />
        <FormField
          label="Name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={setName}
          errors={fieldErrors.name}
          disabled={submitting}
        />
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
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={setPhone}
          errors={fieldErrors.phone}
          disabled={submitting}
        />
        <FormField
          label="Password"
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
          label="Confirm password"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={setConfirmation}
          errors={fieldErrors.password_confirmation}
          disabled={submitting}
        />
        <div className="form__actions">
          <Button type="submit" disabled={submitting}>
            Create account
          </Button>
        </div>
      </form>
      <p className="form__links register__links">
        <span>Already have an account?</span>
        <Link to={loginHref}>Log in</Link>
      </p>
    </AuthLayout>
  );
}
