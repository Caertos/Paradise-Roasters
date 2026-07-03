import "./button.css";

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
}

export default function Button({ children, className = "" }: ButtonProps) {
  return (
    <button className={`button ${className}`} type="button">
      {children}
    </button>
  );
}
