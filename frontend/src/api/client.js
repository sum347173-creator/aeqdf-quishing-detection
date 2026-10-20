import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("aeqdf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  register: (data) => client.post("/api/auth/register", data).then((r) => r.data),
  login: (data) => client.post("/api/auth/login", data).then((r) => r.data),
};

export const scans = {
  submit: (url) => client.post("/api/scans", { url }).then((r) => r.data),
  list: (page = 1) => client.get(`/api/scans?page=${page}`).then((r) => r.data),
  stats: () => client.get("/api/scans/stats").then((r) => r.data),
};

export default client;
