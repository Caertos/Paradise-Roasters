import Animal from "./Animal";

interface FlamingoProps {
  source: string;
  size: "big" | "medium" | "small" | "x-small";
  ext: ".svg" | ".webp";
  className?: string;
}

export default function Flamingo({
  source,
  size,
  ext,
  className = "flamingo",
}: FlamingoProps) {
  return (
    <Animal
      type="flamingo"
      source={source}
      size={size}
      ext={ext}
      className={className}
    />
  );
}