import "./animal.css";

interface AnimalProps {
  type: string;
  source: string;
  size: string;
  ext: string;
}

const URL_BASE = "/";

export default function Animal({ type, source, size, ext }: AnimalProps) {
  return (
    <img
      src={`${URL_BASE}${source}${ext}`}
      alt=""
      className={`animal animal-${type} animal-${size}`}
    />
  );
}
