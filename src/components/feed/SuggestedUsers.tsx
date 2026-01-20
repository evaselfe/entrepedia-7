import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SuggestedUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function SuggestedUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSuggestedUsers();
  }, [user]);

  const fetchSuggestedUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio')
        .limit(5);

      // Exclude current user
      if (user) {
        query = query.neq('id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Check follow status for each user
      if (user && data) {
        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = new Set(followData?.map(f => f.following_id) || []);
        const states: Record<string, boolean> = {};
        
        data.forEach(u => {
          states[u.id] = followingIds.has(u.id);
        });
        
        setFollowingStates(states);
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      toast({ title: 'Please sign in to follow users', variant: 'destructive' });
      return;
    }

    const isFollowing = followingStates[userId];

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: userId });

        // Create a notification for the person being followed
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'follow',
          title: 'New follower',
          body: 'Someone started following you!',
          data: { follower_id: user.id },
        });
      }

      setFollowingStates(prev => ({
        ...prev,
        [userId]: !isFollowing,
      }));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  return (
    <Card className="sticky top-20 shadow-soft border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" />
          Suggested for you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : users.length > 0 ? (
          <>
            {users.map((suggestedUser) => (
              <div
                key={suggestedUser.id}
                className="flex items-center gap-3"
              >
                <Link to={`/user/${suggestedUser.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={suggestedUser.avatar_url || ''} />
                    <AvatarFallback className="gradient-secondary text-white">
                      {suggestedUser.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/user/${suggestedUser.id}`}
                    className="font-medium text-sm hover:text-primary truncate block"
                  >
                    {suggestedUser.full_name || 'Anonymous'}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestedUser.bio || 'Entrepreneur'}
                  </p>
                </div>
                <Button
                  variant={followingStates[suggestedUser.id] ? 'outline' : 'default'}
                  size="sm"
                  className={!followingStates[suggestedUser.id] ? 'gradient-primary text-white' : ''}
                  onClick={() => handleFollow(suggestedUser.id)}
                >
                  {followingStates[suggestedUser.id] ? 'Following' : 'Follow'}
                </Button>
              </div>
            ))}
            <Link
              to="/explore?tab=users"
              className="flex items-center justify-center gap-1 text-sm text-primary hover:underline pt-2"
            >
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-4">
            No suggestions available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
