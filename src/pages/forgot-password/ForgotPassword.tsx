import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/button/Button";
import AuthLayout from "../../components/form/AuthLayout";
import FormAlert from "../../components/form/FormAlert";
import FormField from "../../components/form/FormField";
import { useApiForm } from "../../components/form/useApiForm";
import { forgotPassword } from "../../lib/authApi";

import "./forgot-password.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { submitting, fieldErrors, error, submit } = useApiForm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    await submit(async () => {
      const { message } = await forgotPassword(email);
      setNotice(message);
    });
  }

  return (
    <AuthLayout
      className="forgot-password"
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a link to reset it."
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormAlert message={error} />
        <FormAlert message={notice} tone="success" />
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
        <div className="form__actions">
          <Button type="submit" disabled={submitting}>
            Send reset link
          </Button>
        </div>
      </form>
      <p className="form__links">
        <span>Remembered it?</span>
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
