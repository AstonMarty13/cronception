import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Timeline from "@/pages/Timeline";
import Heatmap from "@/pages/Heatmap";
import Calendar from "@/pages/Calendar";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/crontabs/:id/timeline" element={<Timeline />} />
        <Route path="/crontabs/:id/heatmap" element={<Heatmap />} />
        <Route path="/crontabs/:id/calendar" element={<Calendar />} />
      </Routes>
    </BrowserRouter>
  );
}
