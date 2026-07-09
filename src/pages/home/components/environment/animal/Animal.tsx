import "./animal.css";

type AnimalType = "flamingo" | "fish";
type AnimalSize = "big" | "medium" | "small" | "x-small" | "x-big";
type AnimalExt = ".svg" | ".webp";

interface AnimalProps {
  type: AnimalType;
  source: string;
  size: AnimalSize;
  ext: AnimalExt;
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
      loading="lazy"
      className={`animal animal-${type} animal-${size} ${className}`}
    />
  );
}