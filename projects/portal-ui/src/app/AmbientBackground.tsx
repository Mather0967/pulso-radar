// Fondo ambiente de la capa fija (orbes y grilla). Solo decorativo: aria-hidden y sin eventos.
export function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div className="ambient-grid" />
    </div>
  );
}
