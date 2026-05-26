import app from './app';
import { config } from 'dotenv';
import './jobs/cleanup.job';

config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
