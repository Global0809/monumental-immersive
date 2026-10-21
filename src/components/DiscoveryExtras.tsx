import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { videos, places } from "../data/catalogue";
import { photoCredits } from "../data/sources";
import { href } from "../services/router";
export function PlaceConnections({ id }: { id: string }) {
  const source = videos.filter((v) => v.places.includes(id));
  const generic = new Set([
    "preview",
    "motion study",
    "history",
    "originals",
    "in development",
  ]);
  const matches = places
    .filter((p) => p.id !== id)
    .map((p) => {
      const target = videos.filter((v) => v.places.includes(p.id));
      const chapter = source.find((v) => v.places.includes(p.id));
      const tag = source
        .flatMap((v) => v.tags)
        .find((t) => !generic.has(t) && target.some((v) => v.tags.includes(t)));
      const category = source.find((v) =>
        target.some((w) => w.category === v.category),
      )?.category;
      return {
        place: p,
        reason: chapter
          ? chapter.series
          : tag
            ? `Shared thread: ${tag}`
            : category
              ? `Explore ${category.toLowerCase()}`
              : "",
        score: chapter ? 3 : tag ? 2 : category ? 1 : 0,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return (
    <div className="place-connections">
      <h3>Connected worlds</h3>
      {matches.length ? (
        matches.map(({ place, reason }) => (
          <a key={place.id} href={href("/world", { place: place.id })}>
            <span>{place.name}</span>
            <span>
              {reason} <ArrowUpRight size={15} />
            </span>
          </a>
        ))
      ) : (
        <p>New connections will appear as this collection grows.</p>
      )}
    </div>
  );
}
export function SeriesLink({ series }: { series?: string }) {
  return series ? (
    <p className="series-link">
      <a href={href("/series", { name: series })}>
        Explore the {series} collection <ArrowUpRight size={15} />
      </a>
    </p>
  ) : null;
}
export function PhotoCredits() {
  return (
    <div className="photo-credits">
      <h2>Image & geography credits.</h2>
      <p>
        Destination images are cropped and color-treated for display. They
        illustrate their credited places, not featured performers.
      </p>
      {photoCredits.map((c) => (
        <p key={c.id}>
          <strong>{places.find((p) => p.id === c.id)?.name}</strong> —{" "}
          {c.author}.{" "}
          <a href={c.url} target="_blank" rel="noreferrer">
            Original photograph
          </a>{" "}
          ·{" "}
          <a href={c.licenseUrl} target="_blank" rel="noreferrer">
            {c.license}
          </a>
          .
        </p>
      ))}
      <p>
        Globe geography:{" "}
        <a
          href="https://www.naturalearthdata.com/about/terms-of-use/"
          target="_blank"
          rel="noreferrer"
        >
          Natural Earth, public domain
        </a>
        . Display typography: Space Grotesk by Florian Karsten and Manrope by
        Mikhail Sharanda, SIL Open Font License.
      </p>
      <p>
        Blender films and trailers:{" "}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noreferrer"
        >
          Creative Commons Attribution 3.0
        </a>
        .{" "}
        <a
          href="https://studio.blender.org/films/"
          target="_blank"
          rel="noreferrer"
        >
          Official film collection
        </a>
        .
      </p>
    </div>
  );
}
