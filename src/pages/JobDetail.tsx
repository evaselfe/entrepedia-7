import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useJob } from '@/hooks/useJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Share2,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  User,
  MessageSquare,
} from 'lucide-react';
import { ApplyJobDialog } from '@/components/jobs/ApplyJobDialog';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { job, applications, loading, refetch } = useJob(id || '');

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!job) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground mb-4">This job may have been removed or doesn't exist.</p>
          <Button onClick={() => navigate('/jobs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isExpired = job.status === 'closed' || 
    (job.expires_at && new Date(job.expires_at) < new Date()) ||
    (job.max_applications && job.application_count && job.application_count >= job.max_applications);

  const isCreator = user?.id === job.creator_id;

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: job.title,
          text: job.description.slice(0, 100) + '...',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const handleCloseJob = async () => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('id', job.id);

      if (error) throw error;
      toast.success('Job closed successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to close job');
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/jobs')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>

        <Card className="border-0 shadow-soft mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={job.profiles?.avatar_url || ''} />
                  <AvatarFallback>
                    {job.profiles?.full_name?.charAt(0) || job.profiles?.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Posted by</p>
                  <p className="font-medium">
                    {job.profiles?.full_name || job.profiles?.username || 'Anonymous'}
                  </p>
                </div>
              </div>
              <Badge 
                variant={isExpired ? 'secondary' : 'default'} 
                className={`text-sm ${isExpired ? '' : 'bg-green-500'}`}
              >
                {isExpired ? (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    Offer Ended
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Open
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{job.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {job.application_count || 0} applications
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>

            {job.conditions && (
              <div>
                <h3 className="font-semibold mb-2">Requirements / Conditions</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.conditions}</p>
              </div>
            )}

            {(job.expires_at || job.max_applications) && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Expiry Info</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {job.expires_at && (
                    <p>
                      {new Date(job.expires_at) < new Date() 
                        ? `Expired on ${format(new Date(job.expires_at), 'PPP')}`
                        : `Expires on ${format(new Date(job.expires_at), 'PPP')}`
                      }
                    </p>
                  )}
                  {job.max_applications && (
                    <p>
                      Limited to {job.max_applications} applications 
                      ({job.application_count || 0} received)
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              {!isExpired && !isCreator && user && (
                <ApplyJobDialog job={job} onApplied={refetch} hasApplied={job.has_applied} />
              )}
              
              {isCreator && !isExpired && (
                <Button
                  variant="outline"
                  onClick={handleCloseJob}
                  className="text-destructive hover:text-destructive"
                >
                  Close Job
                </Button>
              )}

              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Applications section - only visible to creator */}
        {isCreator && (
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Applications ({applications.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No applications yet
                </p>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage src={app.profiles?.avatar_url || ''} />
                          <AvatarFallback>
                            {app.profiles?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {app.profiles?.full_name || app.profiles?.username || 'Anonymous'}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          
                          {app.message && (
                            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                {app.message}
                              </p>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            {app.profiles?.mobile_number && (
                              <a 
                                href={`tel:${app.profiles.mobile_number}`}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Phone className="h-4 w-4" />
                                {app.profiles.mobile_number}
                              </a>
                            )}
                            {app.profiles?.email && (
                              <a 
                                href={`mailto:${app.profiles.email}`}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Mail className="h-4 w-4" />
                                {app.profiles.email}
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/user/${app.applicant_id}`)}
                            >
                              <User className="h-4 w-4 mr-1" />
                              View Profile
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
