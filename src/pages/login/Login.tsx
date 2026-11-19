import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { safeRedirect } from "../../auth/redirect";
import { useAuth } from "../../auth/useAuth";
import Button from "../../components/button/Button";
import AuthLayout from "../../components/form/AuthLayout";
import FormAlert from "../../components/form/FormAlert";
import FormField from "../../components/form/FormField";
import { useApiForm } from "../../components/form/useApiForm";

import "./login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submitting, fieldErrors, error, submit } = useApiForm();

  const registerHref = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}`
    : "/register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(async () => {
      await login(email, password);
      navigate(safeRedirect(redirect), { replace: true });
    });
  }

  return (
    <AuthLayout
      className="login"
      title="Welcome back"
      subtitle="Log in to manage your profile, orders, and preferences."
    >
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
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          errors={fieldErrors.password}
          disabled={submitting}
        />
        <div className="form__actions">
          <Button type="submit" disabled={submitting}>
            Log in
          </Button>
          <Link className="form-link login__forgot" to="/forgot-password">
            Forgot your password?
          </Link>
        </div>
      </form>
      <p className="form__links">
        <span>New to Paradise?</span>
        <Link to={registerHref}>Create an account</Link>
      </p>
    </AuthLayout>
  );
}
