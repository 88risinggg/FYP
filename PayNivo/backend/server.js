import dotenv from "dotenv";
import { createApp } from "./src/app.js";

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`PayNivo API running on port ${PORT}`);
});
