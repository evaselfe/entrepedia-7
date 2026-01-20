import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VerificationBadge } from '@/components/ui/verification-badge';
import { 
  Search, 
  Users, 
  MapPin,
  UserPlus,
  UserMinus,
  UserCheck,
  Compass
} from 'lucide-react';

interface Friend {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_verified: boolean | null;
  is_following?: boolean;
  is_follower?: boolean;
}

export default function Friends() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [myFriends, setMyFriends] = useState<Friend[]>([]);
  const [nearbyFriends, setNearbyFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch users I'm following (my friends)
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];

      // Fetch users following me
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      const followerIds = followersData?.map(f => f.follower_id) || [];

      // Get mutual friends (both following each other)
      const mutualIds = followingIds.filter(id => followerIds.includes(id));

      // Fetch profiles of people I follow
      if (followingIds.length > 0) {
        const { data: friendsProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, location, is_verified')
          .in('id', followingIds);

        const enrichedFriends = (friendsProfiles || []).map(friend => ({
          ...friend,
          is_following: true,
          is_follower: followerIds.includes(friend.id)
        }));

        setMyFriends(enrichedFriends);
      }

      // Set following states
      const states: Record<string, boolean> = {};
      followingIds.forEach(id => {
        if (id) states[id] = true;
      });
      setFollowingStates(states);

      // Fetch nearby friends based on location
      if (profile?.location) {
        // Extract city/area from location (assumes format like "City, Country" or just "City")
        const locationParts = profile.location.split(',').map(p => p.trim());
        const searchLocation = locationParts[0]; // Use first part (usually city)

        const { data: nearbyProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, location, is_verified')
          .neq('id', user.id)
          .ilike('location', `%${searchLocation}%`)
          .limit(10);

        const enrichedNearby = (nearbyProfiles || []).map(friend => ({
          ...friend,
          is_following: followingIds.includes(friend.id),
          is_follower: followerIds.includes(friend.id)
        }));

        setNearbyFriends(enrichedNearby);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio, location, is_verified')
        .or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq('id', user?.id || '')
        .limit(20);

      const enrichedResults = (data || []).map(result => ({
        ...result,
        is_following: followingStates[result.id] || false
      }));

      setSearchResults(enrichedResults);
      setActiveTab('find');
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      navigate('/auth');
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

        toast({ title: 'Unfollowed successfully' });
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

        toast({ title: 'Following!' });
      }

      setFollowingStates(prev => ({
        ...prev,
        [userId]: !isFollowing
      }));

      // Update lists
      fetchData();
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: 'Error', description: 'Failed to update follow status', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Find Friends</h1>
          <p className="text-muted-foreground mb-4">Sign in to connect with friends</p>
          <Button onClick={() => navigate('/auth')} className="gradient-primary text-white">
            Sign In
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Friends
          </h1>
          
          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for friends by name or username..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" className="gradient-primary text-white">
              Find
            </Button>
          </form>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="friends" className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              My Friends ({myFriends.length})
            </TabsTrigger>
            <TabsTrigger value="nearby" className="flex items-center gap-1">
              <Compass className="h-4 w-4" />
              Nearby ({nearbyFriends.length})
            </TabsTrigger>
            <TabsTrigger value="find" className="flex items-center gap-1">
              <Search className="h-4 w-4" />
              Find
            </TabsTrigger>
          </TabsList>

          {/* My Friends Tab */}
          <TabsContent value="friends" className="mt-4">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : myFriends.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {myFriends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    isFollowing={true}
                    onFollow={() => handleFollow(friend.id)}
                    onNavigate={() => navigate(`/user/${friend.id}`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">No friends yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start following people to add them as friends
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('find')}>
                    Find Friends
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Nearby Friends Tab */}
          <TabsContent value="nearby" className="mt-4">
            {!profile?.location ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">Location not set</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your location in settings to find nearby friends
                  </p>
                  <Button variant="outline" onClick={() => navigate('/settings')}>
                    Update Location
                  </Button>
                </CardContent>
              </Card>
            ) : loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : nearbyFriends.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>People near {profile.location}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {nearbyFriends.map((friend) => (
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      isFollowing={followingStates[friend.id] || false}
                      onFollow={() => handleFollow(friend.id)}
                      onNavigate={() => navigate(`/user/${friend.id}`)}
                      showLocation
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Compass className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">No nearby users found</p>
                  <p className="text-sm text-muted-foreground">
                    Be the first in your area or try updating your location
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Find Friends Tab */}
          <TabsContent value="find" className="mt-4">
            {searchResults.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {searchResults.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    isFollowing={followingStates[friend.id] || false}
                    onFollow={() => handleFollow(friend.id)}
                    onNavigate={() => navigate(`/user/${friend.id}`)}
                    showLocation
                  />
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">Search for friends</p>
                  <p className="text-sm text-muted-foreground">
                    Enter a name or username to find people
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

interface FriendCardProps {
  friend: Friend;
  isFollowing: boolean;
  onFollow: () => void;
  onNavigate: () => void;
  showLocation?: boolean;
}

function FriendCard({ friend, isFollowing, onFollow, onNavigate, showLocation }: FriendCardProps) {
  return (
    <Card className="border-0 shadow-soft card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="cursor-pointer" onClick={onNavigate}>
            <Avatar className="h-12 w-12">
              <AvatarImage src={friend.avatar_url || ''} />
              <AvatarFallback className="gradient-primary text-white">
                {friend.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
            <div className="flex items-center gap-1">
              <p className="font-semibold text-foreground truncate hover:text-primary">
                {friend.full_name || 'Anonymous'}
              </p>
              {friend.is_verified && <VerificationBadge isVerified={true} size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              @{friend.username || 'user'}
            </p>
            {showLocation && friend.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {friend.location}
              </p>
            )}
          </div>
          <Button
            variant={isFollowing ? 'outline' : 'default'}
            size="sm"
            className={!isFollowing ? 'gradient-primary text-white' : ''}
            onClick={(e) => {
              e.stopPropagation();
              onFollow();
            }}
          >
            {isFollowing ? (
              <>
                <UserMinus className="h-4 w-4 mr-1" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Follow
              </>
            )}
          </Button>
        </div>
        {friend.bio && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {friend.bio}
          </p>
        )}
        {friend.is_follower && isFollowing && (
          <Badge variant="secondary" className="mt-2 text-xs">
            <UserCheck className="h-3 w-3 mr-1" />
            Mutual Friend
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
