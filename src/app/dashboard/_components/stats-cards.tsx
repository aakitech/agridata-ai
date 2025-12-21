import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Users, FileText, AlertTriangle, TrendingUp } from "lucide-react";

interface StatsProps {
  stats: {
    totalReports: number;
    reportsThisWeek: number;
    reportsLastWeek: number;
    activeScouts: number;
    highRiskCount: number;
  };
}

export function StatsCards({ stats }: StatsProps) {
  // Calculate trend
  const trend = stats.reportsLastWeek > 0 
    ? ((stats.reportsThisWeek - stats.reportsLastWeek) / stats.reportsLastWeek) * 100 
    : 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalReports}</div>
          <p className="text-xs text-muted-foreground">
            All time submissions
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reports this Week</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.reportsThisWeek}</div>
          <p className="text-xs text-muted-foreground">
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}% from last week
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Scouts</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeScouts}</div>
          <p className="text-xs text-muted-foreground">
            Unique reporters
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Risk Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.highRiskCount}</div>
          <p className="text-xs text-muted-foreground">
             Requires immediate attention
          </p>
        </CardContent>
      </Card>
    </>
  );
}
