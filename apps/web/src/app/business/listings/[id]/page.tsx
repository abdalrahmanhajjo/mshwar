import { ListingEditor } from "@/components/business/listing-editor";
import { ShellMain } from "@/components/shell/app-shell";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <ListingEditor experienceId={id} />
    </ShellMain>
  );
}
