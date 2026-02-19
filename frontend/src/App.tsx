import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";

export default function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await axios.get("/api/health")).data,
  });

  return (
    <div className="min-h-screen p-6">
      <Card className="max-w-xl">
        <CardContent className="p-6">
          <h1 className="text-2xl font-semibold">CronCeption</h1>
          <p className="mt-4">
            {isLoading && "Loading..."}
            {error && "Error"}
            {data && `Backend: ${data.status}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

