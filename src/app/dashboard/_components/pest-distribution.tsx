"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface DistributionData {
  name: string | null;
  count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function PestDistribution({ data }: { data: DistributionData[] }) {
  const chartData = data.map(d => ({
      name: d.name || "Unknown",
      value: d.count
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pest Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
