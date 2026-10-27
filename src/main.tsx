import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource-variable/dm-sans';
import './styles.css';
import { initializeCatalogue } from './data/catalogue';
import { immersiveExperienceUrl } from './services/experienceUrl';

const immersiveUrl = immersiveExperienceUrl(location.pathname, location.search, location.hash);
if (immersiveUrl) history.replaceState(history.state, '', immersiveUrl);

const rootElement = document.getElementById('root')!;
async function mountApp() {
  // Import after catalogue hydration: several editorial modules derive their
  // collections at module scope. Never let a late request rewrite a mounted UI.
  const application = import('./App');
  const path = (location.hash.slice(1) || '/').split('?')[0];
  // Discover the requested editorial chunk alongside the shell, avoiding a
  // shell → mount → route waterfall. This does not fetch other destinations.
  const entry = path === '/world' || path === '/time-machine'
    ? import('./components/ExplorePages')
    : path === '/search' || path.startsWith('/category/')
      ? import('./components/CatalogueBrowser')
      : path === '/journey'
        ? import('./components/JourneyWorkbench')
        : path === '/' ? import('./components/spatial/SpatialHome') : undefined;
  void entry?.catch(() => { /* The route boundary owns the visible retry state. */ });
  const { default: App } = await application;
  ReactDOM.createRoot(rootElement).render(<React.StrictMode><App/></React.StrictMode>);
}
function showBootFailure() {
  const shell = document.createElement('div');
  shell.className = 'boot-shell';
  const message = document.createElement('p');
  message.textContent = 'Monumental could not open. Check your connection, then try again.';
  message.setAttribute('role', 'alert');
  const retry = document.createElement('button');
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => location.reload());
  shell.append(message, retry);
  rootElement.replaceChildren(shell);
}
const catalogueReady = initializeCatalogue(import.meta.env.VITE_CATALOGUE_API_URL);
void (catalogueReady ? catalogueReady.then(mountApp) : mountApp()).catch(showBootFailure);
