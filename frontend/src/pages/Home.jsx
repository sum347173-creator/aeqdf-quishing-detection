import { useNavigate } from "react-router-dom";
import Landing from "./Landing";

export default function Home() {
  const navigate = useNavigate();
  return <Landing onScan={() => navigate("/scan")} />;
}
