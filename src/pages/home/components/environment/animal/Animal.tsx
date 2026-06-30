import "./animal.css";

interface AnimalProps {
  type: string;
  source: string;
  size: string;
  ext: string;
  className?: string;
}

const URL_BASE = "/animals/";

export default function Animal({
  type,
  source,
  size,
  ext,
  className = "",
}: AnimalProps) {
  return (
    <img
      src={`${URL_BASE}${source}${ext}`}
      alt=""
      className={`animal animal-${type} animal-${size} ${className}`}
    />
  );
}
