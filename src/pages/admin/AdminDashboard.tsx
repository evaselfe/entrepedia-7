import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { ActivityLog } from '@/components/admin/ActivityLog';
import { useAdminStats } from '@/hooks/useAdminStats';
import { 
  Users, 
  Building2, 
  FileText, 
  Users2, 
  Flag, 
  Star,
  TrendingUp,
  Activity,
  Clock,
  Briefcase,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['hsl(330, 85%, 60%)', 'hsl(210, 90%, 55%)', 'hsl(195, 85%, 50%)', 'hsl(150, 70%, 50%)', 'hsl(45, 90%, 55%)'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  // Fetch pending approvals counts
  const { data: pendingCounts } = useQuery({
    queryKey: ['admin-pending-counts'],
    queryFn: async () => {
      const [communitiesRes, businessesRes, jobsRes] = await Promise.all([
        supabase.from('communities').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
      ]);

      return {
        communities: communitiesRes.count || 0,
        businesses: businessesRes.count || 0,
        jobs: jobsRes.count || 0,
        total: (communitiesRes.count || 0) + (businessesRes.count || 0) + (jobsRes.count || 0),
      };
    },
  });

  const { data: categoryData } = useQuery({
    queryKey: ['admin-category-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('category');

      if (error) throw error;

      const counts = (data || []).reduce((acc, b) => {
        acc[b.category] = (acc[b.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(counts)
        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['admin-weekly-posts'],
    queryFn: async () => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', oneWeekAgo.toISOString());

      if (error) throw error;

      const countsByDay = days.map((day, index) => ({
        name: day,
        posts: 0,
      }));

      (data || []).forEach((post) => {
        const dayIndex = new Date(post.created_at!).getDay();
        countsByDay[dayIndex].posts++;
      });

      return countsByDay;
    },
  });

  return (
    <AdminLayout 
      title="Dashboard" 
      description="Overview of your platform metrics and activity"
    >
      {/* Pending Approvals Card */}
      {(pendingCounts?.total ?? 0) > 0 && (
        <Card className="mb-8 border-orange-500/50 bg-gradient-to-r from-orange-500/5 to-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Pending Approvals</CardTitle>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-500">
                {pendingCounts?.total} items need review
              </Badge>
            </div>
            <CardDescription>
              Review and approve new submissions to make them visible on the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Pending Communities */}
              <div 
                className="flex items-center justify-between p-4 rounded-lg bg-background border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate('/admin/communities')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Communities</p>
                    <p className="text-sm text-muted-foreground">Awaiting approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-500">{pendingCounts?.communities || 0}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Pending Businesses */}
              <div 
                className="flex items-center justify-between p-4 rounded-lg bg-background border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate('/admin/businesses')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Businesses</p>
                    <p className="text-sm text-muted-foreground">Awaiting approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-500">{pendingCounts?.businesses || 0}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Pending Jobs */}
              <div 
                className="flex items-center justify-between p-4 rounded-lg bg-background border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate('/admin/jobs')}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">Jobs</p>
                    <p className="text-sm text-muted-foreground">Awaiting approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-purple-500">{pendingCounts?.jobs || 0}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Users"
          value={statsLoading ? '...' : stats?.totalUsers || 0}
          icon={Users}
        />
        <StatsCard
          title="Active Today"
          value={statsLoading ? '...' : stats?.activeUsersToday || 0}
          icon={Activity}
        />
        <StatsCard
          title="Businesses"
          value={statsLoading ? '...' : stats?.totalBusinesses || 0}
          icon={Building2}
        />
        <StatsCard
          title="Posts"
          value={statsLoading ? '...' : stats?.totalPosts || 0}
          icon={FileText}
        />
        <StatsCard
          title="Communities"
          value={statsLoading ? '...' : stats?.totalCommunities || 0}
          icon={Users2}
        />
        <StatsCard
          title="Pending Reports"
          value={statsLoading ? '...' : stats?.pendingReports || 0}
          icon={Flag}
          className={stats?.pendingReports ? 'border-destructive/50' : ''}
        />
        <StatsCard
          title="Featured Businesses"
          value={statsLoading ? '...' : stats?.featuredBusinesses || 0}
          icon={Star}
        />
        <StatsCard
          title="Growth Rate"
          value="+12%"
          icon={TrendingUp}
          trend={{ value: 12, isPositive: true }}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Posts Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Posts This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="posts" 
                    fill="hsl(330, 85%, 60%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(categoryData || []).map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {(categoryData || []).map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground flex-1">{item.name}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <div className="mt-6">
        <ActivityLog />
      </div>
    </AdminLayout>
  );
}
