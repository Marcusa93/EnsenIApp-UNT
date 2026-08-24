"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { createStudentReport } from "../actions";

export function StudentReportButton({ courseId, studentId }: { courseId: string; studentId: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        leftIcon={<Sparkles />}
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await createStudentReport({ course_id: courseId, student_id: studentId });
            if (res && !res.ok) setError(res.error);
          });
        }}
      >
        Generar informe de este estudiante
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
