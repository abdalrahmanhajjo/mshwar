import type { Metadata } from "next";
import { HomeView } from "@/components/browse/home-view";

export const metadata: Metadata = {
  title: "Mshwar — Make room for a little mshwar",
  description: "From the mountain air to the sea, find your next day at your own pace.",
};

export default function Home() {
  return <HomeView />;
}
