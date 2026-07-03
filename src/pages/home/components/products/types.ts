export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  tagline: string;
  description: string;
  image: string;
  decorativeImages: string[];
  align: "left" | "right" | "center";
}
