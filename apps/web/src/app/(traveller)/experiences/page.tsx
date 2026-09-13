import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperiencesView } from "@/components/browse/experiences-view";

export const metadata: Metadata = {
  title: "Experiences — A whole country. Your next discovery.",
  description: "Big adventures, little escapes, and everything in between.",
};

export default function ExperiencesPage() {
  return (
    <Suspense>
      <ExperiencesView />
    </Suspense>
  );
}
