import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mshwar",
  description: "AI-Powered Lebanon Trip & Experience Platform",
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface p-24 text-text">
      <h1 className="text-display font-bold">Mshwar</h1>
      <p className="mt-4 text-title text-text-muted">Discover. Plan. Book Lebanon. AI-powered itinerary builder.</p>
    </main>
  );
}
