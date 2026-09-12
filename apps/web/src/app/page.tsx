import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mshwar",
  description: "AI-Powered Lebanon Trip & Experience Platform",
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Mshwar</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Discover. Plan. Book Lebanon. AI-powered itinerary builder.
      </p>
    </main>
  )
}
