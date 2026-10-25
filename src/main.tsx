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
  const { default: App } = await import('./App');
  ReactDOM.createRoot(rootElement).render(<React.StrictMode><App/></React.StrictMode>);
}
function showBootFailure() {
  const message = document.createElement('p');
  message.textContent = 'Monumental could not open. Please refresh to try again.';
  message.setAttribute('role', 'alert');
  rootElement.replaceChildren(message);
}
const catalogueReady = initializeCatalogue(import.meta.env.VITE_CATALOGUE_API_URL);
void (catalogueReady ? catalogueReady.then(mountApp) : mountApp()).catch(showBootFailure);
