import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs, useMyJobs } from '@/hooks/useJobs';
import { JobCard } from '@/components/jobs/JobCard';
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, List, User } from 'lucide-react';

export default function Jobs() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const { jobs: allJobs, loading: loadingAll, refetch: refetchAll } = useJobs();
  const { jobs: myJobs, loading: loadingMy, refetch: refetchMy } = useMyJobs();

  const handleRefetch = () => {
    refetchAll();
    refetchMy();
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Jobs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Find opportunities or post your own job listings
            </p>
          </div>
          {user && <CreateJobDialog onJobCreated={handleRefetch} />}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="all" className="gap-2">
              <List className="h-4 w-4" />
              All Jobs
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-2" disabled={!user}>
              <User className="h-4 w-4" />
              My Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {loadingAll ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            ) : allJobs.length > 0 ? (
              allJobs.map((job) => (
                <JobCard key={job.id} job={job} onUpdate={handleRefetch} />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No jobs posted yet</p>
                  {user && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Be the first to post a job!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            {!user ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please login to see your jobs</p>
                </CardContent>
              </Card>
            ) : loadingMy ? (
              Array(2).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            ) : myJobs.length > 0 ? (
              myJobs.map((job) => (
                <JobCard key={job.id} job={job} onUpdate={handleRefetch} showApplications />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't posted any jobs yet</p>
                  <div className="mt-4">
                    <CreateJobDialog onJobCreated={handleRefetch} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
