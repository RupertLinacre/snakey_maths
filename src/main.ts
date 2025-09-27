import './style.css';

import { init } from './view';

init().catch((error) => {
  console.error('Failed to initialise snake-maths', error);
});
