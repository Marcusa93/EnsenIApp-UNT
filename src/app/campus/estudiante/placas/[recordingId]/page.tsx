import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState } from "@/components/ui";
import { Deck } from "@/components/cards/deck";
import { getRecordingForCards } from "@/app/campus/estudiante/clases/_lib/data";

export const metadata = { title: "Placas · EnsenIA UNT" };

export default async function CardsPage({ params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await params;
  const { user } = await requireRole("estudiante");
  const supabase = await createClient();
  const recording = await getRecordingForCards(supabase, user.id, recordingId);
  if (!recording) notFound();

  if (recording.cards.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <EmptyState
          icon={Layers}
          tone="accent"
          title="Las placas de esta clase todavía no están listas"
          description="Se generan automáticamente cuando el equipo docente publica la grabación. Mientras tanto podés leer el resumen."
          action={
            <Button asChild variant="secondary" leftIcon={<ArrowLeft />}>
              <Link href={`/campus/estudiante/clases/${recording.class_id}`}>Volver a la clase</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4">
      <Deck
        studentId={user.id}
        recordingId={recording.id}
        classId={recording.class_id}
        classTopic={recording.class_topic}
        recordingTitle={recording.title}
        cards={recording.cards}
        initialProgress={recording.progress}
      />
    </div>
  );
}
