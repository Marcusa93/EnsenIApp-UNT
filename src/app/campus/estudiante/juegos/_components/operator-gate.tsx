import { PageHeader } from "@/components/ui";
import { OperatorForge } from "@/components/avatar/operator-forge";

/**
 * Primera vez en Juegos: antes de jugar, armás tu operador. Es el momento en que
 * el campus deja de ser un sitio y pasa a ser un juego, así que la pantalla se
 * toma su lugar en vez de aparecer como un formulario más.
 */
export function OperatorGate() {
  return (
    <>
      <PageHeader
        eyebrow="El Expediente · Abogacía aumentada"
        title="Creá tu operador"
        description="Vas a repasar la materia como un operador jurídico aumentado. Cada partida que ganes desbloquea equipo: módulos de análisis, togas técnicas, instrumentos de litigio y drones asesores. Empezá eligiendo cómo se ve el tuyo."
      />
      <OperatorForge mode="crear" />
    </>
  );
}
