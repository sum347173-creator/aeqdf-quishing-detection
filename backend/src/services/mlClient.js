import axios from "axios";

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export async function getPrediction(features) {
  try {
    const { data } = await axios.post(`${ML_URL}/predict`, { features }, { timeout: 8000 });
    return data;
  } catch (err) {
    if (err.response) {
      // ML service responded but rejected the request (e.g. missing features)
      throw new Error(`ML service error: ${JSON.stringify(err.response.data)}`);
    }
    throw new Error(`ML service unreachable at ${ML_URL}: ${err.message}`);
  }
}
