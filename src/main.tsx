import React from 'react';
import ReactDOM from 'react-dom/client';
import {lazy, Suspense} from 'react';
import App from './ModeShell';
const Explore = lazy(() => import('./Explore'));
const exploring = /\/(explore|training)\/?$/.test(window.location.pathname);

import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={null}>{exploring ? <Explore/> : <App/>}</Suspense></React.StrictMode>);
