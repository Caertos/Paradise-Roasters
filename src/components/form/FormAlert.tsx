import "./form.css";

interface FormAlertProps {
  message: string | null;
  tone?: "error" | "success";
}

/** Top-level form feedback (e.g. 401/403/429 messages or a success notice). */
export default function FormAlert({ message, tone = "error" }: FormAlertProps) {
  if (!message) return null;
  return (
    <p
      className={`form-alert form-alert--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
