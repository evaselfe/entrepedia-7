import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '@/assets/logo.jpg';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Phone, Lock, Shield, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const mobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function AdminLogin() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    const mobileResult = mobileSchema.safeParse(mobileNumber);
    if (!mobileResult.success) {
      newErrors.mobile = mobileResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);

    try {
      // Sign in with mobile auth (same as main app)
      const response = await supabase.functions.invoke('mobile-auth', {
        body: {
          action: 'signin',
          mobile_number: mobileNumber,
          password,
        },
      });

      if (response.error) {
        const errorMessage = response.error.message || 'Sign in failed';
        const contextError = (response.error as any)?.context?.body;
        if (contextError) {
          try {
            const parsed = JSON.parse(contextError);
            if (parsed.error) {
              toast({
                title: 'Login failed',
                description: parsed.error,
                variant: 'destructive'
              });
              setLoading(false);
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }
        toast({
          title: 'Login failed',
          description: errorMessage,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      const data = response.data;
      
      if (data?.error) {
        toast({
          title: 'Login failed',
          description: data.error,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({
          title: 'Login failed',
          description: 'No user found',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Check if user has admin role using service role via edge function
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      if (rolesError || !roles || roles.length === 0) {
        toast({
          title: 'Access denied',
          description: 'You do not have admin privileges',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Store admin session
      localStorage.setItem('admin_session', JSON.stringify({
        user: data.user,
        session_token: data.session_token,
        roles: roles.map(r => r.role),
      }));

      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in to admin panel',
      });

      navigate('/admin');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-fit">
            <img 
              src={logoImg} 
              alt="സംരംഭക.com Logo" 
              className="h-20 w-auto rounded-2xl shadow-glow transition-all duration-300 hover:scale-110 hover:rotate-3 cursor-pointer"
            />
            <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mt-4">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">സംരംഭക.com Administration</p>
        </div>

        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
            <CardDescription className="text-center">
              Enter your mobile number and password to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Mobile Number */}
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="mobile" 
                    type="tel"
                    placeholder="9876543210" 
                    className="pl-10" 
                    value={mobileNumber} 
                    onChange={e => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    autoComplete="tel"
                    maxLength={10}
                  />
                </div>
                {errors.mobile && <p className="text-sm text-destructive">{errors.mobile}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter your password" 
                    className="pl-10 pr-10" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    autoComplete="current-password"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 font-semibold" 
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
              </Button>
            </form>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground text-center">
                <Shield className="inline h-3 w-3 mr-1" />
                This area is restricted to authorized administrators only.
                All login attempts are logged.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
