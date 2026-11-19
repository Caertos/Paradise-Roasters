import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import Button from "../../components/button/Button";
import FormAlert from "../../components/form/FormAlert";
import FormField from "../../components/form/FormField";
import PasswordHint from "../../components/form/PasswordHint";
import { useApiForm } from "../../components/form/useApiForm";
import type { User } from "../../lib/api";
import {
  changePassword,
  resendVerificationEmail,
  updateProfile,
  type UpdateProfileInput,
} from "../../lib/authApi";

export function VerificationBanner() {
  const [notice, setNotice] = useState<string | null>(null);
  const { submitting, error, submit } = useApiForm();

  async function handleResend() {
    setNotice(null);
    await submit(async () => {
      const response = await resendVerificationEmail();
      setNotice(
        response?.message ?? "Verification email sent. Check your inbox.",
      );
    });
  }

  return (
    <div className="user-banner" role="region" aria-label="Email verification">
      <p className="user-banner__text">
        Your email address is not verified yet. Check your inbox for the
        verification link.
      </p>
      <Button onClick={handleResend} disabled={submitting}>
        Resend verification email
      </Button>
      <FormAlert message={notice} tone="success" />
      <FormAlert message={error} />
    </div>
  );
}

/**
 * Profile editor. The fields are seeded from `user`, so they are keyed by the
 * editable data: when it changes (a save here, or a refresh elsewhere) the
 * fields remount with the current values, while unrelated re-renders keep the
 * edit in progress. The success notice lives here so it survives that remount.
 */
export function ProfileForm({ user }: { user: User }) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <ProfileFields
      key={`${user.name}|${user.email}|${user.phone}`}
      initialUser={user}
      notice={notice}
      onNotice={setNotice}
    />
  );
}

function ProfileFields({
  initialUser,
  notice,
  onNotice: setNotice,
}: {
  initialUser: User;
  notice: string | null;
  onNotice: (notice: string | null) => void;
}) {
  const { setUser } = useAuth();
  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone ?? "");
  const [email, setEmail] = useState(initialUser.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const { submitting, fieldErrors, error, submit } = useApiForm();

  const emailChanged = email.trim() !== initialUser.email;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    await submit(async () => {
      const input: UpdateProfileInput = {
        name: name.trim(),
        phone: phone.trim() || null,
      };
      if (emailChanged) {
        input.email = email.trim();
        input.current_password = currentPassword;
      }
      const updated = await updateProfile(input);
      setUser(updated);
      setEmail(updated.email);
      setCurrentPassword("");
      setNotice(
        emailChanged
          ? "Profile updated. We sent a verification link to your new email."
          : "Profile updated.",
      );
    });
  }

  return (
    <form
      id="profile-details"
      className="form user-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <h3 className="user-form__title">Profile details</h3>
      <FormAlert message={error} />
      <FormAlert message={notice} tone="success" />
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
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={setPhone}
        errors={fieldErrors.phone}
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
      {emailChanged && (
        <FormField
          label="Current password (required to change your email)"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={setCurrentPassword}
          errors={fieldErrors.current_password}
          disabled={submitting}
        />
      )}
      <div className="form__actions">
        <Button type="submit" disabled={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const { applySession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { submitting, fieldErrors, error, submit } = useApiForm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    await submit(async () => {
      // The backend revokes every session and returns a fresh pair for this one.
      const payload = await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: confirmation,
      });
      applySession(payload);
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      setNotice("Password updated. Your other sessions were signed out.");
    });
  }

  return (
    <form className="form user-form" onSubmit={handleSubmit} noValidate>
      <h3 className="user-form__title">Change password</h3>
      <FormAlert message={error} />
      <FormAlert message={notice} tone="success" />
      <FormField
        label="Current password"
        name="current_password"
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={setCurrentPassword}
        errors={fieldErrors.current_password}
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
      <div className="form__actions">
        <Button type="submit" disabled={submitting}>
          Update password
        </Button>
      </div>
    </form>
  );
}

export function LogoutEverywhere() {
  const { logoutAll } = useAuth();
  const navigate = useNavigate();
  const { submitting, error, submit } = useApiForm();

  async function handleClick() {
    const ok = await submit(logoutAll);
    if (ok) navigate("/login", { replace: true });
  }

  return (
    <div className="user-form user-logout-all">
      <h3 className="user-form__title">Sessions</h3>
      <p className="user-logout-all__text">
        Signed in on a shared or lost device? End every session, including this
        one.
      </p>
      <FormAlert message={error} />
      <Button onClick={handleClick} disabled={submitting}>
        Log out from all devices
      </Button>
    </div>
  );
}
