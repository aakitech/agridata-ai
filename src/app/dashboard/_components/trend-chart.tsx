"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendData {
  date: string;
  count: number;
}

export function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Reports Over Time</CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tickFormatter={(value) => value.slice(5)} // Show MM-DD
            />
            <YAxis 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false}
            />
            <Tooltip 
                contentStyle={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px" }}
                labelStyle={{ fontWeight: "bold", marginBottom: "5px" }}
            />
            <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#2563eb" 
                strokeWidth={2} 
                dot={false}
                activeDot={{ r: 4 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
