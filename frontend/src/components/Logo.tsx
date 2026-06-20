export default function Logo({ size = 48 }: { size?: number }) {
  return (
    <img
      src="https://raw.githubusercontent.com/gbarborio-hub/senca-hub/main/www.senca.it.svg"
      alt="Senca"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
