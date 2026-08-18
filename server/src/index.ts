import { createApp } from './app.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
const app = createApp();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export { app, createApp };
