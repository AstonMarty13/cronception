import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("@/pages/Home"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const Heatmap = lazy(() => import("@/pages/Heatmap"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Raw = lazy(() => import("@/pages/Raw"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/crontabs/:id/timeline" element={<Timeline />} />
          <Route path="/crontabs/:id/heatmap" element={<Heatmap />} />
          <Route path="/crontabs/:id/calendar" element={<Calendar />} />
          <Route path="/crontabs/:id/raw" element={<Raw />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
