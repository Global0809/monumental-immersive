import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundledCatalogue } from '../src/data/catalogue';
import { parseCatalogueSnapshot } from '../src/platform/catalogue/validation';
import { createDiscoveryContext } from '../src/platform/discovery-context';

// Reproducible, public-only input for a future CMS import or server retrieval index.
// This does not upload data, connect an AI service or publish a catalogue revision.
const destination = resolve(process.cwd(), 'output', 'platform');
const snapshot = parseCatalogueSnapshot(bundledCatalogue);
await mkdir(destination, { recursive: true });
await writeFile(resolve(destination, 'catalogue.v1.json'), JSON.stringify(snapshot, null, 2) + '\n');
await writeFile(resolve(destination, 'discovery-context.v1.json'), JSON.stringify(createDiscoveryContext(snapshot), null, 2) + '\n');
console.log(`Exported ${snapshot.videos.length} stories at revision ${snapshot.revision} to ${destination}`);
