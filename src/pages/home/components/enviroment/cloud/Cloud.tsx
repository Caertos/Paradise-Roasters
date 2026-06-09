import "./cloud.css";

interface CloudProps {
  source: string;
}

const URL_BASE = "/clouds/";

export default function Cloud({ source }: CloudProps) {
  return (
    <img
      src={`${URL_BASE}${source}.svg`}
      alt="Cloud"
      className={`nube ${source}`}
    />
  );
}
