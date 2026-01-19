import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Sparkles, 
  UserPlus, 
  UserMinus,
  MessageCircle,
  ChevronRight
} from 'lucide-react';

interface NewCommunity {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
  is_member: boolean;
}

interface NewBusiness {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  created_at: string;
  follower_count: number;
  is_following: boolean;
}

interface ActiveCommunity {
  id: string;
  name: string;
  discussion_count: number;
  member_count: number;
  is_member: boolean;
}

interface PopularBusiness {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  follower_count: number;
  is_following: boolean;
}

const CATEGORIES: Record<string, string> = {
  food: '🍔',
  tech: '💻',
  handmade: '🎨',
  services: '🛠️',
  agriculture: '🌾',
  retail: '🛍️',
  education: '📚',
  health: '💊',
  finance: '💰',
  other: '📦',
};

export function DiscoverySection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [newCommunities, setNewCommunities] = useState<NewCommunity[]>([]);
  const [newBusinesses, setNewBusinesses] = useState<NewBusiness[]>([]);
  const [activeCommunities, setActiveCommunities] = useState<ActiveCommunity[]>([]);
  const [popularBusinesses, setPopularBusinesses] = useState<PopularBusiness[]>([]);

  useEffect(() => {
    fetchDiscoveryData();
  }, [user]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchNewCommunities(),
        fetchNewBusinesses(),
        fetchActiveCommunities(),
        fetchPopularBusinesses(),
      ]);
    } catch (error) {
      console.error('Error fetching discovery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNewCommunities = async () => {
    const { data } = await supabase
      .from('communities')
      .select('id, name, description, created_at')
      .eq('is_disabled', false)
      .order('created_at', { ascending: false })
      .limit(3);

    const enriched = await Promise.all(
      (data || []).map(async (community) => {
        const { count } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id);

        let is_member = false;
        if (user) {
          const { data: memberCheck } = await supabase
            .from('community_members')
            .select('id')
            .eq('community_id', community.id)
            .eq('user_id', user.id)
            .single();
          is_member = !!memberCheck;
        }
        return { ...community, member_count: count || 0, is_member };
      })
    );
    setNewCommunities(enriched);
  };

  const fetchNewBusinesses = async () => {
    const { data } = await supabase
      .from('businesses')
      .select('id, name, category, logo_url, created_at')
      .eq('is_disabled', false)
      .order('created_at', { ascending: false })
      .limit(3);

    const enriched = await Promise.all(
      (data || []).map(async (business) => {
        const { count } = await supabase
          .from('business_follows')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', business.id);

        let is_following = false;
        if (user) {
          const { data: followCheck } = await supabase
            .from('business_follows')
            .select('id')
            .eq('business_id', business.id)
            .eq('user_id', user.id)
            .single();
          is_following = !!followCheck;
        }
        return { ...business, follower_count: count || 0, is_following };
      })
    );
    setNewBusinesses(enriched);
  };

  const fetchActiveCommunities = async () => {
    // Get communities with most discussions
    const { data: discussionCounts } = await supabase
      .from('community_discussions')
      .select('community_id')
      .order('created_at', { ascending: false });

    // Count discussions per community
    const countMap: Record<string, number> = {};
    (discussionCounts || []).forEach((d) => {
      countMap[d.community_id] = (countMap[d.community_id] || 0) + 1;
    });

    // Sort by count and get top 3
    const topCommunityIds = Object.entries(countMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    if (topCommunityIds.length === 0) {
      setActiveCommunities([]);
      return;
    }

    const { data: communities } = await supabase
      .from('communities')
      .select('id, name')
      .in('id', topCommunityIds)
      .eq('is_disabled', false);

    const enriched = await Promise.all(
      (communities || []).map(async (community) => {
        const { count: memberCount } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id);

        let is_member = false;
        if (user) {
          const { data: memberCheck } = await supabase
            .from('community_members')
            .select('id')
            .eq('community_id', community.id)
            .eq('user_id', user.id)
            .single();
          is_member = !!memberCheck;
        }
        return {
          ...community,
          discussion_count: countMap[community.id] || 0,
          member_count: memberCount || 0,
          is_member,
        };
      })
    );
    
    // Re-sort by discussion count
    enriched.sort((a, b) => b.discussion_count - a.discussion_count);
    setActiveCommunities(enriched);
  };

  const fetchPopularBusinesses = async () => {
    // Get businesses with most followers
    const { data: followCounts } = await supabase
      .from('business_follows')
      .select('business_id');

    // Count followers per business
    const countMap: Record<string, number> = {};
    (followCounts || []).forEach((f) => {
      if (f.business_id) {
        countMap[f.business_id] = (countMap[f.business_id] || 0) + 1;
      }
    });

    // Sort by count and get top 3
    const topBusinessIds = Object.entries(countMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    if (topBusinessIds.length === 0) {
      setPopularBusinesses([]);
      return;
    }

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name, category, logo_url')
      .in('id', topBusinessIds)
      .eq('is_disabled', false);

    const enriched = await Promise.all(
      (businesses || []).map(async (business) => {
        let is_following = false;
        if (user) {
          const { data: followCheck } = await supabase
            .from('business_follows')
            .select('id')
            .eq('business_id', business.id)
            .eq('user_id', user.id)
            .single();
          is_following = !!followCheck;
        }
        return {
          ...business,
          follower_count: countMap[business.id] || 0,
          is_following,
        };
      })
    );
    
    // Re-sort by follower count
    enriched.sort((a, b) => b.follower_count - a.follower_count);
    setPopularBusinesses(enriched);
  };

  const handleFollowBusiness = async (businessId: string, isFollowing: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      if (isFollowing) {
        await supabase.from('business_follows').delete()
          .eq('business_id', businessId).eq('user_id', user.id);
        toast({ title: 'Unfollowed' });
      } else {
        await supabase.from('business_follows')
          .insert({ business_id: businessId, user_id: user.id });
        toast({ title: 'Following!' });
      }
      fetchDiscoveryData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleJoinCommunity = async (communityId: string, isMember: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      if (isMember) {
        await supabase.from('community_members').delete()
          .eq('community_id', communityId).eq('user_id', user.id);
        toast({ title: 'Left community' });
      } else {
        await supabase.from('community_members')
          .insert({ community_id: communityId, user_id: user.id, role: 'member' });
        toast({ title: 'Joined!' });
      }
      fetchDiscoveryData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Communities */}
      {newCommunities.length > 0 && (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              New Communities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {newCommunities.map((community) => (
              <div key={community.id} className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/communities/${community.id}`)}
                >
                  <span className="text-white font-medium">{community.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/communities/${community.id}`)}>
                  <p className="font-medium text-sm truncate hover:text-primary">{community.name}</p>
                  <p className="text-xs text-muted-foreground">{community.member_count} members</p>
                </div>
                <Button
                  size="sm"
                  variant={community.is_member ? "ghost" : "outline"}
                  className="h-8"
                  onClick={() => handleJoinCommunity(community.id, community.is_member)}
                >
                  {community.is_member ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                </Button>
              </div>
            ))}
            <Button 
              variant="ghost" 
              className="w-full text-xs text-primary"
              onClick={() => navigate('/communities')}
            >
              View all communities <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Businesses */}
      {newBusinesses.length > 0 && (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-secondary/5 to-secondary/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-secondary" />
              New Businesses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {newBusinesses.map((business) => (
              <div key={business.id} className="flex items-center gap-3">
                <Avatar 
                  className="h-10 w-10 cursor-pointer"
                  onClick={() => navigate(`/business/${business.id}`)}
                >
                  <AvatarImage src={business.logo_url || ''} />
                  <AvatarFallback className="gradient-secondary text-white">
                    {business.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/business/${business.id}`)}>
                  <p className="font-medium text-sm truncate hover:text-primary">{business.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORIES[business.category] || '📦'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant={business.is_following ? "ghost" : "outline"}
                  className="h-8"
                  onClick={() => handleFollowBusiness(business.id, business.is_following)}
                >
                  {business.is_following ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                </Button>
              </div>
            ))}
            <Button 
              variant="ghost" 
              className="w-full text-xs text-primary"
              onClick={() => navigate('/explore?tab=businesses')}
            >
              View all businesses <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Most Active Communities */}
      {activeCommunities.length > 0 && (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/5 to-amber-500/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-amber-500" />
              Most Active Communities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {activeCommunities.map((community) => (
              <div key={community.id} className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/communities/${community.id}`)}
                >
                  <span className="text-white font-medium">{community.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/communities/${community.id}`)}>
                  <p className="font-medium text-sm truncate hover:text-primary">{community.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {community.discussion_count} discussions • {community.member_count} members
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={community.is_member ? "ghost" : "outline"}
                  className="h-8"
                  onClick={() => handleJoinCommunity(community.id, community.is_member)}
                >
                  {community.is_member ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Most Followed Businesses */}
      {popularBusinesses.length > 0 && (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-green-500/5 to-green-500/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Most Followed Businesses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {popularBusinesses.map((business) => (
              <div key={business.id} className="flex items-center gap-3">
                <Avatar 
                  className="h-10 w-10 cursor-pointer"
                  onClick={() => navigate(`/business/${business.id}`)}
                >
                  <AvatarImage src={business.logo_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white">
                    {business.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/business/${business.id}`)}>
                  <p className="font-medium text-sm truncate hover:text-primary">{business.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIES[business.category] || '📦'} • {business.follower_count} followers
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={business.is_following ? "ghost" : "outline"}
                  className="h-8"
                  onClick={() => handleFollowBusiness(business.id, business.is_following)}
                >
                  {business.is_following ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
