import { PacksDirectory } from "@/components/PacksDirectory";
import { harnessPacks } from "@/lib/harness-packs";

export default function Home() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <PacksDirectory packs={harnessPacks} />
      </div>
    </main>
  );
}
