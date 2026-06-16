import "./flamingo.css";

interface FlamingoProps {
  source: string;
  size: string;
  ext: string;
}

const URL_BASE = "/";

export default function Flamingo({ source, size, ext }: FlamingoProps) {
  return (
    <img
      src={`${URL_BASE}${source}${ext}`}
      alt=""
      className={`flamingo flamingo-${size}`}
    />
  );
}
