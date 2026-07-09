import Animal from "./Animal";

interface FishProps {
  source: string;
  size: "big" | "medium" | "small" | "x-small" | "xx-big";
  className?: string;
}

export default function Fish({ source, size, className = "" }: FishProps) {
  return (
    <Animal
      type="fish"
      source={source}
      size={size}
      ext=".svg"
      className={className}
    />
  );
}