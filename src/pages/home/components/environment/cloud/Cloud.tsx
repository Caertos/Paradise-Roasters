import "./cloud.css";

interface CloudProps {
  source: "cloud1" | "cloud2" | "cloud3" | "cloud4";
}

const URL_BASE = "/clouds/";

export default function Cloud({ source }: CloudProps) {
  return (
    <img
      src={`${URL_BASE}${source}.svg`}
      alt=""
      loading="lazy"
      className={`cloud ${source}`}
    />
  );
}