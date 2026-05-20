import dotenv from "dotenv";
import { createApp } from "./src/server/app.js";

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PayNivo API running on port ${PORT}`);
});
