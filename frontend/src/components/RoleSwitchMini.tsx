interface Props {
  visible: boolean;
  onClick: () => void;
}

export default function RoleSwitchMini({ visible, onClick }: Props) {
  if (!visible) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
      <button
        onClick={onClick}
        style={{
          background: "none", border: "1.5px solid var(--teal)", color: "var(--teal)",
          borderRadius: 999, padding: "0.32rem 0.85rem", fontSize: 12, fontWeight: 800,
          fontFamily: "Satoshi,sans-serif", cursor: "pointer"
        }}
      >
        🔄 Cambia interfaccia
      </button>
    </div>
  );
}
