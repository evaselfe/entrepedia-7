import { useState } from 'react';
import logoImg from '@/assets/logo.jpg';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Phone, Lock, ArrowLeft, Check, X, KeyRound, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const phoneSchema = z.string().min(1, 'Mobile number is required').refine(
  (val) => /^[0-9]{10}$/.test(val),
  { message: 'Please enter a valid 10-digit mobile number' }
);
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type Step = 'mobile' | 'otp' | 'password' | 'success';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      minLength: pwd.length >= 6,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    
    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    let color = 'bg-destructive';
    
    if (passedChecks >= 5) {
      strength = 'strong';
      color = 'bg-emerald-500';
    } else if (passedChecks >= 4) {
      strength = 'good';
      color = 'bg-emerald-400';
    } else if (passedChecks >= 3) {
      strength = 'fair';
      color = 'bg-yellow-500';
    }
    
    return { checks, passedChecks, strength, color, percentage: (passedChecks / 5) * 100 };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOTP = async () => {
    const phoneResult = phoneSchema.safeParse(mobileNumber);
    if (!phoneResult.success) {
      setErrors({ mobileNumber: phoneResult.error.errors[0].message });
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'request_otp', mobile_number: mobileNumber }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'OTP Sent',
        description: 'Please check your mobile for the verification code.',
      });
      
      // For testing: show debug OTP
      if (data.debug_otp) {
        toast({
          title: 'Debug OTP (Testing Only)',
          description: `Your OTP is: ${data.debug_otp}`,
          duration: 30000,
        });
      }
      
      startResendCooldown();
      setStep('otp');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send OTP',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' });
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'verify_otp', mobile_number: mobileNumber, otp }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'OTP Verified',
        description: 'Please set your new password.',
      });
      setStep('password');
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid or expired OTP',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'reset_password', mobile_number: mobileNumber, otp, new_password: newPassword }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Password Reset Successful',
        description: 'You can now sign in with your new password.',
      });
      setStep('success');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'mobile':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
              <CardDescription className="text-center">
                Enter your registered mobile number to receive a verification code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="mobileNumber" 
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    className="pl-10" 
                    value={mobileNumber} 
                    onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))} 
                  />
                </div>
                {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber}</p>}
              </div>
              
              <Button 
                onClick={handleRequestOTP}
                className="w-full h-12 gradient-primary text-white font-semibold" 
                disabled={loading || !mobileNumber}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </CardContent>
          </>
        );

      case 'otp':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Enter OTP</CardTitle>
              <CardDescription className="text-center">
                We've sent a 6-digit code to {mobileNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP 
                    maxLength={6} 
                    value={otp} 
                    onChange={setOtp}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {errors.otp && <p className="text-sm text-destructive text-center">{errors.otp}</p>}
              </div>
              
              <Button 
                onClick={handleVerifyOTP}
                className="w-full h-12 gradient-primary text-white font-semibold" 
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </Button>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={handleRequestOTP}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm"
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Didn't receive code? Resend"}
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                onClick={() => { setStep('mobile'); setOtp(''); }}
                className="w-full"
              >
                Change Mobile Number
              </Button>
            </CardContent>
          </>
        );

      case 'password':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Set New Password</CardTitle>
              <CardDescription className="text-center">
                Create a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="newPassword" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter new password" 
                    className="pl-10 pr-10" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
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
                
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium capitalize ${
                        passwordStrength.strength === 'strong' ? 'text-emerald-500' :
                        passwordStrength.strength === 'good' ? 'text-emerald-400' :
                        passwordStrength.strength === 'fair' ? 'text-yellow-500' :
                        'text-destructive'
                      }`}>
                        {passwordStrength.strength}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.minLength ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>6+ characters</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasUppercase ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasLowercase ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Lowercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasNumber ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Number</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasSpecial ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Special character</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    placeholder="Repeat your password" 
                    className="pl-10 pr-10" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              
              <Button 
                onClick={handleResetPassword}
                className="w-full h-12 gradient-primary text-white font-semibold" 
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </CardContent>
          </>
        );

      case 'success':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <KeyRound className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-2xl text-center">Password Reset!</CardTitle>
              <CardDescription className="text-center">
                Your password has been successfully reset. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full h-12 gradient-primary text-white font-semibold"
              >
                Sign In
              </Button>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero px-4 py-12">
      <div className="w-full max-w-md">
        {step !== 'success' && (
          <Button variant="ghost" className="mb-6" onClick={() => navigate('/auth')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        )}

        <div className="text-center mb-8">
          <img src={logoImg} alt="സംരംഭക Logo" className="h-20 w-auto rounded-2xl mx-auto mb-4 shadow-glow" />
          <h1 className="text-3xl font-bold text-foreground">സംരംഭക.com</h1>
          <p className="text-muted-foreground mt-2">Reset your password</p>
        </div>

        <Card className="shadow-medium border-0">
          {renderStepContent()}
        </Card>
      </div>
    </div>
  );
}
