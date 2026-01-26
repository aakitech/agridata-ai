"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { format } from "date-fns";

interface TrendData {
  date: string;
  count: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border shadow-xl rounded-lg p-3 min-w-[120px] animate-in fade-in zoom-in-95 duration-200">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">
          {label ? format(new Date(label), "MMMM dd, yyyy") : ""}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium">Reports</span>
          </div>
          <span className="text-sm font-bold text-primary font-mono">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function TrendChart({ data }: { data: TrendData[] }) {
  // Find max value for better Y-axis scaling
  const maxCount = Math.max(...data.map(d => d.count), 5);
  const yAxisTicks = Array.from({ length: 6 }, (_, i) => Math.ceil((maxCount / 5) * i));

  return (
    <Card className="col-span-2 overflow-hidden border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="flex items-center justify-between">
            <div>
                <CardTitle className="text-xl font-bold">Reports Over Time</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Frequency of pest reports detected by scouts</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border">
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                Active Analysis
            </div>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] px-0 pb-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="hsl(var(--muted-foreground))" 
                opacity={0.1} 
            />
            <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={12} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)' }}
                tickFormatter={(value) => format(new Date(value), "MMM dd")} 
            />
            <YAxis 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)' }}
                ticks={yAxisTicks}
            />
            <Tooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorCount)"
                animationDuration={1500}
                activeDot={{ 
                    r: 6, 
                    stroke: "#fff", 
                    strokeWidth: 2, 
                    fill: "hsl(var(--primary))",
                    className: "shadow-lg"
                }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
