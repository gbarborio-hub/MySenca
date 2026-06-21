export default function Logo({ size = 48 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="MySenca"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
