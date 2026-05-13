import axios from "axios";

// Central API client. Add JWT authorization headers here after authentication is implemented.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});
